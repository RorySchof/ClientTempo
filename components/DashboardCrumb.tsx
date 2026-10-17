import Link from "next/link";
import { colors } from "@/components/dashboard/theme";

export default function DashboardCrumb() {
  return (
    <nav className="mb-1.5 text-sm" aria-label="Breadcrumb">
      <Link
        href="/dashboard"
        className="text-sm no-underline hover:!text-[#1A2331]"
        style={{ color: colors.slate }}
      >
        ← Dashboard
      </Link>
    </nav>
  );
}
