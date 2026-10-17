/**
 * Isolated shadow usage-ledger tests.
 * Uses only usage:local-usage-test-*:events. Does not call Groq, Stripe, or Mailgun.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { randomBytes } from "crypto";

const ROOT = resolve(import.meta.dirname, "..");

function loadEnv() {
  const env = {};
  const text = readFileSync(resolve(ROOT, ".env.local"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw || raw.startsWith("#") || !raw.includes("=")) continue;
    const i = raw.indexOf("=");
    env[raw.slice(0, i).trim()] = raw.slice(i + 1).trim();
  }
  return env;
}

const env = loadEnv();
for (const [key, value] of Object.entries(env)) {
  if (process.env[key] == null) process.env[key] = value;
}

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error(
    "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN required for local usage tests"
  );
}

const {
  extractGroqUsage,
  costMicrosForUsage,
  fromGroqResponse,
} = await import("../lib/usage/fromGroqResponse.js");
const { USAGE_RATES_VERSION } = await import("../lib/usage/modelRates.js");
const {
  recordUsage,
  listUsageEvents,
  usageEventsKey,
  USAGE_EVENTS_LIMIT,
} = await import("../lib/usage/recordUsage.js");

function groqResponse({
  model = "openai/gpt-oss-120b",
  prompt = 1000,
  cached = 0,
  completion = 100,
  reasoning = 20,
  total,
  id = "chatcmpl-test",
  requestId = "req_test",
} = {}) {
  return {
    id,
    model,
    x_groq: { id: requestId },
    choices: [
      {
        message: {
          content:
            "Hello Jane Doe at jane@example.com — 123 Main Street looks great.",
        },
      },
    ],
    usage: {
      prompt_tokens: prompt,
      completion_tokens: completion,
      total_tokens: total ?? prompt + completion,
      prompt_tokens_details: { cached_tokens: cached },
      completion_tokens_details: { reasoning_tokens: reasoning },
    },
  };
}

function expectedMicros({ uncached, cached, completion }) {
  return Math.round((uncached * 150000 + cached * 75000 + completion * 600000) / 1_000_000);
}

async function redisCommand(command) {
  const res = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`Redis command failed: ${res.status}`);
  return res.json();
}

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function source(relPath) {
  return readFileSync(resolve(ROOT, relPath), "utf8");
}

const ALLOWED_EVENT_KEYS = [
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

const PII_SNIPPETS = [
  "Jane Doe",
  "jane@example.com",
  "123 Main Street",
  "choices",
  "message",
  "content",
];

const userId = `local-usage-test-${randomBytes(4).toString("hex")}`;

try {
  const uncachedOnly = extractGroqUsage(
    groqResponse({ prompt: 1000, cached: 0, completion: 0, reasoning: 0 })
  );
  record(
    "uncached input is prompt_tokens when nothing is cached",
    uncachedOnly.uncached_input_tokens === 1000 &&
      costMicrosForUsage(uncachedOnly) === expectedMicros({ uncached: 1000, cached: 0, completion: 0 }),
    `uncached=${uncachedOnly.uncached_input_tokens} micros=${costMicrosForUsage(uncachedOnly)}`
  );

  const cachedOnly = extractGroqUsage(
    groqResponse({ prompt: 1000, cached: 1000, completion: 0, reasoning: 0 })
  );
  record(
    "fully cached input is cheaper than uncached",
    cachedOnly.uncached_input_tokens === 0 &&
      costMicrosForUsage(cachedOnly) === expectedMicros({ uncached: 0, cached: 1000, completion: 0 }) &&
      costMicrosForUsage(cachedOnly) < costMicrosForUsage(uncachedOnly),
    `cachedMicros=${costMicrosForUsage(cachedOnly)} uncachedMicros=${costMicrosForUsage(uncachedOnly)}`
  );

  const mixed = extractGroqUsage(
    groqResponse({ prompt: 2000, cached: 500, completion: 100, reasoning: 40 })
  );
  record(
    "mixed cached/uncached uses max(prompt - cached, 0)",
    mixed.uncached_input_tokens === 1500 &&
      costMicrosForUsage(mixed) === expectedMicros({ uncached: 1500, cached: 500, completion: 100 }),
    `uncached=${mixed.uncached_input_tokens} micros=${costMicrosForUsage(mixed)}`
  );

  const overCached = extractGroqUsage(
    groqResponse({ prompt: 100, cached: 250, completion: 0 })
  );
  record(
    "cached tokens above prompt do not go negative",
    overCached.uncached_input_tokens === 0,
    `uncached=${overCached.uncached_input_tokens}`
  );

  const integerEvent = fromGroqResponse(
    groqResponse({ prompt: 1000, cached: 0, completion: 100 }),
    { userId: "u1", tool: "realgpt" }
  );
  record(
    "cost_micros is an integer",
    Number.isInteger(integerEvent.cost_micros) && integerEvent.cost_micros === 210,
    `cost_micros=${integerEvent?.cost_micros}`
  );

  const halfUp = costMicrosForUsage(
    extractGroqUsage(groqResponse({ prompt: 10, cached: 0, completion: 0 }))
  );
  const belowHalf = costMicrosForUsage(
    extractGroqUsage(groqResponse({ prompt: 1, cached: 0, completion: 0 }))
  );
  const exactOne = costMicrosForUsage(
    extractGroqUsage(groqResponse({ prompt: 0, cached: 0, completion: 1 }))
  );
  record(
    "rounding uses integer micro-USD (0.15→0, 1.50→2, 0.60→1)",
    belowHalf === 0 && halfUp === 2 && exactOne === 1,
    `1tok=${belowHalf} 10tok=${halfUp} 1out=${exactOne}`
  );

  const withReasoning = extractGroqUsage(
    groqResponse({ prompt: 0, cached: 0, completion: 100, reasoning: 40 })
  );
  const withoutReasoning = extractGroqUsage(
    groqResponse({ prompt: 0, cached: 0, completion: 100, reasoning: 0 })
  );
  record(
    "reasoning tokens are not charged separately",
    withReasoning.reasoning_tokens === 40 &&
      costMicrosForUsage(withReasoning) === costMicrosForUsage(withoutReasoning) &&
      costMicrosForUsage(withReasoning) === expectedMicros({ uncached: 0, cached: 0, completion: 100 }),
    `with=${costMicrosForUsage(withReasoning)} without=${costMicrosForUsage(withoutReasoning)}`
  );

  const unknown = fromGroqResponse(
    groqResponse({ model: "openai/gpt-oss-20b", prompt: 1000, completion: 100 }),
    { userId: "u1", tool: "realgpt" }
  );
  const unknownCost = costMicrosForUsage(
    extractGroqUsage(
      groqResponse({ model: "some-other-model", prompt: 5000, completion: 500 })
    )
  );
  record(
    "unknown models fail closed (no price)",
    unknown === null && unknownCost === null,
    `event=${unknown} cost=${unknownCost}`
  );

  const piiSource = groqResponse({ prompt: 800, cached: 100, completion: 50 });
  const piiEvent = fromGroqResponse(piiSource, { userId, tool: "realtor-reply" });
  const serialized = JSON.stringify(piiEvent);
  const extraKeys = Object.keys(piiEvent).filter((k) => !ALLOWED_EVENT_KEYS.includes(k));
  record(
    "usage events contain only accounting fields and no PII",
    extraKeys.length === 0 &&
      piiEvent.rates_version === USAGE_RATES_VERSION &&
      PII_SNIPPETS.every((snippet) => !serialized.includes(snippet)),
    extraKeys.length ? `extra=${extraKeys.join(",")}` : ""
  );

  const tools = [
    "realtor-reply",
    "showing-notes",
    "open-house-notes",
    "listing-generator",
    "realgpt",
  ];
  for (const tool of tools) {
    const stored = await recordUsage({
      userId,
      tool,
      response: groqResponse({
        id: `chatcmpl-${tool}`,
        prompt: 400,
        cached: 50,
        completion: 80,
        reasoning: 10,
      }),
    });
    record(
      `recordUsage writes ${tool}`,
      Boolean(stored && stored.tool === tool && Number.isInteger(stored.cost_micros)),
      stored ? `micros=${stored.cost_micros}` : "no event"
    );
  }

  const listed = await listUsageEvents(userId);
  const listedTools = new Set(listed.map((e) => e.tool));
  record(
    "all five tools appear in isolated Redis history",
    tools.every((tool) => listedTools.has(tool)) && listed.length === 5,
    `count=${listed.length} tools=${[...listedTools].join(",")}`
  );

  const storedBlob = JSON.stringify(listed);
  record(
    "stored Redis events have no PII / raw Groq payload",
    PII_SNIPPETS.every((snippet) => !storedBlob.includes(snippet)) &&
      listed.every((e) => Object.keys(e).every((k) => ALLOWED_EVENT_KEYS.includes(k))),
    ""
  );

  const key = usageEventsKey(userId);
  const flood = [];
  for (let i = 0; i < USAGE_EVENTS_LIMIT + 5; i += 1) {
    flood.push(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        userId,
        tool: "realgpt",
        model: "openai/gpt-oss-120b",
        groq_id: `flood-${i}`,
        groq_request_id: "",
        prompt_tokens: 1,
        cached_tokens: 0,
        completion_tokens: 0,
        reasoning_tokens: 0,
        total_tokens: 1,
        uncached_input_tokens: 1,
        cost_micros: 0,
        rates_version: USAGE_RATES_VERSION,
      })
    );
  }
  await redisCommand(["LPUSH", key, ...flood]);
  await redisCommand(["LTRIM", key, 0, USAGE_EVENTS_LIMIT - 1]);
  const newest = await recordUsage({
    userId,
    tool: "realgpt",
    response: groqResponse({ id: "chatcmpl-newest", prompt: 20, completion: 5 }),
  });
  const afterBound = await listUsageEvents(userId);
  const llen = await redisCommand(["LLEN", key]);
  record(
    "Redis event history stays bounded",
    afterBound.length === USAGE_EVENTS_LIMIT &&
      Number(llen.result) === USAGE_EVENTS_LIMIT &&
      afterBound[0]?.groq_id === "chatcmpl-newest" &&
      Boolean(newest),
    `len=${afterBound.length} llen=${llen.result} first=${afterBound[0]?.groq_id}`
  );

  const monthly = await redisCommand(["EXISTS", `usage:${userId}:monthly`]);
  const purchased = await redisCommand(["EXISTS", `usage:${userId}:purchased`]);
  const creditMonthly = await redisCommand(["EXISTS", `credits:${userId}:monthly`]);
  const creditPurchased = await redisCommand(["EXISTS", `credits:${userId}:purchased`]);
  record(
    "does not create usage or credit balance keys",
    monthly.result === 0 &&
      purchased.result === 0 &&
      creditMonthly.result === 0 &&
      creditPurchased.result === 0,
    `usageMonthly=${monthly.result} usagePurchased=${purchased.result}`
  );

  const logSrc = source("lib/dev/logGroqUsage.js");
  record(
    "logGroqUsage shares fromGroqResponse pricing",
    logSrc.includes('from "../usage/fromGroqResponse.js"') &&
      logSrc.includes("costMicrosForUsage") &&
      logSrc.includes("cost_micros / 1e6") &&
      !logSrc.includes("UNCACHE_RATE") &&
      !logSrc.includes("0.15 / 1e6"),
    ""
  );

  const integrations = [
    {
      name: "RealtorReply helper",
      file: "lib/manual-input/completeChat.js",
      tool: "realtor-reply",
    },
    {
      name: "Showing Notes helper",
      file: "lib/showing-notes/groq.js",
      tool: "showing-notes",
    },
    {
      name: "Open House Notes helper",
      file: "lib/open-house-notes/groq.js",
      tool: "open-house-notes",
    },
    {
      name: "Listing Generator helper",
      file: "lib/listing-generator/groq.js",
      tool: "listing-generator",
    },
    {
      name: "RealGPT route",
      file: "app/api/realgpt/chat/route.ts",
      tool: "realgpt",
    },
  ];
  for (const item of integrations) {
    const src = source(item.file);
    record(
      `${item.name} records usage for ${item.tool}`,
      src.includes("recordUsage") && src.includes(`tool: "${item.tool}"`),
      ""
    );
  }

  const replyRoute = source("app/api/manual-input/reply/route.js");
  const inboundReply = source("app/api/realtor-reply/inbound-email/route.js");
  const showingSum = source("app/api/showing-notes/summarize/route.js");
  const showingIn = source("app/api/showing-notes/inbound-email/route.js");
  const ohSum = source("app/api/open-house-notes/summarize/route.js");
  const ohIn = source("app/api/open-house-notes/inbound-email/route.js");
  const listing = source("app/api/listing-generator/generate-listing/route.js");
  const realgpt = source("app/api/realgpt/chat/route.ts");

  record(
    "RealtorReply routes pass userId after consumeCredits",
    replyRoute.includes("generateReply(text, { userId: authz.userId })") &&
      replyRoute.indexOf("consumeCredits(authz.userId, 1)") <
        replyRoute.indexOf("generateReply(text, { userId: authz.userId })") &&
      inboundReply.includes("generateReply(cleanMessage, { userId })") &&
      inboundReply.indexOf("consumeCredits(userId, 1)") <
        inboundReply.indexOf("generateReply(cleanMessage, { userId })"),
    ""
  );
  function after(src, first, second) {
    const a = src.indexOf(first);
    const b = src.indexOf(second, a);
    return a !== -1 && b !== -1;
  }

  record(
    "Showing / Open House / Listing routes pass userId after consumeCredits",
    showingSum.includes("{ userId: authz.userId }") &&
      after(showingSum, "consumeCredits(authz.userId, 1)", "summarizeShowingNotes(") &&
      showingIn.includes("{ userId }") &&
      after(showingIn, "consumeCredits(userId, 1)", "summarizeShowingNotes(") &&
      ohSum.includes("{ userId: authz.userId }") &&
      after(ohSum, "consumeCredits(authz.userId, 1)", "summarizeOpenHouseNotes(") &&
      ohIn.includes("{ userId }") &&
      after(ohIn, "consumeCredits(userId, 1)", "summarizeOpenHouseNotes(") &&
      listing.includes("{ userId: authz.userId }") &&
      after(listing, "consumeCredits(authz.userId, 1)", "generateListingDescription("),
    ""
  );
  record(
    "RealGPT records usage without moving consumeCredits",
    realgpt.includes('tool: "realgpt"') &&
      after(realgpt, "consumeCredits(authz.userId, 1)", "await fetch(") &&
      after(realgpt, "await fetch(", "await recordUsage("),
    ""
  );

  const showingHelper = source("lib/showing-notes/groq.js");
  const ohHelper = source("lib/open-house-notes/groq.js");
  record(
    "userId is not sent in Groq prompt payloads",
    showingHelper.includes("address_hint: extras.address") &&
      !showingHelper.includes("userId: extras") &&
      ohHelper.includes("address_hint: extras.address") &&
      !ohHelper.includes("userId: extras") &&
      source("lib/listing-generator/groq.js").includes("usageCtx.userId"),
    ""
  );

  const creditsSrc = source("lib/credits.ts");
  record(
    "usage modules do not import credits helpers",
    !source("lib/usage/recordUsage.js").includes("credits") &&
      !source("lib/usage/fromGroqResponse.js").includes("consumeCredits") &&
      creditsSrc.includes("export async function consumeCredits") &&
      creditsSrc.includes("export async function refundCredits"),
    ""
  );
} finally {
  await redisCommand(["DEL", usageEventsKey(userId)]);
  await redisCommand(["DEL", `usage:${userId}:monthly`]);
  await redisCommand(["DEL", `usage:${userId}:purchased`]);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
