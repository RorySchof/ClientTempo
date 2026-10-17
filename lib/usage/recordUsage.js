import { Redis } from "@upstash/redis";
import { fromGroqResponse } from "./fromGroqResponse.js";

export const USAGE_EVENTS_LIMIT = 200;

const EVENT_FIELDS = [
  "timestamp",
  "userId",
  "tool",
  "model",
  "groq_id",
  "groq_request_id",
  "prompt_tokens",
  "cached_tokens",
  "completion_tokens",
  "reasoning_tokens",
  "total_tokens",
  "uncached_input_tokens",
  "cost_micros",
  "rates_version",
];

export function usageEventsKey(userId) {
  return `usage:${userId}:events`;
}

function redisOrNull() {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return null;
  }
  return Redis.fromEnv();
}

function sanitizeEvent(event) {
  const out = {};
  for (const key of EVENT_FIELDS) {
    out[key] = event[key];
  }
  return out;
}

function parseEvent(item) {
  if (item && typeof item === "object") {
    return sanitizeEvent(item);
  }
  if (typeof item !== "string") return null;
  try {
    return sanitizeEvent(JSON.parse(item));
  } catch {
    return null;
  }
}

/**
 * Shadow ledger write. Never throws; never touches credit keys.
 */
export async function recordUsage({ userId, tool, response } = {}) {
  if (typeof userId !== "string" || !userId.trim()) return null;
  const event = fromGroqResponse(response, { userId: userId.trim(), tool });
  if (!event) return null;

  const r = redisOrNull();
  if (!r) return event;

  const stored = sanitizeEvent(event);
  try {
    const key = usageEventsKey(userId.trim());
    await r.lpush(key, JSON.stringify(stored));
    await r.ltrim(key, 0, USAGE_EVENTS_LIMIT - 1);
  } catch (err) {
    console.error("[usage] recordUsage failed:", err?.message || err);
  }
  return stored;
}

export async function listUsageEvents(userId) {
  const r = redisOrNull();
  if (!r || typeof userId !== "string" || !userId.trim()) return [];
  const raw = await r.lrange(usageEventsKey(userId.trim()), 0, USAGE_EVENTS_LIMIT - 1);
  const rows = Array.isArray(raw) ? raw : [];
  return rows.map(parseEvent).filter((item) => item && item.timestamp);
}
