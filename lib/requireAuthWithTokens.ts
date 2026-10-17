import { auth, clerkClient, type User } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getCredits, type Plan } from "./credits";
import {
  ensureInboundToken,
  inboundAddressForToken,
} from "./inboundToken";
import { ensureMonthlyCredits } from "./resetMonthly";

export const OUT_OF_TOKENS = "You are out of tokens — upgrade or buy more.";

export type CreditContext = {
  userId: string;
  user: User;
  plan: Plan;
  pro: boolean;
  credits: number;
  resetAt: string;
  inboundAddress: string;
};

export async function loadCreditContext(
  userId: string
): Promise<CreditContext> {
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  const { plan, pro, resetAt } = await ensureMonthlyCredits(user);
  const inboundToken = await ensureInboundToken(user);
  const credits = await getCredits(userId);
  return {
    userId,
    user,
    plan,
    pro,
    credits,
    resetAt,
    inboundAddress: inboundAddressForToken(inboundToken),
  };
}

export async function requireAuthWithTokens() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return loadCreditContext(userId);
}

export async function requirePageCredits() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const ctx = await loadCreditContext(userId);
  if (!ctx.pro && ctx.credits === 0) {
    redirect("/billing?out_of_tokens=true");
  }
  return ctx;
}
