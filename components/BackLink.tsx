"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { colors } from "@/components/dashboard/theme";

type Props = {
  fallbackHref: string;
};

// router.back() only stays in the app when this tab was opened from one of
// our own pages; otherwise the fallback is used so Back never leaves the app
// or returns to an auth screen.
function canReturnInApp() {
  if (window.history.length < 2 || !document.referrer) return false;
  try {
    const referrer = new URL(document.referrer);
    return (
      referrer.origin === window.location.origin &&
      !/^\/sign-(in|up)(\/|$)/.test(referrer.pathname)
    );
  } catch {
    return false;
  }
}

export default function BackLink({ fallbackHref }: Props) {
  const router = useRouter();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!canReturnInApp()) return;
    event.preventDefault();
    router.back();
  }

  return (
    <nav className="mb-1.5 text-sm" aria-label="Back">
      <Link
        href={fallbackHref}
        onClick={handleClick}
        className="rounded-sm text-sm no-underline hover:!text-[#1A2331] focus-visible:!text-[#1A2331] focus-visible:underline focus-visible:outline-none"
        style={{ color: colors.slate }}
      >
        ← Back
      </Link>
    </nav>
  );
}
