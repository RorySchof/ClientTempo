import { auth } from "@clerk/nextjs/server";
import { findCustomerByUserId, getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stripe = getStripe();
    const customer = await findCustomerByUserId(stripe, userId);
    if (!customer) {
      return Response.json(
        { error: "No billing customer found" },
        { status: 404 }
      );
    }

    const origin = new URL(request.url).origin;
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${origin}/billing`,
    });

    if (!session.url) {
      return Response.json(
        { error: "Couldn't open the billing portal." },
        { status: 500 }
      );
    }

    return Response.json({ url: session.url });
  } catch (err) {
    console.error(
      "stripe portal error:",
      err instanceof Error ? err.message : err
    );
    return Response.json(
      { error: "Couldn't open the billing portal." },
      { status: 500 }
    );
  }
}
