import { auth } from "@clerk/nextjs/server";
import UpgradeButton from "@/components/UpgradeButton";
import StripeRedirectButton from "@/components/StripeRedirectButton";
import { loadCreditContext } from "@/lib/requireAuthWithTokens";
import {
  FREE_MONTHLY,
  PRO_MONTHLY,
  PRO_PLUS_MONTHLY,
  TOPUP_CREDITS,
  planLabel,
} from "@/lib/credits";

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
  plans: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "1.25rem",
    margin: "1.25rem 0 0",
  },
  plan: {
    border: `1px solid ${colors.hairline}`,
    borderRadius: "6px",
    padding: "1.25rem",
    background: colors.bg,
  },
  planTitle: {
    fontSize: "1.15rem",
    fontWeight: 650,
    margin: 0,
    color: colors.navy,
  },
  planMeta: {
    margin: "0.5rem 0 0",
    color: colors.slate,
    fontSize: "0.95rem",
  },
  note: {
    margin: "1.25rem 0 0",
    color: colors.slate,
    fontSize: "0.95rem",
  },
  actions: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "0.75rem",
    marginTop: "1.25rem",
  },
};

export default async function PricingPage() {
  await auth.protect();
  const { userId } = await auth();
  if (!userId) return null;

  const ctx = await loadCreditContext(userId);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Pricing</h1>
        <p style={styles.subtitle}>Choose a plan or add purchased credits</p>
      </header>

      <p style={styles.meta}>Current plan: {planLabel(ctx.plan)}</p>
      <p style={styles.meta}>Credits remaining: {ctx.credits}</p>

      <div style={styles.plans}>
        <section style={styles.plan}>
          <h2 style={styles.planTitle}>Free</h2>
          <p style={styles.planMeta}>$0</p>
          <p style={styles.planMeta}>{FREE_MONTHLY} credits/month</p>
        </section>
        <section style={styles.plan}>
          <h2 style={styles.planTitle}>Pro</h2>
          <p style={styles.planMeta}>$10 USD/month</p>
          <p style={styles.planMeta}>
            {PRO_MONTHLY.toLocaleString("en-US")} credits/month
          </p>
        </section>
        <section style={styles.plan}>
          <h2 style={styles.planTitle}>Pro Plus</h2>
          <p style={styles.planMeta}>$20 USD/month</p>
          <p style={styles.planMeta}>
            {PRO_PLUS_MONTHLY.toLocaleString("en-US")} credits/month
          </p>
        </section>
        <section style={styles.plan}>
          <h2 style={styles.planTitle}>Top-up</h2>
          <p style={styles.planMeta}>$10 USD</p>
          <p style={styles.planMeta}>
            {TOPUP_CREDITS.toLocaleString("en-US")} additional credits
          </p>
          <p style={styles.planMeta}>Never expires</p>
        </section>
      </div>
      <p style={styles.note}>
        Purchased credits are added on top of your monthly credit balance and
        survive monthly resets.
      </p>
      {ctx.pro ? (
        <p style={styles.note}>
          To switch plans or cancel, use Manage Subscription.
        </p>
      ) : null}

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
