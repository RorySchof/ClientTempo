/**
 * Shared harness for the mocked Stripe billing tests.
 * Compiles the real checkout and webhook routes plus lib/credits, lib/stripe
 * and lib/resetMonthly, and replaces only the external packages (stripe,
 * @upstash/redis, @clerk/nextjs/server) with in-memory fakes.
 * No network calls are made and .env.local is not read. The Redis fake
 * mirrors the Lua scripts' semantics; real Upstash Lua execution is not tested.
 */
import Module, { createRequire } from "module";
import { spawnSync } from "child_process";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join, resolve } from "path";

export const ROOT = resolve(import.meta.dirname, "..");

export const PRICES = {
  pro: "price_mock_pro",
  pro_plus: "price_mock_pro_plus",
  topup: "price_mock_topup",
};

const MOCK_ENV = {
  STRIPE_WEBHOOK_SECRET: "whsec_mock_not_a_real_secret",
  STRIPE_SECRET_KEY: "sk_test_mock_not_a_real_key",
  STRIPE_PRICE_ID_PRO: PRICES.pro,
  STRIPE_PRICE_ID_PRO_PLUS: PRICES.pro_plus,
  STRIPE_TOKEN_PRICE_ID: PRICES.topup,
  UPSTASH_REDIS_REST_URL: "http://redis.mock.invalid",
  UPSTASH_REDIS_REST_TOKEN: "mock-token",
};

// ---- State ----
export const state = {};

export function resetState() {
  Object.assign(state, {
    redis: new Map(),
    users: new Map(),
    customers: new Map(),
    subscriptions: new Map(),
    sessions: new Map(),
    invoices: new Map(),
    idempotency: new Map(),
    calls: {
      customersCreate: [],
      checkoutCreate: [],
      portalCreate: [],
      subscriptionsUpdate: [],
      metadataUpdates: [],
      releases: [],
    },
    authUserId: null,
    searchLag: false,
    failCheckoutCreate: null,
    failEvalOnce: false,
    failMetadataUpdateOnce: false,
    failReleaseAlways: false,
    nextId: 1,
  });
  errors.length = 0;
}

export const errors = [];

function newId(prefix) {
  return `${prefix}_mock_${state.nextId++}`;
}

function withIdempotency(key, create) {
  if (key && state.idempotency.has(key)) return state.idempotency.get(key);
  const result = create();
  if (key) state.idempotency.set(key, result);
  return result;
}

// ---- Fake Upstash Redis ----
function incrbySync(key, n) {
  const v = Number(state.redis.get(key) || 0) + Number(n);
  state.redis.set(key, v);
  return v;
}

const fakeRedis = {
  async get(key) {
    return state.redis.has(key) ? state.redis.get(key) : null;
  },
  async set(key, value, opts) {
    if (opts?.nx && state.redis.has(key)) return null;
    state.redis.set(key, value);
    return "OK";
  },
  async del(key) {
    if (key.startsWith("stripe:event:")) {
      state.calls.releases.push(key);
      if (state.failReleaseAlways) throw new Error("mock release failure");
    }
    return state.redis.delete(key) ? 1 : 0;
  },
  async incrby(key, n) {
    return incrbySync(key, n);
  },
  async decrby(key, n) {
    return incrbySync(key, -Number(n));
  },
  // Mirrors lib/credits.ts scripts: markers checked first, credit write, then
  // markers; a thrown error leaves nothing written. No await inside, so it is
  // atomic like a Lua script.
  async eval(_script, keys, args) {
    if (state.failEvalOnce) {
      state.failEvalOnce = false;
      throw new Error("induced redis eval failure");
    }
    const monthlyScript = args.length === 2;
    const markers = monthlyScript ? keys.slice(0, -1) : [keys[0]];
    const target = monthlyScript ? keys[keys.length - 1] : keys[1];
    const mode = monthlyScript ? args[1] : "add";
    if (markers.some((m) => state.redis.has(m))) return 0;
    if (mode === "set") state.redis.set(target, Number(args[0]));
    else incrbySync(target, Number(args[0]));
    for (const m of markers) state.redis.set(m, "1");
    return 1;
  },
  async lpush(key, value) {
    const list = state.redis.get(key) || [];
    list.unshift(value);
    state.redis.set(key, list);
  },
  async ltrim() {},
  async lrange(key) {
    return state.redis.get(key) || [];
  },
};

// ---- Fake Stripe ----
const fakeStripe = {
  webhooks: {
    constructEvent(raw, signature, secret) {
      if (signature !== "mock-valid-signature" || !secret) {
        throw new Error("bad signature");
      }
      return JSON.parse(raw);
    },
  },
  customers: {
    async search({ query }) {
      if (state.searchLag) return { data: [] };
      const userId = /clerkUserId'\]:'([^']+)'/.exec(query)?.[1];
      return {
        data: [...state.customers.values()].filter(
          (c) => c.metadata.clerkUserId === userId
        ),
      };
    },
    async create(params, opts) {
      state.calls.customersCreate.push({ params, opts });
      return withIdempotency(opts?.idempotencyKey, () => {
        const customer = { id: newId("cus"), metadata: { ...params.metadata } };
        state.customers.set(customer.id, customer);
        return customer;
      });
    },
    async retrieve(id) {
      const customer = state.customers.get(id);
      if (!customer) throw new Error("No such customer");
      return customer;
    },
  },
  subscriptions: {
    async list({ customer }) {
      return {
        data: [...state.subscriptions.values()]
          .filter((s) => s.customer === customer)
          .map((s) => structuredClone(s)),
      };
    },
    async retrieve(id) {
      return structuredClone(state.subscriptions.get(id));
    },
    async update(...args) {
      state.calls.subscriptionsUpdate.push(args);
      throw new Error("subscriptions.update must not be called");
    },
  },
  checkout: {
    sessions: {
      async create(params, opts) {
        state.calls.checkoutCreate.push({ params, opts });
        if (state.failCheckoutCreate) throw new Error(state.failCheckoutCreate);
        return withIdempotency(opts?.idempotencyKey, () => {
          const id = newId("cs");
          const session = { id, url: `https://checkout.mock/${id}`, ...params };
          state.sessions.set(id, session);
          return session;
        });
      },
      async retrieve(id) {
        return state.sessions.get(id);
      },
    },
  },
  billingPortal: {
    sessions: {
      async create(params) {
        state.calls.portalCreate.push(params);
        return { url: `https://portal.mock/${params.customer}` };
      },
    },
  },
  invoices: {
    async retrieve(id) {
      const invoice = state.invoices.get(id);
      if (!invoice) throw new Error("No such invoice");
      return structuredClone(invoice);
    },
    async listLineItems(id) {
      return { data: structuredClone(state.invoices.get(id).lines.data) };
    },
  },
};

function FakeStripe() {
  return fakeStripe;
}

// ---- Fake Clerk ----
const clerkMock = {
  async auth() {
    return { userId: state.authUserId };
  },
  async clerkClient() {
    return {
      users: {
        async getUser(id) {
          const user = state.users.get(id);
          if (!user) throw new Error("mock user not found");
          return user;
        },
        async updateUserMetadata(id, { publicMetadata }) {
          if (state.failMetadataUpdateOnce) {
            state.failMetadataUpdateOnce = false;
            throw new Error("induced Clerk failure");
          }
          state.calls.metadataUpdates.push({ id, publicMetadata });
          const user = state.users.get(id);
          user.publicMetadata = { ...user.publicMetadata, ...publicMetadata };
        },
      },
    };
  },
};

// ---- Compile and load ----
const SOURCES = [
  "app/api/stripe/checkout/route.ts",
  "app/api/stripe/webhook/route.ts",
  "lib/credits.ts",
  "lib/stripe.ts",
  "lib/resetMonthly.ts",
];

export function loadModules(tmpName) {
  Object.assign(process.env, MOCK_ENV);
  delete process.env.STRIPE_TOKEN_GRANT;

  const outDir = join(ROOT, "scripts", tmpName);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const tsconfigPath = join(outDir, "tsconfig.json");
  writeFileSync(
    tsconfigPath,
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        moduleResolution: "node",
        esModuleInterop: true,
        skipLibCheck: true,
        noCheck: true,
        strict: false,
        types: [],
        rootDir: ROOT,
        outDir,
      },
      files: SOURCES.map((f) => join(ROOT, f)),
    })
  );
  const tsc = join(ROOT, "node_modules/typescript/bin/tsc");
  const compiled = spawnSync(process.execPath, [tsc, "-p", tsconfigPath], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (compiled.status !== 0) {
    rmSync(outDir, { recursive: true, force: true });
    throw new Error(`tsc failed: ${compiled.stderr || compiled.stdout}`);
  }

  const mocks = {
    stripe: FakeStripe,
    "@upstash/redis": { Redis: { fromEnv: () => fakeRedis } },
    "@clerk/nextjs/server": clerkMock,
  };
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (Object.hasOwn(mocks, request)) return mocks[request];
    if (request.startsWith("@/")) {
      return originalLoad.call(this, join(outDir, request.slice(2)), parent, isMain);
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  const originalError = console.error;
  console.error = (...args) => {
    errors.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(" "));
  };

  const require = createRequire(join(ROOT, "package.json"));
  const load = (file) => require(join(outDir, file.replace(/\.ts$/, ".js")));
  const modules = {
    checkout: load("app/api/stripe/checkout/route.ts"),
    webhook: load("app/api/stripe/webhook/route.ts"),
    credits: load("lib/credits.ts"),
    resetMonthly: load("lib/resetMonthly.ts"),
  };

  function cleanup() {
    Module._load = originalLoad;
    console.error = originalError;
    rmSync(outDir, { recursive: true, force: true });
  }
  return { ...modules, cleanup };
}

// ---- Results ----
export const results = [];
export function record(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}
export function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

// ---- Fixtures ----
export function addUser(userId, plan = "free", extra = {}) {
  state.users.set(userId, {
    id: userId,
    publicMetadata: { plan, pro: plan !== "free", ...extra },
  });
  const customer = { id: `cus_${userId}`, metadata: { clerkUserId: userId } };
  state.customers.set(customer.id, customer);
  return customer.id;
}

export function addSubscription(id, customer, plan, status = "active", periodEnd = 2_000_000_000) {
  const subscription = {
    id,
    customer,
    status,
    metadata: {},
    items: { data: [{ id: `si_${id}`, price: { id: PRICES[plan] }, current_period_end: periodEnd }] },
  };
  state.subscriptions.set(id, subscription);
  return subscription;
}

export function line(plan, amount, { proration = false, periodEnd = 2_000_000_000 } = {}) {
  return {
    amount,
    period: { start: periodEnd - 2_592_000, end: periodEnd },
    pricing: { type: "price_details", price_details: { price: PRICES[plan] ?? plan } },
    parent: {
      type: "subscription_item_details",
      subscription_item_details: { proration },
    },
  };
}

export function addInvoice(id, { customer, subscription, reason, lines, status = "paid" }) {
  state.invoices.set(id, {
    id,
    customer,
    status,
    billing_reason: reason,
    parent: { subscription_details: { subscription, metadata: {} } },
    lines: { data: lines, has_more: false },
  });
}

export function monthly(userId) {
  return Number(state.redis.get(`credits:${userId}:monthly`) ?? NaN);
}

export function purchased(userId) {
  return Number(state.redis.get(`credits:${userId}:purchased`) ?? 0);
}

export function setMonthly(userId, n) {
  state.redis.set(`credits:${userId}:monthly`, n);
}

export function planOf(userId) {
  return state.users.get(userId).publicMetadata.plan;
}

// ---- Requests ----
export async function deliver(POST, event) {
  try {
    return await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "mock-valid-signature" },
        body: JSON.stringify(event),
      })
    );
  } catch {
    return { status: "threw" };
  }
}

export async function checkoutRequest(POST, userId, body) {
  state.authUserId = userId;
  const response = await POST(
    new Request("http://localhost/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
  return { status: response.status, body: await response.json() };
}

export const events = {
  invoicePaid: (id, invoiceId) => ({
    id,
    type: "invoice.paid",
    data: { object: { id: invoiceId } },
  }),
  invoicePaymentFailed: (id, invoiceId) => ({
    id,
    type: "invoice.payment_failed",
    data: { object: { id: invoiceId } },
  }),
  subscriptionUpdated: (id, subscription) => ({
    id,
    type: "customer.subscription.updated",
    data: { object: structuredClone(subscription) },
  }),
  subscriptionDeleted: (id, subscription) => ({
    id,
    type: "customer.subscription.deleted",
    data: { object: { ...structuredClone(subscription), status: "canceled" } },
  }),
  checkoutSubscription: (id, userId, customer) => ({
    id,
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_${id}`,
        mode: "subscription",
        customer,
        metadata: { clerkUserId: userId, type: "subscription", plan: "pro" },
      },
    },
  }),
  checkoutTopup: (id, userId, sessionId = `cs_${id}`) => {
    state.sessions.set(sessionId, {
      id: sessionId,
      line_items: { data: [{ price: { id: PRICES.topup } }] },
    });
    return {
      id,
      type: "checkout.session.completed",
      data: {
        object: {
          id: sessionId,
          mode: "payment",
          metadata: { clerkUserId: userId, type: "credits" },
        },
      },
    };
  },
};
