import { randomBytes } from "crypto";
import { clerkClient, type User } from "@clerk/nextjs/server";
import { Redis } from "@upstash/redis";

export const INBOUND_MAILGUN_DOMAIN = (
  process.env.MAILGUN_DOMAIN ||
  "sandbox581c1ba7b28c470c993618fc80717219.mailgun.org"
).trim();

const TOKEN_RE = /^[a-f0-9]{32}$/;

function redis() {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    throw new Error("Storage is not configured.");
  }
  return Redis.fromEnv();
}

function tokenKey(token: string) {
  return `inbound:token:${token}`;
}

export function inboundAddressForToken(token: string) {
  return `rpl_${token}@${INBOUND_MAILGUN_DOMAIN}`;
}

export function parseInboundToken(recipient: string) {
  const raw = String(recipient || "").trim();
  if (!raw) return null;
  const angle = raw.match(/<([^>]+)>/);
  const email = (angle ? angle[1] : raw).trim().toLowerCase();
  const local = email.split("@")[0] || "";
  const match = local.match(/^rpl_([a-f0-9]{32})$/);
  return match?.[1] || null;
}

export async function resolveUserIdFromRecipient(recipient: string) {
  const token = parseInboundToken(recipient);
  if (!token) return null;
  const userId = await redis().get<string>(tokenKey(token));
  return typeof userId === "string" && userId ? userId : null;
}

export async function ensureInboundToken(user: User) {
  const existing = (user.publicMetadata as Record<string, unknown> | undefined)
    ?.inboundToken;
  if (typeof existing === "string" && TOKEN_RE.test(existing)) {
    const mapped = await redis().get<string>(tokenKey(existing));
    if (mapped !== user.id) {
      await redis().set(tokenKey(existing), user.id);
    }
    return existing;
  }

  const token = randomBytes(16).toString("hex");
  await redis().set(tokenKey(token), user.id);
  const clerk = await clerkClient();
  await clerk.users.updateUserMetadata(user.id, {
    publicMetadata: { inboundToken: token },
  });
  return token;
}
