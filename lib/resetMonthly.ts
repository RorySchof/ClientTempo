import { clerkClient, type User } from "@clerk/nextjs/server";
import {
  hasMonthlyCredits,
  isPaidPlan,
  parsePlan,
  resetMonthlyCredits,
  type Plan,
} from "./credits";

export function nextMonthResetAt(from = new Date()) {
  return new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1)
  ).toISOString();
}

function metadataValue(user: Pick<User, "publicMetadata">, key: string) {
  const metadata = user.publicMetadata as Record<string, unknown> | undefined;
  return metadata?.[key];
}

export function getUserPlan(user: Pick<User, "publicMetadata">): Plan {
  const plan = parsePlan(metadataValue(user, "plan"));
  if (plan !== "free") return plan;
  if (metadataValue(user, "pro") === true) return "pro";
  return "free";
}

export function isProUser(user: Pick<User, "publicMetadata">) {
  return isPaidPlan(getUserPlan(user));
}

export async function ensureMonthlyCredits(user: User) {
  const plan = getUserPlan(user);
  const pro = isPaidPlan(plan);
  const raw = metadataValue(user, "tokensResetAt");
  const resetAt =
    typeof raw === "string" && raw && !Number.isNaN(new Date(raw).getTime())
      ? new Date(raw)
      : null;

  // Paid allowances come only from paid Stripe invoices (see the webhook).
  if (pro) {
    return { plan, pro, resetAt: resetAt ? resetAt.toISOString() : "" };
  }

  const monthlyExists = await hasMonthlyCredits(user.id);

  if (resetAt && Date.now() < resetAt.getTime() && monthlyExists) {
    return { plan, pro, resetAt: resetAt.toISOString() };
  }

  await resetMonthlyCredits(user.id, plan);
  const tokensResetAt = nextMonthResetAt();
  const clerk = await clerkClient();
  await clerk.users.updateUserMetadata(user.id, {
    publicMetadata: { tokensResetAt },
  });
  return { plan, pro, resetAt: tokensResetAt };
}
