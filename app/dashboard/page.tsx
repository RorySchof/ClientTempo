import { auth } from "@clerk/nextjs/server";
import Dashboard from "@/components/dashboard/Dashboard";
import { loadCreditContext } from "@/lib/requireAuthWithTokens";

export default async function DashboardPage() {
  await auth.protect();
  const { userId } = await auth();
  if (!userId) return null;

  // Still refreshes the monthly token window and personal Realtor Reply
  // address. Neither is shown on the dashboard.
  await loadCreditContext(userId);
  return <Dashboard />;
}
