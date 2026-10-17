import { auth } from "@clerk/nextjs/server";
import {
  getOrCreateCustomer,
  getStripe,
  listOpenSubscriptions,
  priceIdForPaidPlan,
  type PaidPlan,
} from "@/lib/stripe";

export const runtime = "nodejs";

const CHECKOUT_DEDUPE_WINDOW_MS = 10 * 60 * 1000;

function requestedPaidPlan(value: unknown): PaidPlan {
  return value === "pro_plus" ? "pro_plus" : "pro";
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let kind = "subscription";
    let plan: PaidPlan = "pro";
    try {
      const body = (await request.json()) as { kind?: string; plan?: string };
      if (body?.kind === "credits") kind = "credits";
      plan = requestedPaidPlan(body?.plan);
    } catch {
      kind = "subscription";
      plan = "pro";
    }

    const buyCredits = kind === "credits";
    const priceId = buyCredits
      ? process.env.STRIPE_TOKEN_PRICE_ID
      : priceIdForPaidPlan(plan);
    if (!priceId) {
      console.error(
        "stripe checkout error: missing price configuration for",
        buyCredits ? "credits" : plan
      );
      return Response.json(
        { error: "Billing is not available right now." },
        { status: 500 }
      );
    }

    const stripe = getStripe();
    const customer = await getOrCreateCustomer(stripe, userId);
    const origin = new URL(request.url).origin;

    if (!buyCredits) {
      // Existing subscribers (including past_due, unpaid, incomplete and
      // paused) change or fix their plan in the Billing Portal, never here.
      const open = await listOpenSubscriptions(stripe, customer.id);
      if (open.length > 0) {
        const portal = await stripe.billingPortal.sessions.create({
          customer: customer.id,
          return_url: `${origin}/billing`,
        });
        if (!portal.url) {
          return Response.json(
            { error: "Couldn't open the billing portal." },
            { status: 500 }
          );
        }
        return Response.json({ url: portal.url, portal: true });
      }
    }

    const session = buyCredits
      ? await stripe.checkout.sessions.create({
          mode: "payment",
          customer: customer.id,
          client_reference_id: userId,
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: `${origin}/billing?tokens=true`,
          cancel_url: `${origin}/billing?canceled=true`,
          metadata: { clerkUserId: userId, type: "credits" },
        })
      : await stripe.checkout.sessions.create(
          {
            mode: "subscription",
            customer: customer.id,
            client_reference_id: userId,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${origin}/billing?success=true`,
            cancel_url: `${origin}/billing?canceled=true`,
            metadata: { clerkUserId: userId, type: "subscription", plan },
            subscription_data: { metadata: { clerkUserId: userId, plan } },
          },
          {
            // Repeated clicks within the window reuse one Checkout Session.
            idempotencyKey: `checkout-subscription:${userId}:${plan}:${new URL(origin).host}:${Math.floor(
              Date.now() / CHECKOUT_DEDUPE_WINDOW_MS
            )}`,
          }
        );

    if (!session.url) {
      return Response.json(
        { error: "Couldn't start checkout." },
        { status: 500 }
      );
    }

    return Response.json({ url: session.url });
  } catch (err) {
    console.error(
      "stripe checkout error:",
      err instanceof Error ? err.message : err
    );
    return Response.json({ error: "Couldn't start checkout." }, { status: 500 });
  }
}
