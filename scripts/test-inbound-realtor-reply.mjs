/**
 * Simulated Mailgun POSTs against local realtor-reply inbound.
 * Does not send Outlook/Mailgun inbound mail.
 */
import { randomBytes } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const BASE = process.env.INBOUND_TEST_BASE || "http://localhost:3000";
const SECRET = "local-test-secret-2026";

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

function authClerk() {
  return { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` };
}

async function clerkUsers() {
  const res = await fetch("https://api.clerk.com/v1/users?limit=20", {
    headers: authClerk(),
  });
  if (!res.ok) throw new Error(`Clerk users failed: ${res.status}`);
  return res.json();
}

async function redisCommand(command) {
  const res = await fetch(env.UPSTASH_REDIS_REST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`Redis command failed: ${res.status}`);
  return res.json();
}

async function monthlyCredits(userId) {
  const data = await redisCommand(["GET", `credits:${userId}:monthly`]);
  const n = Number(data.result ?? 0);
  return Number.isFinite(n) ? n : 0;
}

async function purchasedCredits(userId) {
  const data = await redisCommand(["GET", `credits:${userId}:purchased`]);
  const n = Number(data.result ?? 0);
  return Number.isFinite(n) ? n : 0;
}

async function getBuckets(userId) {
  return {
    monthly: await monthlyCredits(userId),
    purchased: await purchasedCredits(userId),
  };
}

async function setBuckets(userId, monthly, purchased) {
  await redisCommand(["SET", `credits:${userId}:monthly`, String(monthly)]);
  await redisCommand(["SET", `credits:${userId}:purchased`, String(purchased)]);
}

async function inboundClaimed(messageId) {
  const data = await redisCommand(["GET", `inbound:msg:${messageId}`]);
  return data.result != null;
}

async function noteCount(userId) {
  const data = await redisCommand(["GET", `manual-input:${userId}`]);
  const raw = data.result;
  if (!raw) return 0;
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  return Array.isArray(parsed) ? parsed.length : 0;
}

function uniqueMessageId(label) {
  return `local-test-${label}-${randomBytes(8).toString("hex")}@realtorflow.test`;
}

async function ensureToken(user) {
  const existing = user.public_metadata?.inboundToken;
  if (typeof existing === "string" && /^[a-f0-9]{32}$/.test(existing)) {
    await redisCommand(["SET", `inbound:token:${existing}`, user.id]);
    return existing;
  }
  const token = randomBytes(16).toString("hex");
  await redisCommand(["SET", `inbound:token:${token}`, user.id]);
  const res = await fetch(`https://api.clerk.com/v1/users/${user.id}/metadata`, {
    method: "PATCH",
    headers: { ...authClerk(), "Content-Type": "application/json" },
    body: JSON.stringify({ public_metadata: { inboundToken: token } }),
  });
  if (!res.ok) throw new Error(`Clerk metadata patch failed: ${res.status}`);
  return token;
}

async function postInbound({ secret = SECRET, fields }) {
  const url = `${BASE}/api/realtor-reply/inbound-email?secret=${encodeURIComponent(secret)}`;
  const body = new URLSearchParams(fields).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

function clerkEmail(user) {
  const addrs = user.email_addresses || [];
  return addrs[0]?.email_address || "";
}

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const users = await clerkUsers();
const list = Array.isArray(users) ? users : users.data || [];
if (!list.length) {
  throw new Error("No Clerk users found");
}
const user = list[0];
const userId = user.id;
const token = await ensureToken(user);
const recipient = `rpl_${token}@sandbox581c1ba7b28c470c993618fc80717219.mailgun.org`;
const clerkMail = clerkEmail(user);
const otherSender = "inbound-local-test@example.com";
if (otherSender.toLowerCase() === clerkMail.toLowerCase()) {
  throw new Error("Test sender unexpectedly matches Clerk email");
}

const snapshot = await getBuckets(userId);
const before = snapshot.monthly;

{
  const inboundSrc = readFileSync(
    resolve(ROOT, "app/api/realtor-reply/inbound-email/route.js"),
    "utf8"
  );
  record(
    "maxDuration is 60",
    /export const maxDuration = 60/.test(inboundSrc),
    ""
  );
}

{
  const { status } = await postInbound({
    secret: "wrong-secret",
    fields: {
      recipient,
      sender: otherSender,
      subject: "Test",
      "body-plain": "Please reply about the showing.",
    },
  });
  const after = await monthlyCredits(userId);
  record(
    "invalid inbound secret → 401",
    status === 401 && after === before,
    `status=${status} credits ${before}→${after}`
  );
}

{
  const { status, json } = await postInbound({
    fields: {
      recipient: `rpl_${"0".repeat(32)}@sandbox581c1ba7b28c470c993618fc80717219.mailgun.org`,
      sender: otherSender,
      subject: "Test",
      "body-plain": "Please reply about the showing.",
    },
  });
  const after = await monthlyCredits(userId);
  record(
    "unknown forwarding recipient → rejected, no credit consume",
    status === 200 && json?.skipped === true && json?.reason === "unknown recipient" && after === before,
    `status=${status} reason=${json?.reason || ""} credits ${before}→${after}`
  );
}

{
  const { status, json } = await postInbound({
    fields: {
      recipient,
      sender: "",
      from: "",
      subject: "Test",
      "body-plain": "Please reply about the showing.",
    },
  });
  const after = await monthlyCredits(userId);
  record(
    "missing/empty sender → rejected",
    status === 200 && json?.skipped === true && json?.reason === "missing sender" && after === before,
    `status=${status} reason=${json?.reason || ""} credits ${before}→${after}`
  );
}

{
  const { status, json } = await postInbound({
    fields: {
      recipient,
      sender: otherSender,
      subject: "Test",
      "body-plain": "",
      "stripped-text": "",
    },
  });
  const after = await monthlyCredits(userId);
  record(
    "empty body → rejected",
    status === 200 && json?.skipped === true && json?.reason === "empty body" && after === before,
    `status=${status} reason=${json?.reason || ""} credits ${before}→${after}`
  );
}

const messageIdA = uniqueMessageId("a");
const notesBeforeA = await noteCount(userId);

try {

{
  const start = await getBuckets(userId);
  const { status, json } = await postInbound({
    fields: {
      recipient,
      sender: otherSender,
      from: `Local Tester <${otherSender}>`,
      subject: "Price question",
      "Message-Id": `<${messageIdA}>`,
      "body-plain":
        "Hi, can you send more details on 12 Oak Street? We are ready to write an offer this week.",
    },
  });
  const after = await getBuckets(userId);
  const notesAfter = await noteCount(userId);
  const consumed =
    after.monthly + after.purchased === start.monthly + start.purchased - 1;
  record(
    "valid recipient + sender ≠ Clerk email → identify user and proceed",
    status === 200 && json?.ok === true && !json?.skipped && !json?.duplicate && consumed,
    `status=${status} ok=${json?.ok} duplicate=${json?.duplicate} credits ${start.monthly + start.purchased}→${after.monthly + after.purchased}`
  );
  record(
    "successful generation/save + email failure returns 200 and keeps the credit consumed",
    status === 200 && json?.ok === true && consumed && notesAfter === notesBeforeA + 1,
    `status=${status} notes ${notesBeforeA}→${notesAfter}`
  );
}

{
  const start = await getBuckets(userId);
  const notesStart = await noteCount(userId);
  const { status, json } = await postInbound({
    fields: {
      recipient,
      sender: otherSender,
      subject: "Price question retry",
      "Message-Id": `<${messageIdA}>`,
      "body-plain":
        "Hi, can you send more details on 12 Oak Street? We are ready to write an offer this week.",
    },
  });
  const after = await getBuckets(userId);
  const notesAfter = await noteCount(userId);
  record(
    "same Message-Id submitted again returns 200 duplicate and does not consume",
    status === 200 &&
      json?.ok === true &&
      json?.duplicate === true &&
      after.monthly === start.monthly &&
      after.purchased === start.purchased &&
      notesAfter === notesStart,
    `status=${status} duplicate=${json?.duplicate} notes ${notesStart}→${notesAfter}`
  );
}

{
  const start = await getBuckets(userId);
  const { status, json } = await postInbound({
    fields: {
      recipient,
      sender: otherSender,
      subject: "Header fallback",
      "message-headers": JSON.stringify([
        ["From", otherSender],
        ["Message-Id", `<${messageIdA}>`],
      ]),
      "body-plain": "Header-only Message-Id should still be treated as a duplicate.",
    },
  });
  const after = await getBuckets(userId);
  record(
    "message-headers Message-Id fallback is claimed as the same message",
    status === 200 &&
      json?.duplicate === true &&
      after.monthly === start.monthly &&
      after.purchased === start.purchased,
    `status=${status} duplicate=${json?.duplicate}`
  );
}

{
  const saved = await getBuckets(userId);
  await setBuckets(userId, 0, 0);
  const messageIdB = uniqueMessageId("b");
  const { status, json } = await postInbound({
    fields: {
      recipient,
      sender: otherSender,
      subject: "Out of credits",
      "Message-Id": messageIdB,
      "body-plain": "This request should fail before generation and release the claim.",
    },
  });
  const stillClaimed = await inboundClaimed(messageIdB);
  record(
    "failed-before-save (out of credits) returns 402, does not consume, and releases Message-Id",
    status === 402 && !stillClaimed && json?.error,
    `status=${status} claimed=${stillClaimed}`
  );

  await setBuckets(userId, Math.max(saved.monthly, 2), saved.purchased);
  const retryStart = await getBuckets(userId);
  const notesStart = await noteCount(userId);
  const retry = await postInbound({
    fields: {
      recipient,
      sender: otherSender,
      subject: "Retry after release",
      "Message-Id": messageIdB,
      "body-plain":
        "Second attempt after the claim was released. Please confirm 12 Oak Street showing times.",
    },
  });
  const retryAfter = await getBuckets(userId);
  const notesAfter = await noteCount(userId);
  const consumed =
    retryAfter.monthly + retryAfter.purchased ===
    retryStart.monthly + retryStart.purchased - 1;
  record(
    "retry with the same Message-Id can process after the claim is released",
    retry.status === 200 &&
      retry.json?.ok === true &&
      !retry.json?.duplicate &&
      consumed &&
      notesAfter === notesStart + 1,
    `status=${retry.status} duplicate=${retry.json?.duplicate} notes ${notesStart}→${notesAfter}`
  );
}

{
  const saved = await getBuckets(userId);
  await setBuckets(userId, 1, 0);
  const messageIdC = uniqueMessageId("c");
  const messageIdD = uniqueMessageId("d");
  const fieldsFor = (messageId) => ({
    recipient,
    sender: otherSender,
    subject: "Concurrent reserve",
    "Message-Id": messageId,
    "body-plain":
      "Please confirm whether we can see 12 Oak Street tomorrow afternoon.",
  });
  const [one, two] = await Promise.all([
    postInbound({ fields: fieldsFor(messageIdC) }),
    postInbound({ fields: fieldsFor(messageIdD) }),
  ]);
  const after = await getBuckets(userId);
  const okCount = [one.status, two.status].filter((status) => status === 200).length;
  const blockedCount = [one.status, two.status].filter((status) => status === 402).length;
  record(
    "two different Message-Ids are processed independently and concurrent reserve spends only one credit",
    after.monthly === 0 &&
      after.purchased === 0 &&
      okCount === 1 &&
      blockedCount === 1 &&
      !one.json?.duplicate &&
      !two.json?.duplicate,
    `statuses=${one.status},${two.status} buckets=${after.monthly}/${after.purchased}`
  );
  await setBuckets(userId, saved.monthly, saved.purchased);
}
} finally {
  await setBuckets(userId, snapshot.monthly, snapshot.purchased);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
