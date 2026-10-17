import { clerkClient } from "@clerk/nextjs/server";
import type Stripe from "stripe";
import {
  claimStripeEvent,
  grantMonthlyCreditsOnce,
  grantPurchasedCreditsOnce,
  monthlyAllowanceForPlan,
  releaseStripeEvent,
  resetMonthlyCredits,
  TOPUP_CREDITS,
} from "@/lib/credits";
import { nextMonthResetAt } from "@/lib/resetMonthly";
import {
  checkoutSessionPriceId,
  currentPaidPlan,
  customerIdOf,
  getStripe,
  invoiceLinePriceId,
  invoiceSubscriptionId,
  isProrationLine,
  paidPlanFromPriceId,
  resolveClerkUserId,
  UnknownSubscriptionPriceError,
  type PaidPlan,
} from "@/lib/stripe";

export const runtime = "nodejs";

type Clerk = Awaited<ReturnType<typeof clerkClient>>;
type CurrentPlan = Awaited<ReturnType<typeof currentPaidPlan>>;

const MONTHLY_GRANT_REASONS = new Set([
  "subscription_create",
  "subscription_cycle",
]);

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripe();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  let claimed = false;
  try {
    claimed = await claimStripeEvent(event.id);
  } catch (err) {
    console.error("stripe webhook idempotency error:", err);
    return new Response("Idempotency check failed", { status: 500 });
  }
  if (!claimed) {
    return new Response("ok", { status: 200 });
  }

  try {
    return await handleClaimedEvent(stripe, event);
  } catch (err) {
    console.error("stripe webhook processing error:", event.id, err);
    try {
      await releaseStripeEvent(event.id);
    } catch (releaseErr) {
      console.error("stripe webhook release error:", event.id, releaseErr);
    }
    return new Response("Webhook processing failed", { status: 500 });
  }
}

async function rejectEvent(
  eventId: string,
  message: string,
  ...details: unknown[]
) {
  console.error(`Stripe webhook ${message}:`, ...details);
  await releaseStripeEvent(eventId);
  return new Response(message, { status: 400 });
}

/** Writes the plan label only. Credits are never changed here. */
async function writePlanLabel(clerk: Clerk, userId: string, current: CurrentPlan) {
  await clerk.users.updateUserMetadata(userId, {
    publicMetadata: current
      ? {
          plan: current.plan,
          pro: true,
          ...(current.periodEnd
            ? { tokensResetAt: new Date(current.periodEnd * 1000).toISOString() }
            : {}),
        }
      : { plan: "free", pro: false },
  });
}

async function handleClaimedEvent(
  stripe: Stripe,
  event: Stripe.Event
): Promise<Response> {
  try {
    return await dispatchEvent(stripe, event);
  } catch (err) {
    if (err instanceof UnknownSubscriptionPriceError) {
      return rejectEvent(
        event.id,
        "Unknown subscription price",
        err.subscriptionId,
        err.priceId
      );
    }
    throw err;
  }
}

async function dispatchEvent(
  stripe: Stripe,
  event: Stripe.Event
): Promise<Response> {
  const clerk = await clerkClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = await resolveClerkUserId(stripe, session);
    if (!userId) {
      return rejectEvent(event.id, "Missing user id", event.type, session.id);
    }

    const isCredits =
      session.mode === "payment" || session.metadata?.type === "credits";

    if (isCredits) {
      const expanded = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["line_items"],
      });
      const priceId = checkoutSessionPriceId(expanded);
      const tokenPrice = process.env.STRIPE_TOKEN_PRICE_ID;
      if (!tokenPrice || !priceId || priceId !== tokenPrice) {
        return rejectEvent(event.id, "Unknown top-up price", session.id, priceId);
      }
      const grant = Number(process.env.STRIPE_TOKEN_GRANT || TOPUP_CREDITS);
      await grantPurchasedCreditsOnce(
        userId,
        session.id,
        Number.isFinite(grant) && grant > 0 ? Math.floor(grant) : TOPUP_CREDITS
      );
      return new Response("ok", { status: 200 });
    }

    // Subscription credits come from the paid invoice, not from Checkout.
    const customerId = customerIdOf(session.customer ?? null);
    if (!customerId) {
      return rejectEvent(event.id, "Missing customer", event.type, session.id);
    }
    await writePlanLabel(clerk, userId, await currentPaidPlan(stripe, customerId));
    return new Response("ok", { status: 200 });
  }

  if (event.type === "customer.subscription.updated") {
    // The payload may be stale or out of order, so only fresh Stripe state is
    // used, and plan changes alone never grant credits.
    const subscription = event.data.object;
    const userId = await resolveClerkUserId(stripe, subscription);
    const customerId = customerIdOf(subscription.customer);
    if (!userId || !customerId) {
      return rejectEvent(event.id, "Missing user id", event.type, subscription.id);
    }
    await writePlanLabel(clerk, userId, await currentPaidPlan(stripe, customerId));
    return new Response("ok", { status: 200 });
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;
    const userId = await resolveClerkUserId(stripe, subscription);
    const customerId = customerIdOf(subscription.customer);
    if (!userId || !customerId) {
      return rejectEvent(event.id, "Missing user id", event.type, subscription.id);
    }
    const remaining = await currentPaidPlan(stripe, customerId, subscription.id);
    if (remaining) {
      await writePlanLabel(clerk, userId, remaining);
      return new Response("ok", { status: 200 });
    }
    // Credits are written before the plan so that a retry after a failed Clerk
    // update re-applies the free reset.
    await resetMonthlyCredits(userId, "free");
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: { plan: "free", pro: false, tokensResetAt: nextMonthResetAt() },
    });
    return new Response("ok", { status: 200 });
  }

  if (event.type === "invoice.paid") {
    return handleInvoicePaid(stripe, clerk, event);
  }

  return new Response("ok", { status: 200 });
}

async function invoiceLines(stripe: Stripe, invoice: Stripe.Invoice) {
  if (!invoice.lines?.has_more) return invoice.lines?.data ?? [];
  const lines = await stripe.invoices.listLineItems(invoice.id!, { limit: 100 });
  return lines.data;
}

async function handleInvoicePaid(
  stripe: Stripe,
  clerk: Clerk,
  event: Stripe.InvoicePaidEvent
): Promise<Response> {
  const eventInvoice = event.data.object;
  if (!eventInvoice.id) return new Response("ok", { status: 200 });

  // Re-read the invoice so that only Stripe's current state can grant credits.
  const invoice = await stripe.invoices.retrieve(eventInvoice.id);
  const invoiceId = invoice.id!;
  const reason = invoice.billing_reason ?? "";
  const isMonthly = MONTHLY_GRANT_REASONS.has(reason);
  const isUpgrade = reason === "subscription_update";
  if (invoice.status !== "paid" || (!isMonthly && !isUpgrade)) {
    return new Response("ok", { status: 200 });
  }

  const subscriptionId = invoiceSubscriptionId(invoice);
  const customerId = customerIdOf(invoice.customer ?? null);
  const userId = await resolveClerkUserId(stripe, {
    customer: invoice.customer,
    metadata: invoice.parent?.subscription_details?.metadata ?? null,
  });
  if (!subscriptionId || !customerId || !userId) {
    return rejectEvent(event.id, "Missing user id", event.type, invoiceId);
  }

  const lines = await invoiceLines(stripe, invoice);

  if (isMonthly) {
    const planLine = lines.find(
      (line) =>
        !isProrationLine(line) &&
        line.amount >= 0 &&
        paidPlanFromPriceId(invoiceLinePriceId(line))
    );
    const plan = planLine ? paidPlanFromPriceId(invoiceLinePriceId(planLine)) : null;
    if (!plan) {
      return rejectEvent(event.id, "Unknown subscription price", invoiceId);
    }
    await grantMonthlyCreditsOnce(
      userId,
      [invoiceId],
      monthlyAllowanceForPlan(plan),
      "set"
    );
  } else {
    // A verified upgrade invoice credits the unused old plan (negative
    // proration) and charges the new plan (positive proration).
    let fromPlan: PaidPlan | null = null;
    let toPlan: PaidPlan | null = null;
    let periodEnd: number | null = null;
    for (const line of lines) {
      if (!isProrationLine(line)) continue;
      const plan = paidPlanFromPriceId(invoiceLinePriceId(line));
      if (!plan) continue;
      if (line.amount < 0) fromPlan = plan;
      if (line.amount > 0) {
        toPlan = plan;
        periodEnd = line.period?.end ?? null;
      }
    }
    const difference =
      fromPlan && toPlan
        ? monthlyAllowanceForPlan(toPlan) - monthlyAllowanceForPlan(fromPlan)
        : 0;
    if (difference > 0 && periodEnd) {
      // At most one upgrade grant per subscription billing period.
      await grantMonthlyCreditsOnce(
        userId,
        [invoiceId, `upgrade:${subscriptionId}:${periodEnd}`],
        difference,
        "add"
      );
    }
  }

  await writePlanLabel(clerk, userId, await currentPaidPlan(stripe, customerId));
  return new Response("ok", { status: 200 });
}
