import Stripe from "stripe";
import { monthlyAllowanceForPlan, type Plan } from "./credits";

export type PaidPlan = Exclude<Plan, "free">;

export function priceIdForPaidPlan(plan: PaidPlan) {
  return plan === "pro_plus"
    ? process.env.STRIPE_PRICE_ID_PRO_PLUS
    : process.env.STRIPE_PRICE_ID_PRO;
}

export function paidPlanFromPriceId(
  priceId: string | null | undefined
): PaidPlan | null {
  if (!priceId) return null;
  const pro = process.env.STRIPE_PRICE_ID_PRO;
  const proPlus = process.env.STRIPE_PRICE_ID_PRO_PLUS;
  if (pro && priceId === pro) return "pro";
  if (proPlus && priceId === proPlus) return "pro_plus";
  return null;
}

export function subscriptionPriceId(subscription: Stripe.Subscription) {
  const price = subscription.items?.data?.[0]?.price;
  if (!price) return null;
  return typeof price === "string" ? price : price.id || null;
}

export function checkoutSessionPriceId(session: Stripe.Checkout.Session) {
  const item = session.line_items?.data?.[0];
  const price = item?.price;
  if (!price) return null;
  return typeof price === "string" ? price : price.id || null;
}

const ENDED_SUBSCRIPTION_STATUSES = new Set(["canceled", "incomplete_expired"]);

/** Subscriptions that have not ended, including past_due, unpaid, incomplete and paused. */
export async function listOpenSubscriptions(
  stripe: Stripe,
  customerId: string
) {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });
  return subscriptions.data.filter(
    (subscription) => !ENDED_SUBSCRIPTION_STATUSES.has(subscription.status)
  );
}

export function isEntitledSubscription(subscription: Stripe.Subscription) {
  return subscription.status === "active" || subscription.status === "trialing";
}

export class UnknownSubscriptionPriceError extends Error {
  constructor(
    readonly subscriptionId: string,
    readonly priceId: string | null
  ) {
    super("Unknown subscription price");
  }
}

/**
 * The best paid plan among the customer's active or trialing subscriptions,
 * read fresh from Stripe. Returns null when none remain.
 */
export async function currentPaidPlan(
  stripe: Stripe,
  customerId: string,
  excludeSubscriptionId?: string
): Promise<{ plan: PaidPlan; periodEnd: number | null } | null> {
  const subscriptions = await listOpenSubscriptions(stripe, customerId);
  let best: { plan: PaidPlan; periodEnd: number | null } | null = null;
  for (const subscription of subscriptions) {
    if (subscription.id === excludeSubscriptionId) continue;
    if (!isEntitledSubscription(subscription)) continue;
    const priceId = subscriptionPriceId(subscription);
    const plan = paidPlanFromPriceId(priceId);
    if (!plan) throw new UnknownSubscriptionPriceError(subscription.id, priceId);
    if (
      !best ||
      monthlyAllowanceForPlan(plan) > monthlyAllowanceForPlan(best.plan)
    ) {
      best = {
        plan,
        periodEnd: subscription.items?.data?.[0]?.current_period_end ?? null,
      };
    }
  }
  return best;
}

export function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  const subscription = invoice.parent?.subscription_details?.subscription;
  if (!subscription) return null;
  return typeof subscription === "string" ? subscription : subscription.id;
}

export function invoiceLinePriceId(line: Stripe.InvoiceLineItem) {
  const price = line.pricing?.price_details?.price;
  if (!price) return null;
  return typeof price === "string" ? price : price.id || null;
}

export function isProrationLine(line: Stripe.InvoiceLineItem) {
  return Boolean(
    line.parent?.subscription_item_details?.proration ||
      line.parent?.invoice_item_details?.proration
  );
}

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(secretKey);
}

export async function getOrCreateCustomer(stripe: Stripe, userId: string) {
  const existing = await stripe.customers.search({
    query: `metadata['clerkUserId']:'${userId}'`,
    limit: 1,
  });

  if (existing.data[0]) {
    return existing.data[0];
  }

  // Search results can lag behind writes, so a fast second request may miss
  // the customer just created; the idempotency key returns that same customer.
  return stripe.customers.create(
    { metadata: { clerkUserId: userId } },
    { idempotencyKey: `customer-create:${userId}` }
  );
}

export async function findCustomerByUserId(stripe: Stripe, userId: string) {
  const existing = await stripe.customers.search({
    query: `metadata['clerkUserId']:'${userId}'`,
    limit: 1,
  });
  return existing.data[0] || null;
}

export function customerIdOf(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
) {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

export async function resolveClerkUserId(
  stripe: Stripe,
  source: {
    customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null;
    client_reference_id?: string | null;
    metadata?: Stripe.Metadata | null;
  }
) {
  const fromMeta = source.metadata?.clerkUserId;
  if (typeof fromMeta === "string" && fromMeta) return fromMeta;

  const customerId = customerIdOf(source.customer ?? null);
  if (customerId) {
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted && customer.metadata?.clerkUserId) {
      return customer.metadata.clerkUserId;
    }
  }

  if (typeof source.client_reference_id === "string" && source.client_reference_id) {
    return source.client_reference_id;
  }

  return null;
}
