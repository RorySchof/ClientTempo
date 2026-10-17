import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Redis } from "@upstash/redis";
import { requireProUser } from "@/lib/requireProUser";
import { planLabel } from "@/lib/credits";
import { getUserPlan } from "@/lib/resetMonthly";

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
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "0.9rem",
  },
  th: {
    textAlign: "left" as const,
    color: colors.navy,
    fontWeight: 650,
    padding: "0.65rem 0.5rem",
    borderBottom: `1px solid ${colors.hairline}`,
  },
  td: {
    color: colors.ink,
    padding: "0.65rem 0.5rem",
    borderBottom: `1px solid ${colors.hairline}`,
    verticalAlign: "top" as const,
  },
};

function formatResetDate(value: unknown) {
  if (typeof value !== "string" || !value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
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

function userEmail(user: {
  primaryEmailAddress?: { emailAddress?: string } | null;
  emailAddresses?: { emailAddress?: string }[];
}) {
  return (
    user.primaryEmailAddress?.emailAddress ||
    user.emailAddresses?.[0]?.emailAddress ||
    "—"
  );
}

async function listAllUsers() {
  const clerk = await clerkClient();
  const users = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const page = await clerk.users.getUserList({ limit, offset });
    const batch = Array.isArray(page?.data)
      ? page.data
      : Array.isArray(page)
        ? page
        : [];
    users.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  return users;
}

async function getCreditBuckets(userIds: string[]) {
  if (!userIds.length) return new Map<string, { monthly: number; purchased: number }>();

  const r = Redis.fromEnv();
  const keys = userIds.flatMap((id) => [
    `credits:${id}:monthly`,
    `credits:${id}:purchased`,
  ]);
  const values = await r.mget(...keys);
  const buckets = new Map<string, { monthly: number; purchased: number }>();

  userIds.forEach((id, index) => {
    buckets.set(id, {
      monthly: asCount(values[index * 2]),
      purchased: asCount(values[index * 2 + 1]),
    });
  });

  return buckets;
}

export default async function AdminTokensPage() {
  await auth.protect();
  const result = await requireProUser();
  if (result instanceof Response) redirect("/billing");
  if (result.user.publicMetadata.role !== "admin") redirect("/dashboard");

  const users = await listAllUsers();
  const buckets = await getCreditBuckets(users.map((user) => user.id));

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Admin Tokens</h1>
        <p style={styles.subtitle}>Token balances for all users</p>
      </header>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>User ID</th>
            <th style={styles.th}>Email</th>
            <th style={styles.th}>Plan</th>
            <th style={styles.th}>Monthly</th>
            <th style={styles.th}>Purchased</th>
            <th style={styles.th}>Next reset</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const credits = buckets.get(user.id) ?? { monthly: 0, purchased: 0 };
            return (
              <tr key={user.id}>
                <td style={styles.td}>{user.id}</td>
                <td style={styles.td}>{userEmail(user)}</td>
                <td style={styles.td}>{planLabel(getUserPlan(user))}</td>
                <td style={styles.td}>{credits.monthly}</td>
                <td style={styles.td}>{credits.purchased}</td>
                <td style={styles.td}>
                  {formatResetDate(user.publicMetadata?.tokensResetAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
