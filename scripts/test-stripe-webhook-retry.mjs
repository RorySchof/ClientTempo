/**
 * Stripe webhook retry/idempotency checks with mocked Stripe, Redis and Clerk
 * (see scripts/stripe-test-harness.mjs). No network calls, no real Redis, and
 * .env.local is not read. This does not prove the end-to-end integration.
 * Run: node scripts/test-stripe-webhook-retry.mjs
 */
import {
  addInvoice,
  addSubscription,
  addUser,
  deliver,
  errors,
  events,
  finish,
  line,
  loadModules,
  monthly,
  planOf,
  purchased,
  record,
  resetState,
  setMonthly,
  state,
} from "./stripe-test-harness.mjs";

const { webhook, cleanup } = loadModules(".tmp-webhook-retry-test");
const { POST } = webhook;
const userId = "user_mock_1";

function activationSetup() {
  resetState();
  const customer = addUser(userId, "free");
  setMonthly(userId, 50);
  addSubscription("sub_1", customer, "pro");
  addInvoice("in_create_1", {
    customer,
    subscription: "sub_1",
    reason: "subscription_create",
    lines: [line("pro", 1000)],
  });
  return events.invoicePaid("evt_invoice_1", "in_create_1");
}

try {
  // 1. Failure before the credit write -> 500, claim released, nothing applied.
  const event = activationSetup();
  state.failEvalOnce = true;
  const first = await deliver(POST, event);
  record(
    "1. processing failure after claim returns 500 and releases the claim",
    first.status === 500 &&
      !state.redis.has(`stripe:event:${event.id}`) &&
      !state.redis.has("stripe:grant:in_create_1") &&
      errors.some((e) => e.includes("stripe webhook processing error")) &&
      planOf(userId) === "free" &&
      monthly(userId) === 50,
    `status=${first.status} plan=${planOf(userId)} monthly=${monthly(userId)}`
  );

  // 2. Same event redelivered -> processed.
  const second = await deliver(POST, event);
  record(
    "2. redelivery of the same event succeeds and applies plan + allowance",
    second.status === 200 && planOf(userId) === "pro" && monthly(userId) === 1000,
    `status=${second.status} plan=${planOf(userId)} monthly=${monthly(userId)}`
  );

  // 3a. Duplicate successful delivery -> no re-grant.
  setMonthly(userId, 990);
  const third = await deliver(POST, event);
  const thirdNewId = await deliver(POST, { ...event, id: "evt_invoice_1b" });
  record(
    "3a. duplicate invoice delivery (same and new event ID) does not reset credits",
    third.status === 200 && thirdNewId.status === 200 && monthly(userId) === 990,
    `statuses=${third.status}/${thirdNewId.status} monthly=${monthly(userId)} (spent 10 before resend)`
  );

  // 3b. Duplicate credit-pack delivery -> granted once.
  resetState();
  addUser(userId, "free");
  const pack = events.checkoutTopup("evt_pack_1", userId);
  const packFirst = await deliver(POST, pack);
  const packDup = await deliver(POST, pack);
  record(
    "3b. duplicate credit-pack delivery grants 1000 credits once",
    packFirst.status === 200 && packDup.status === 200 && purchased(userId) === 1000,
    `statuses=${packFirst.status}/${packDup.status} purchased=${purchased(userId)}`
  );

  // 4. Release failure must not turn a processing failure into success.
  const failEvent = activationSetup();
  state.failEvalOnce = true;
  state.failReleaseAlways = true;
  const releaseFail = await deliver(POST, failEvent);
  record(
    "4. failure to release the claim still returns 500",
    releaseFail.status === 500 &&
      state.calls.releases.includes(`stripe:event:${failEvent.id}`) &&
      errors.some((e) => e.includes("stripe webhook release error")),
    `status=${releaseFail.status}`
  );

  // 5. Credit write succeeds, Clerk update fails, retry must not re-grant.
  const partial = activationSetup();
  state.failMetadataUpdateOnce = true;
  const partialFirst = await deliver(POST, partial);
  const afterFirst = monthly(userId);
  setMonthly(userId, afterFirst - 10);
  const partialRetry = await deliver(POST, partial);
  record(
    "5. failure after the credit write, then retry, grants the allowance once",
    partialFirst.status === 500 &&
      afterFirst === 1000 &&
      partialRetry.status === 200 &&
      monthly(userId) === 990 &&
      planOf(userId) === "pro",
    `statuses=${partialFirst.status}/${partialRetry.status} monthly=${monthly(userId)} plan=${planOf(userId)}`
  );

  // 6. Two distinct event IDs for the same checkout session grant once.
  resetState();
  addUser(userId, "free");
  const [concA, concB] = await Promise.all([
    deliver(POST, events.checkoutTopup("evt_pack_3a", userId, "cs_shared")),
    deliver(POST, events.checkoutTopup("evt_pack_3b", userId, "cs_shared")),
  ]);
  record(
    "6. concurrent deliveries for one checkout session grant 1000 credits once",
    concA.status === 200 && concB.status === 200 && purchased(userId) === 1000,
    `statuses=${concA.status}/${concB.status} purchased=${purchased(userId)}`
  );

  // 7. Signature verification is still enforced.
  const badSig = await webhook.POST(
    new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "forged" },
      body: JSON.stringify(activationSetup()),
    })
  );
  record(
    "7. invalid signature is rejected with 400 and changes nothing",
    badSig.status === 400 && monthly(userId) === 50,
    `status=${badSig.status}`
  );
} finally {
  cleanup();
}

finish();
