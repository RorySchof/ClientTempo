import { Redis } from "@upstash/redis";

export type Plan = "free" | "pro" | "pro_plus";

export const FREE_MONTHLY = 50;
export const PRO_MONTHLY = 1000;
export const PRO_PLUS_MONTHLY = 2500;
export const TOPUP_CREDITS = 1000;

export function parsePlan(value: unknown): Plan {
  if (value === "pro" || value === "pro_plus") return value;
  return "free";
}

export function monthlyAllowanceForPlan(plan: Plan) {
  if (plan === "pro_plus") return PRO_PLUS_MONTHLY;
  if (plan === "pro") return PRO_MONTHLY;
  return FREE_MONTHLY;
}

export function isPaidPlan(plan: Plan) {
  return plan === "pro" || plan === "pro_plus";
}

export function planLabel(plan: Plan) {
  if (plan === "pro_plus") return "Pro Plus";
  if (plan === "pro") return "Pro";
  return "Free";
}

const STORAGE_ERROR = "Storage is not configured.";

function redis() {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    throw new Error(STORAGE_ERROR);
  }
  return Redis.fromEnv();
}

function monthlyKey(userId: string) {
  return `credits:${userId}:monthly`;
}

function purchasedKey(userId: string) {
  return `credits:${userId}:purchased`;
}

function eventsKey(userId: string) {
  return `credits:${userId}:events`;
}

function asCount(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export async function hasMonthlyCredits(userId: string) {
  const value = await redis().get(monthlyKey(userId));
  return value != null;
}

export async function getCreditBalances(userId: string) {
  const r = redis();
  const [monthly, purchased] = await Promise.all([
    r.get(monthlyKey(userId)),
    r.get(purchasedKey(userId)),
  ]);
  return {
    monthly: asCount(monthly),
    purchased: asCount(purchased),
  };
}

export async function getCredits(userId: string) {
  const { monthly, purchased } = await getCreditBalances(userId);
  return monthly + purchased;
}

/** Sets the monthly bucket only. Purchased tokens are untouched. */
export async function setCredits(userId: string, value: number) {
  const n = Math.max(0, Math.floor(Number(value) || 0));
  await redis().set(monthlyKey(userId), n);
  return n;
}

export async function addPurchasedCredits(userId: string, amount: number) {
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  if (!n) return getCredits(userId);
  await redis().incrby(purchasedKey(userId), n);
  return getCredits(userId);
}

// Runs atomically. The marker is written only after INCRBY succeeds, so a
// failed increment leaves nothing behind and a retry can still grant.
const GRANT_ONCE_SCRIPT = `
if redis.call("EXISTS", KEYS[1]) == 1 then
  return 0
end
redis.call("INCRBY", KEYS[2], ARGV[1])
redis.call("SET", KEYS[1], "1")
return 1
`;

/** Adds purchased credits once per grantId (e.g. a Stripe Checkout Session). */
export async function grantPurchasedCreditsOnce(
  userId: string,
  grantId: string,
  amount: number
): Promise<boolean> {
  const id = String(grantId || "").trim();
  if (!id) throw new Error("grantId is required");
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  if (!n) return false;
  const result = await redis().eval(
    GRANT_ONCE_SCRIPT,
    [`stripe:grant:${id}`, purchasedKey(userId)],
    [String(n)]
  );
  return Number(result) === 1;
}

// KEYS[1..n-1] are grant markers and KEYS[n] is the monthly bucket. Nothing is
// written if any marker exists, and markers are written only after the credit
// write, all inside one atomic script.
const MONTHLY_GRANT_ONCE_SCRIPT = `
for i = 1, #KEYS - 1 do
  if redis.call("EXISTS", KEYS[i]) == 1 then
    return 0
  end
end
if ARGV[2] == "set" then
  redis.call("SET", KEYS[#KEYS], ARGV[1])
else
  redis.call("INCRBY", KEYS[#KEYS], ARGV[1])
end
for i = 1, #KEYS - 1 do
  redis.call("SET", KEYS[i], "1")
end
return 1
`;

/**
 * Sets ("set") or adds to ("add") the monthly bucket once. Returns false
 * without writing if any of the grant IDs was already used.
 */
export async function grantMonthlyCreditsOnce(
  userId: string,
  grantIds: string[],
  amount: number,
  mode: "set" | "add"
): Promise<boolean> {
  const ids = grantIds.map((id) => String(id || "").trim());
  if (!ids.length || ids.some((id) => !id)) {
    throw new Error("grantIds are required");
  }
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  if (mode === "add" && !n) return false;
  const result = await redis().eval(
    MONTHLY_GRANT_ONCE_SCRIPT,
    [...ids.map((id) => `stripe:grant:${id}`), monthlyKey(userId)],
    [String(n), mode]
  );
  return Number(result) === 1;
}

export async function resetMonthlyCredits(userId: string, plan: Plan) {
  return setCredits(userId, monthlyAllowanceForPlan(parsePlan(plan)));
}

export type CreditBucket = "monthly" | "purchased";
export type ConsumeResult = false | { source: CreditBucket };

async function logCreditEvent(
  userId: string,
  type: "consumed" | "purchased" | "reset" | "refunded",
  amount: number
) {
  await redis().lpush(
    eventsKey(userId),
    JSON.stringify({
      type,
      amount,
      at: new Date().toISOString(),
    })
  );
  await redis().ltrim(eventsKey(userId), 0, 199);
}

export async function listCreditEvents(userId: string) {
  const raw = await redis().lrange(eventsKey(userId), 0, 199);
  const rows = Array.isArray(raw) ? raw : [];
  return rows
    .map((item) => {
      if (item && typeof item === "object" && "type" in item) {
        return item as { type: string; amount: number; at?: string };
      }
      if (typeof item !== "string") return null;
      try {
        return JSON.parse(item) as { type: string; amount: number; at?: string };
      } catch {
        return null;
      }
    })
    .filter((item): item is { type: string; amount: number; at?: string } =>
      Boolean(item && item.type)
    );
}

/** Monthly first, then purchased. Returns false if none left. */
export async function consumeCredits(
  userId: string,
  amount = 1
): Promise<ConsumeResult> {
  const n = Math.max(1, Math.floor(amount));
  const r = redis();
  const monthly = Number(await r.decrby(monthlyKey(userId), n));
  if (monthly >= 0) {
    await logCreditEvent(userId, "consumed", n);
    return { source: "monthly" };
  }
  await r.incrby(monthlyKey(userId), n);
  const purchased = Number(await r.decrby(purchasedKey(userId), n));
  if (purchased >= 0) {
    await logCreditEvent(userId, "consumed", n);
    return { source: "purchased" };
  }
  await r.incrby(purchasedKey(userId), n);
  return false;
}

/** Restore credits to the same bucket that consumeCredits used. */
export async function refundCredits(
  userId: string,
  source: CreditBucket,
  amount = 1
) {
  if (source !== "monthly" && source !== "purchased") {
    throw new Error("Invalid credit refund source");
  }
  const n = Math.max(1, Math.floor(amount));
  const key = source === "monthly" ? monthlyKey(userId) : purchasedKey(userId);
  await redis().incrby(key, n);
  await logCreditEvent(userId, "refunded", n);
}

function inboundMessageKey(messageId: string) {
  return `inbound:msg:${messageId}`;
}

export async function claimInboundMessage(messageId: string) {
  const id = String(messageId || "").trim();
  if (!id) return false;
  const result = await redis().set(inboundMessageKey(id), "1", {
    nx: true,
    ex: 60 * 60 * 24 * 7,
  });
  return result === "OK";
}

export async function releaseInboundMessage(messageId: string) {
  const id = String(messageId || "").trim();
  if (!id) return;
  await redis().del(inboundMessageKey(id));
}

export async function claimStripeEvent(eventId: string) {
  const result = await redis().set(`stripe:event:${eventId}`, "1", {
    nx: true,
    ex: 60 * 60 * 24 * 7,
  });
  return result === "OK";
}

export async function releaseStripeEvent(eventId: string) {
  await redis().del(`stripe:event:${eventId}`);
}
