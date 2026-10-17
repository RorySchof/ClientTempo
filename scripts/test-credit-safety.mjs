/**
 * Local credit-helper and route-source checks.
 * Uses isolated Redis keys. Does not call Stripe, Vercel, or live Mailgun inbound.
 */
import { createRequire } from "module";
import { spawnSync } from "child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join, resolve } from "path";
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
  throw new Error("UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN required for local credit tests");
}

function compileCredits() {
  const outDir = join(ROOT, "scripts", ".tmp-credits");
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const tsconfigPath = join(outDir, "tsconfig.json");
  writeFileSync(
    tsconfigPath,
    JSON.stringify({
      compilerOptions: {
        target: "ES2020",
        module: "commonjs",
        moduleResolution: "node",
        esModuleInterop: true,
        skipLibCheck: true,
        noCheck: true,
        strict: false,
        strictNullChecks: false,
        typeRoots: [join(ROOT, "node_modules/@types")],
        types: ["node"],
        rootDir: join(ROOT, "lib"),
        outDir,
      },
      files: [join(ROOT, "lib/credits.ts")],
    })
  );
  const tsc = join(ROOT, "node_modules/typescript/bin/tsc");
  const compiled = spawnSync(
    process.execPath,
    [tsc, "-p", tsconfigPath, "--noCheck"],
    { cwd: ROOT, encoding: "utf8" }
  );
  if (compiled.status !== 0) {
    rmSync(outDir, { recursive: true, force: true });
    throw new Error(`tsc lib/credits.ts failed: ${compiled.stderr || compiled.stdout}`);
  }
  const require = createRequire(join(ROOT, "package.json"));
  return { credits: require(join(outDir, "credits.js")), outDir };
}

async function redisGet(credits, userId) {
  return {
    total: await credits.getCredits(userId),
  };
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

async function buckets(userId) {
  const monthlyRaw = await redisCommand(["GET", `credits:${userId}:monthly`]);
  const purchasedRaw = await redisCommand(["GET", `credits:${userId}:purchased`]);
  const monthly = Number(monthlyRaw.result ?? 0);
  const purchased = Number(purchasedRaw.result ?? 0);
  return {
    monthly: Number.isFinite(monthly) ? monthly : 0,
    purchased: Number.isFinite(purchased) ? purchased : 0,
  };
}

async function setBuckets(userId, monthly, purchased) {
  await redisCommand(["SET", `credits:${userId}:monthly`, String(monthly)]);
  await redisCommand(["SET", `credits:${userId}:purchased`, String(purchased)]);
}

async function cleanup(userId, messageIds) {
  await redisCommand(["DEL", `credits:${userId}:monthly`]);
  await redisCommand(["DEL", `credits:${userId}:purchased`]);
  await redisCommand(["DEL", `credits:${userId}:events`]);
  for (const id of messageIds) {
    await redisCommand(["DEL", `inbound:msg:${id}`]);
  }
}

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const { credits, outDir } = compileCredits();
const userId = `local-credit-test-${randomBytes(4).toString("hex")}`;
const messageIds = [];

try {
  await setBuckets(userId, 5, 3);
  const spentMonthly = await credits.consumeCredits(userId, 1);
  const afterMonthly = await buckets(userId);
  record(
    "successful consume uses monthly first",
    spentMonthly && spentMonthly.source === "monthly" && afterMonthly.monthly === 4 && afterMonthly.purchased === 3,
    `source=${spentMonthly.source || "none"} buckets=${afterMonthly.monthly}/${afterMonthly.purchased}`
  );

  await credits.refundCredits(userId, spentMonthly.source);
  const restoredMonthly = await buckets(userId);
  record(
    "monthly consume + refund restores monthly only",
    restoredMonthly.monthly === 5 && restoredMonthly.purchased === 3,
    `buckets=${restoredMonthly.monthly}/${restoredMonthly.purchased}`
  );

  await setBuckets(userId, 0, 3);
  const spentPurchased = await credits.consumeCredits(userId, 1);
  const afterPurchased = await buckets(userId);
  record(
    "successful consume uses purchased when monthly is empty",
    spentPurchased && spentPurchased.source === "purchased" && afterPurchased.monthly === 0 && afterPurchased.purchased === 2,
    `source=${spentPurchased.source || "none"} buckets=${afterPurchased.monthly}/${afterPurchased.purchased}`
  );

  await credits.refundCredits(userId, spentPurchased.source);
  const restoredPurchased = await buckets(userId);
  record(
    "purchased consume + refund restores purchased only",
    restoredPurchased.monthly === 0 && restoredPurchased.purchased === 3,
    `buckets=${restoredPurchased.monthly}/${restoredPurchased.purchased}`
  );

  await setBuckets(userId, 1, 0);
  const [first, second] = await Promise.all([
    credits.consumeCredits(userId, 1),
    credits.consumeCredits(userId, 1),
  ]);
  const winners = [first, second].filter(Boolean);
  const afterRace = await buckets(userId);
  record(
    "concurrent consume with 1 credit: only one succeeds",
    winners.length === 1 && Boolean(first) !== Boolean(second) && afterRace.monthly === 0 && afterRace.purchased === 0,
    `winners=${winners.length} buckets=${afterRace.monthly}/${afterRace.purchased}`
  );

  await setBuckets(userId, 0, 0);
  const none = await credits.consumeCredits(userId, 1);
  record("consume returns false when both buckets are empty", none === false, `result=${JSON.stringify(none)}`);

  const msg = `local-msg-${randomBytes(8).toString("hex")}`;
  messageIds.push(msg);
  const claimed = await credits.claimInboundMessage(msg);
  const claimedAgain = await credits.claimInboundMessage(msg);
  record(
    "inbound Message-Id claim is NX",
    claimed === true && claimedAgain === false,
    `first=${claimed} second=${claimedAgain}`
  );
  await credits.releaseInboundMessage(msg);
  const claimedAfterRelease = await credits.claimInboundMessage(msg);
  record(
    "released inbound Message-Id can be claimed again",
    claimedAfterRelease === true,
    `claimedAfterRelease=${claimedAfterRelease}`
  );

  let invalidRefundThrew = false;
  const beforeInvalid = await buckets(userId);
  try {
    await credits.refundCredits(userId, "other");
  } catch {
    invalidRefundThrew = true;
  }
  const afterInvalid = await buckets(userId);
  record(
    "refund rejects a mismatched source without writing a bucket",
    invalidRefundThrew &&
      afterInvalid.monthly === beforeInvalid.monthly &&
      afterInvalid.purchased === beforeInvalid.purchased,
    `threw=${invalidRefundThrew}`
  );

  const totals = await redisGet(credits, userId);
  record("getCredits stays available after helper use", Number.isFinite(totals.total), `total=${totals.total}`);

  const realgpt = readFileSync(resolve(ROOT, "app/api/realgpt/chat/route.ts"), "utf8");
  const groqFailBlock = realgpt.slice(
    realgpt.indexOf("if (!groqResponse.ok)"),
    realgpt.indexOf("const reply")
  );
  const emptyBlock = realgpt.slice(
    realgpt.indexOf("if (!reply)"),
    realgpt.indexOf("return Response.json({ reply })")
  );
  record(
    "RealGPT non-throwing Groq/empty paths refund the reserved credit",
    groqFailBlock.includes("refundCredits(authz.userId, spent.source)") &&
      emptyBlock.includes("refundCredits(authz.userId, spent.source)") &&
      realgpt.includes("if (spent)"),
    ""
  );

  const inbound = readFileSync(
    resolve(ROOT, "app/api/realtor-reply/inbound-email/route.js"),
    "utf8"
  );
  record(
    "RealtorReply inbound maxDuration is 60",
    /export const maxDuration = 60/.test(inbound),
    ""
  );
  record(
    "RealtorReply inbound keeps consumeCredits before generateReply",
    inbound.indexOf("consumeCredits(userId, 1)") <
      inbound.indexOf("generateReply(cleanMessage, { userId })"),
    ""
  );
  record(
    "RealtorReply inbound send failure is caught after saveNote",
    inbound.indexOf("await saveNote(note, userId)") <
      inbound.indexOf("realtor-reply inbound-email send failed:") &&
      inbound.includes("return Response.json({ ok: true })"),
    ""
  );

  const manual = readFileSync(resolve(ROOT, "app/api/manual-input/reply/route.js"), "utf8");
  record(
    "manual RealtorReply refunds on empty/unusable generation",
    manual.includes("refundCredits(authz.userId, spent.source)") &&
      manual.indexOf("consumeCredits(authz.userId, 1)") <
      manual.indexOf("generateReply(text, { userId: authz.userId })"),
    ""
  );
} finally {
  await cleanup(userId, messageIds);
  rmSync(outDir, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
