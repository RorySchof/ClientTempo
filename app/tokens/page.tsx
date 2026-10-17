import { auth } from "@clerk/nextjs/server";
import { Redis } from "@upstash/redis";
import { loadCreditContext } from "@/lib/requireAuthWithTokens";
import { listCreditEvents, monthlyAllowanceForPlan } from "@/lib/credits";

const colors = {
  ink: "#1A2331",
  slate: "#4B5768",
  navy: "#1B3A4B",
  hairline: "#DCE3E8",
  bg: "#FFFFFF",
};

const type = {
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif',
};

const styles = {
  page: {
    maxWidth: "960px",
    margin: "0 auto",
    padding: "2rem 1.5rem",
    fontFamily: type.fontFamily,
    color: colors.ink,
    lineHeight: 1.5,
    background: colors.bg,
  },
  header: {
    marginBottom: "1.75rem",
    paddingBottom: "1.25rem",
    borderBottom: `1px solid ${colors.hairline}`,
  },
  title: {
    fontSize: "1.6rem",
    fontWeight: 650,
    margin: 0,
    color: colors.navy,
    letterSpacing: "-0.01em",
  },
  subtitle: {
    margin: "0.35rem 0 0",
    color: colors.slate,
    fontSize: "0.95rem",
  },
  meta: {
    margin: "0 0 0.4rem",
    color: colors.ink,
    fontSize: "0.95rem",
  },
  list: {
    margin: "1.25rem 0 0",
    paddingLeft: "1.25rem",
    color: colors.ink,
    fontSize: "0.95rem",
  },
  listItem: {
    margin: "0 0 0.4rem",
  },
};

function formatResetDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function asCount(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

async function getCreditBuckets(userId: string) {
  const r = Redis.fromEnv();
  const [monthly, purchased] = await Promise.all([
    r.get(`credits:${userId}:monthly`),
    r.get(`credits:${userId}:purchased`),
  ]);
  return { monthly: asCount(monthly), purchased: asCount(purchased) };
}

export default async function TokenHistoryPage() {
  await auth.protect();
  const { userId } = await auth();
  if (!userId) return null;

  const ctx = await loadCreditContext(userId);
  const { monthly, purchased } = await getCreditBuckets(userId);
  const allotment = monthlyAllowanceForPlan(ctx.plan);
  const resetLabel = formatResetDate(ctx.resetAt);
  const creditEvents = await listCreditEvents(userId);

  const events = [
    `Monthly reset → ${allotment} credits`,
    ...(purchased > 0 ? [`Purchased → +${purchased} credits`] : []),
    ...creditEvents
      .filter((event) => event.type === "consumed")
      .map((event) => `Consumed → -${event.amount || 1} token${event.amount === 1 || !event.amount ? "" : "s"}`),
  ];

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Token History</h1>
        <p style={styles.subtitle}>Current balances and inferred activity</p>
      </header>

      <p style={styles.meta}>
        Monthly allowance: {allotment.toLocaleString("en-US")} credits
      </p>
      <p style={styles.meta}>Monthly credits: {monthly}</p>
      <p style={styles.meta}>Purchased credits: {purchased}</p>
      {resetLabel ? <p style={styles.meta}>Next reset: {resetLabel}</p> : null}

      <ul style={styles.list}>
        {events.map((event, index) => (
          <li key={`${event}-${index}`} style={styles.listItem}>
            {event}
          </li>
        ))}
      </ul>
    </div>
  );
}
