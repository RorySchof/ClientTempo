import { auth } from "@clerk/nextjs/server";
import UpgradeButton from "@/components/UpgradeButton";
import StripeRedirectButton from "@/components/StripeRedirectButton";
import { loadCreditContext } from "@/lib/requireAuthWithTokens";
import {
  getCreditBalances,
  monthlyAllowanceForPlan,
  planLabel,
} from "@/lib/credits";
import RefreshUser from "./RefreshUser";

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
  status: {
    margin: "0 0 1rem",
    color: colors.slate,
    fontSize: "0.95rem",
  },
  meta: {
    margin: "0 0 0.4rem",
    color: colors.ink,
    fontSize: "0.95rem",
  },
  usageTrack: {
    width: "100%",
    maxWidth: "280px",
    height: "8px",
    margin: "0.15rem 0 0.85rem",
    border: `1px solid ${colors.hairline}`,
    borderRadius: "999px",
    background: "#F7F9FA",
    overflow: "hidden",
  },
  usageFill: {
    height: "100%",
    background: colors.navy,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "0.75rem",
    marginTop: "1.25rem",
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

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{
    success?: string;
    canceled?: string;
    tokens?: string;
    out_of_tokens?: string;
  }>;
}) {
  await auth.protect();
  const { userId } = await auth();
  if (!userId) return null;

  const ctx = await loadCreditContext(userId);
  const { monthly } = await getCreditBalances(userId);
  const allowance = monthlyAllowanceForPlan(ctx.plan);
  const includedRemaining = Math.min(monthly, allowance);
  const percent = allowance > 0 ? (includedRemaining / allowance) * 100 : 0;
  const params = await searchParams;
  const success = params.success === "true";
  const canceled = params.canceled === "true";
  const tokens = params.tokens === "true";
  const outOfTokens = params.out_of_tokens === "true";
  const resetLabel = formatResetDate(ctx.resetAt);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Billing</h1>
        <p style={styles.subtitle}>Plan and subscription</p>
      </header>
      {outOfTokens ? (
        <p style={styles.status}>
          You are out of credits — upgrade or buy more.
        </p>
      ) : null}
      {success ? <p style={styles.status}>Processing subscription…</p> : null}
      {tokens ? <p style={styles.status}>Processing credit purchase…</p> : null}
      {canceled ? <p style={styles.status}>Checkout canceled.</p> : null}
      {success || tokens ? <RefreshUser /> : null}

      <p style={styles.meta}>Current plan: {planLabel(ctx.plan)}</p>
      <p style={styles.meta}>
        Monthly allowance: {allowance.toLocaleString("en-US")} credits
      </p>
      <p style={styles.meta}>
        Credits remaining: {ctx.credits.toLocaleString("en-US")}
      </p>
      <div
        style={styles.usageTrack}
        role="progressbar"
        aria-label="Included credits remaining"
        aria-valuemin={0}
        aria-valuemax={allowance}
        aria-valuenow={includedRemaining}
        aria-valuetext={`${includedRemaining.toLocaleString("en-US")} of ${allowance.toLocaleString("en-US")} included credits remaining`}
      >
        <div style={{ ...styles.usageFill, width: `${percent}%` }} />
      </div>
      {resetLabel ? <p style={styles.meta}>Next reset: {resetLabel}</p> : null}

      <div style={styles.actions}>
        {ctx.plan === "free" ? (
          <>
            <UpgradeButton plan="pro" />
            <UpgradeButton plan="pro_plus" />
          </>
        ) : null}
        <StripeRedirectButton
          label="Buy more credits"
          endpoint="/api/stripe/checkout"
          body={{ kind: "credits" }}
          variant={ctx.pro ? "primary" : "secondary"}
        />
        {ctx.pro ? (
          <StripeRedirectButton
            label="Manage Subscription"
            endpoint="/api/stripe/portal"
            variant="secondary"
          />
        ) : null}
      </div>
    </div>
  );
}
