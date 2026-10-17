/**
 * Stripe checkout, subscription and credit-policy checks with mocked Stripe,
 * Redis and Clerk (see scripts/stripe-test-harness.mjs). No network calls, no
 * real Redis, and .env.local is not read.
 * Run: node scripts/test-stripe-billing.mjs
 */
import {
  addInvoice,
  addSubscription,
  addUser,
  checkoutRequest,
  deliver,
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

const { checkout, webhook, resetMonthly, cleanup } = loadModules(".tmp-stripe-billing-test");
const hook = (event) => deliver(webhook.POST, event);
const buy = (userId, body) => checkoutRequest(checkout.POST, userId, body);
const PERIOD_END = 2_000_000_000;
const u = "user_mock_billing";

try {
  // ---------------- Checkout route ----------------

  // C1. New customer -> one idempotent customer + subscription Checkout.
  resetState();
  state.users.set(u, { id: u, publicMetadata: { plan: "free" } });
  const c1 = await buy(u, { plan: "pro" });
  const created = state.calls.checkoutCreate[0];
  record(
    "C1. new subscriber gets a subscription Checkout Session with idempotency keys",
    c1.status === 200 &&
      c1.body.url?.startsWith("https://checkout.mock/") &&
      state.calls.customersCreate[0]?.opts?.idempotencyKey === `customer-create:${u}` &&
      created?.params.mode === "subscription" &&
      created?.params.subscription_data?.metadata?.clerkUserId === u &&
      typeof created?.opts?.idempotencyKey === "string" &&
      state.calls.portalCreate.length === 0 &&
      state.calls.subscriptionsUpdate.length === 0,
    `status=${c1.status} key=${created?.opts?.idempotencyKey}`
  );

  // C2. Repeat click while Stripe search lags -> same customer, same session.
  state.searchLag = true;
  const c2 = await buy(u, { plan: "pro" });
  record(
    "C2. duplicate request reuses the customer and Checkout Session",
    c2.status === 200 &&
      c2.body.url === c1.body.url &&
      state.customers.size === 1 &&
      state.calls.customersCreate.length === 2 &&
      new Set(state.calls.checkoutCreate.map((c) => c.opts.idempotencyKey)).size === 1,
    `customers=${state.customers.size} sameUrl=${c2.body.url === c1.body.url}`
  );

  // C3/C4. Any subscription that has not ended -> portal, never update or Checkout.
  for (const status of ["active", "trialing", "past_due", "unpaid", "incomplete", "paused"]) {
    resetState();
    const customer = addUser(u, status === "active" ? "pro" : "free");
    addSubscription("sub_existing", customer, "pro", status);
    const res = await buy(u, { plan: "pro_plus" });
    record(
      `C3. ${status} subscriber is sent to the Billing Portal`,
      res.status === 200 &&
        res.body.portal === true &&
        res.body.url === `https://portal.mock/${customer}` &&
        state.calls.checkoutCreate.length === 0 &&
        state.calls.subscriptionsUpdate.length === 0,
      `status=${res.status} url=${res.body.url}`
    );
  }

  // C5. Only ended subscriptions -> new Checkout allowed (reactivation).
  resetState();
  {
    const customer = addUser(u, "free");
    addSubscription("sub_old", customer, "pro", "canceled");
    addSubscription("sub_expired", customer, "pro", "incomplete_expired");
    const res = await buy(u, { plan: "pro" });
    record(
      "C5. customer whose subscriptions ended can resubscribe through Checkout",
      res.status === 200 &&
        res.body.url?.startsWith("https://checkout.mock/") &&
        state.calls.portalCreate.length === 0,
      `status=${res.status}`
    );
  }

  // C6. Stripe exception text is not returned to the client.
  resetState();
  addUser(u, "free");
  state.failCheckoutCreate = "No such price: price_internal_detail_123";
  {
    const res = await buy(u, { plan: "pro" });
    record(
      "C6. Stripe errors return a generic message",
      res.status === 500 &&
        res.body.error === "Couldn't start checkout." &&
        !JSON.stringify(res.body).includes("price_internal"),
      `status=${res.status} error=${res.body.error}`
    );
  }

  // C7. Credit packs are still available to subscribers.
  resetState();
  {
    const customer = addUser(u, "pro");
    addSubscription("sub_existing", customer, "pro");
    const res = await buy(u, { kind: "credits" });
    record(
      "C7. subscriber can still buy a credit pack through Checkout",
      res.status === 200 &&
        state.calls.checkoutCreate[0]?.params.mode === "payment" &&
        state.calls.portalCreate.length === 0,
      `status=${res.status}`
    );
  }

  // C8. Missing price configuration -> generic error without env names.
  resetState();
  addUser(u, "free");
  {
    const saved = process.env.STRIPE_PRICE_ID_PRO_PLUS;
    delete process.env.STRIPE_PRICE_ID_PRO_PLUS;
    const res = await buy(u, { plan: "pro_plus" });
    process.env.STRIPE_PRICE_ID_PRO_PLUS = saved;
    record(
      "C8. missing price configuration returns a generic error",
      res.status === 500 && !JSON.stringify(res.body).includes("STRIPE_"),
      `status=${res.status} error=${res.body.error}`
    );
  }

  // ---------------- Activation and renewal ----------------

  // W1. Checkout completion sets the label only; the paid invoice grants once.
  resetState();
  {
    const customer = addUser(u, "free");
    setMonthly(u, 20);
    addSubscription("sub_1", customer, "pro", "active", PERIOD_END);
    const r1 = await hook(events.checkoutSubscription("evt_cs_1", u, customer));
    const labelOnly = planOf(u) === "pro" && monthly(u) === 20;
    addInvoice("in_create", {
      customer,
      subscription: "sub_1",
      reason: "subscription_create",
      lines: [line("pro", 1000, { periodEnd: PERIOD_END })],
    });
    const r2 = await hook(events.invoicePaid("evt_inv_1", "in_create"));
    const granted = monthly(u) === 1000;
    setMonthly(u, 990);
    const r3 = await hook(events.invoicePaid("evt_inv_1", "in_create"));
    const r4 = await hook(events.invoicePaid("evt_inv_1_redelivered", "in_create"));
    record(
      "W1. initial activation grants the plan allowance exactly once",
      [r1, r2, r3, r4].every((r) => r.status === 200) &&
        labelOnly &&
        granted &&
        monthly(u) === 990 &&
        state.users.get(u).publicMetadata.tokensResetAt ===
          new Date(PERIOD_END * 1000).toISOString(),
      `labelOnly=${labelOnly} granted=${granted} monthly=${monthly(u)}`
    );
  }

  // W1b. Invoice arrives before Checkout completion.
  resetState();
  {
    const customer = addUser(u, "free");
    setMonthly(u, 20);
    addSubscription("sub_1", customer, "pro_plus");
    addInvoice("in_create", {
      customer,
      subscription: "sub_1",
      reason: "subscription_create",
      lines: [line("pro_plus", 2000)],
    });
    await hook(events.invoicePaid("evt_inv_1", "in_create"));
    await hook(events.checkoutSubscription("evt_cs_1", u, customer));
    record(
      "W1b. invoice before Checkout completion still grants once and sets the plan",
      planOf(u) === "pro_plus" && monthly(u) === 2500,
      `plan=${planOf(u)} monthly=${monthly(u)}`
    );
  }

  // W2. Renewal resets to the allowance once.
  resetState();
  {
    const customer = addUser(u, "pro");
    setMonthly(u, 37);
    addSubscription("sub_1", customer, "pro");
    addInvoice("in_cycle_1", {
      customer,
      subscription: "sub_1",
      reason: "subscription_cycle",
      lines: [line("pro", 1000)],
    });
    await hook(events.invoicePaid("evt_cycle_1", "in_cycle_1"));
    const after = monthly(u);
    setMonthly(u, 995);
    await hook(events.invoicePaid("evt_cycle_1", "in_cycle_1"));
    await hook(events.invoicePaid("evt_cycle_1_again", "in_cycle_1"));
    record(
      "W2. renewal resets the monthly balance to the allowance exactly once",
      after === 1000 && monthly(u) === 995,
      `afterRenewal=${after} afterDuplicates=${monthly(u)}`
    );
  }

  // ---------------- Plan changes ----------------

  // W3. subscription.updated alone never grants.
  resetState();
  {
    const customer = addUser(u, "pro");
    setMonthly(u, 400);
    const sub = addSubscription("sub_1", customer, "pro_plus");
    const res = await hook(events.subscriptionUpdated("evt_upd_1", sub));
    record(
      "W3. plan change via subscription.updated updates the label without credits",
      res.status === 200 && planOf(u) === "pro_plus" && monthly(u) === 400,
      `plan=${planOf(u)} monthly=${monthly(u)}`
    );
  }

  // W4. Paid upgrade invoice grants the 1,500 difference once.
  resetState();
  {
    const customer = addUser(u, "pro");
    setMonthly(u, 400);
    addSubscription("sub_1", customer, "pro_plus");
    const upgradeLines = [
      line("pro", -500, { proration: true }),
      line("pro_plus", 1000, { proration: true }),
    ];
    addInvoice("in_upgrade_1", {
      customer,
      subscription: "sub_1",
      reason: "subscription_update",
      lines: upgradeLines,
    });
    await hook(events.invoicePaid("evt_up_1", "in_upgrade_1"));
    const after = monthly(u);
    await hook(events.invoicePaid("evt_up_1", "in_upgrade_1"));
    await hook(events.invoicePaid("evt_up_1_again", "in_upgrade_1"));
    addInvoice("in_upgrade_2", {
      customer,
      subscription: "sub_1",
      reason: "subscription_update",
      lines: upgradeLines,
    });
    await hook(events.invoicePaid("evt_up_2", "in_upgrade_2"));
    record(
      "W4. paid upgrade adds 1,500 once (per invoice and per billing period)",
      after === 1900 && monthly(u) === 1900 && planOf(u) === "pro_plus",
      `afterUpgrade=${after} afterRepeats=${monthly(u)}`
    );
  }

  // W5. Unverified upgrades grant nothing.
  {
    const cases = [
      ["no credit line for the old plan", { lines: [line("pro_plus", 1000, { proration: true })] }],
      ["invoice not paid when re-read", { status: "open", lines: [line("pro", -500, { proration: true }), line("pro_plus", 1000, { proration: true })] }],
      ["downgrade direction", { lines: [line("pro_plus", -1000, { proration: true }), line("pro", 500, { proration: true })] }],
      ["unknown price", { lines: [line("pro", -500, { proration: true }), line("price_other", 1000, { proration: true })] }],
      ["manual invoice", { reason: "manual", lines: [line("pro", -500, { proration: true }), line("pro_plus", 1000, { proration: true })] }],
    ];
    for (const [name, overrides] of cases) {
      resetState();
      const customer = addUser(u, "pro");
      setMonthly(u, 400);
      addSubscription("sub_1", customer, "pro_plus");
      addInvoice("in_x", {
        customer,
        subscription: "sub_1",
        reason: "subscription_update",
        ...overrides,
      });
      const res = await hook(events.invoicePaid("evt_x", "in_x"));
      record(
        `W5. no grant for unverified upgrade: ${name}`,
        res.status === 200 && monthly(u) === 400,
        `status=${res.status} monthly=${monthly(u)}`
      );
    }
  }

  // W6. Downgrade keeps credits; no early refill; next renewal applies Pro.
  resetState();
  {
    const customer = addUser(u, "pro_plus", { tokensResetAt: "2020-01-01T00:00:00.000Z" });
    setMonthly(u, 2400);
    const sub = addSubscription("sub_1", customer, "pro");
    await hook(events.subscriptionUpdated("evt_down_1", sub));
    const afterLabel = monthly(u);
    const updatesBefore = state.calls.metadataUpdates.length;
    await resetMonthly.ensureMonthlyCredits(state.users.get(u));
    const noEarlyRefill =
      monthly(u) === 2400 && state.calls.metadataUpdates.length === updatesBefore;
    addInvoice("in_cycle_2", {
      customer,
      subscription: "sub_1",
      reason: "subscription_cycle",
      lines: [line("pro", 1000)],
    });
    await hook(events.invoicePaid("evt_cycle_2", "in_cycle_2"));
    record(
      "W6. downgrade keeps credits until the next paid renewal sets the Pro allowance",
      planOf(u) === "pro" && afterLabel === 2400 && noEarlyRefill && monthly(u) === 1000,
      `afterLabel=${afterLabel} noEarlyRefill=${noEarlyRefill} afterRenewal=${monthly(u)}`
    );
  }

  // W7. Out-of-order / stale subscription.updated payloads.
  resetState();
  {
    const customer = addUser(u, "pro_plus");
    setMonthly(u, 1200);
    addSubscription("sub_1", customer, "pro_plus");
    const stale = {
      ...structuredClone(state.subscriptions.get("sub_1")),
      status: "past_due",
      items: { data: [{ price: { id: "price_mock_pro" }, current_period_end: 1 }] },
    };
    const res = await hook(events.subscriptionUpdated("evt_stale", stale));
    record(
      "W7. stale or out-of-order subscription.updated uses current Stripe state",
      res.status === 200 && planOf(u) === "pro_plus" && monthly(u) === 1200,
      `plan=${planOf(u)} monthly=${monthly(u)}`
    );
  }

  // ---------------- Payment failure and recovery ----------------
  resetState();
  {
    const customer = addUser(u, "pro");
    setMonthly(u, 300);
    const sub = addSubscription("sub_1", customer, "pro");
    addInvoice("in_cycle_3", {
      customer,
      subscription: "sub_1",
      reason: "subscription_cycle",
      status: "open",
      lines: [line("pro", 1000)],
    });
    await hook(events.invoicePaymentFailed("evt_fail_1", "in_cycle_3"));
    await hook(events.invoicePaid("evt_spoof_paid", "in_cycle_3"));
    sub.status = "past_due";
    await hook(events.subscriptionUpdated("evt_pd", sub));
    const duringFailure = { plan: planOf(u), monthly: monthly(u) };
    sub.status = "active";
    await hook(events.subscriptionUpdated("evt_recovered", sub));
    const afterRecoveryUpdate = { plan: planOf(u), monthly: monthly(u) };
    state.invoices.get("in_cycle_3").status = "paid";
    await hook(events.invoicePaid("evt_paid_late", "in_cycle_3"));
    const afterPaid = monthly(u);
    setMonthly(u, 980);
    await hook(events.invoicePaid("evt_paid_late_dup", "in_cycle_3"));
    record(
      "W8. failed payment grants nothing; recovery grants once via the paid invoice",
      duringFailure.plan === "free" &&
        duringFailure.monthly === 300 &&
        afterRecoveryUpdate.plan === "pro" &&
        afterRecoveryUpdate.monthly === 300 &&
        afterPaid === 1000 &&
        monthly(u) === 980,
      `during=${JSON.stringify(duringFailure)} recovered=${JSON.stringify(afterRecoveryUpdate)} paid=${afterPaid} dup=${monthly(u)}`
    );
  }

  // ---------------- Cancellation ----------------
  resetState();
  {
    const customer = addUser(u, "pro_plus");
    setMonthly(u, 700);
    state.redis.set(`credits:${u}:purchased`, 1000);
    const subA = addSubscription("sub_a", customer, "pro");
    const subB = addSubscription("sub_b", customer, "pro_plus");
    subB.status = "canceled";
    await hook(events.subscriptionDeleted("evt_del_b", subB));
    const withRemaining = { plan: planOf(u), monthly: monthly(u) };
    subA.status = "canceled";
    await hook(events.subscriptionDeleted("evt_del_a", subA));
    record(
      "W9. deletion keeps the paid plan while another active subscription remains",
      withRemaining.plan === "pro" && withRemaining.monthly === 700,
      `afterFirstDelete=${JSON.stringify(withRemaining)}`
    );
    record(
      "W10. final subscription ending returns to free with 50; purchased kept",
      planOf(u) === "free" && monthly(u) === 50 && purchased(u) === 1000,
      `plan=${planOf(u)} monthly=${monthly(u)} purchased=${purchased(u)}`
    );
  }

  // W11. Unknown price on a renewal invoice -> retryable 400, no grant.
  resetState();
  {
    const customer = addUser(u, "pro");
    setMonthly(u, 10);
    addSubscription("sub_1", customer, "pro");
    addInvoice("in_bad", {
      customer,
      subscription: "sub_1",
      reason: "subscription_cycle",
      lines: [line("price_other", 1000)],
    });
    const res = await hook(events.invoicePaid("evt_bad", "in_bad"));
    record(
      "W11. renewal with an unknown price is rejected, released and grants nothing",
      res.status === 400 && monthly(u) === 10 && !state.redis.has("stripe:event:evt_bad"),
      `status=${res.status} monthly=${monthly(u)}`
    );
  }

  // ---------------- Lazy monthly reset ----------------
  resetState();
  {
    addUser(u, "pro", { tokensResetAt: "2020-01-01T00:00:00.000Z" });
    setMonthly(u, 5);
    await resetMonthly.ensureMonthlyCredits(state.users.get(u));
    const paidKept = monthly(u) === 5 && state.calls.metadataUpdates.length === 0;

    resetState();
    addUser(u, "pro_plus");
    await resetMonthly.ensureMonthlyCredits(state.users.get(u));
    const paidNoKey = !state.redis.has(`credits:${u}:monthly`);
    record(
      "E1. paid users get no calendar-month refill",
      paidKept && paidNoKey,
      `paidKept=${paidKept} paidNoKeyUntouched=${paidNoKey}`
    );

    resetState();
    addUser(u, "free", { tokensResetAt: "2020-01-01T00:00:00.000Z" });
    setMonthly(u, 3);
    const due = await resetMonthly.ensureMonthlyCredits(state.users.get(u));
    const freeRefilled = monthly(u) === 50 && due.resetAt > "2020-01-01";

    resetState();
    addUser(u, "free", { tokensResetAt: "2099-01-01T00:00:00.000Z" });
    setMonthly(u, 3);
    await resetMonthly.ensureMonthlyCredits(state.users.get(u));
    record(
      "E2. free users keep the calendar-month refill to 50",
      freeRefilled && monthly(u) === 3,
      `refilledWhenDue=${freeRefilled} notDueKept=${monthly(u)}`
    );
  }
} finally {
  cleanup();
}

finish();
