"use client";

import Link from "next/link";
import {
  Show,
  UserButton,
  SignInButton,
  SignUpButton,
} from "@clerk/nextjs";
import { colors } from "@/components/dashboard/theme";

function MenuIcon({ path }: { path: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

export default function NavBar() {
  return (
    <nav
      className="px-6 py-3"
      style={{
        borderBottom: `1px solid ${colors.hairline}`,
        background: colors.bg,
      }}
    >
      <div className="grid grid-cols-3 items-center">
        <div />
        <Link
          href="/dashboard"
          className="justify-self-center text-base font-semibold tracking-tight"
          style={{ color: colors.navy }}
        >
          ClientTempo
        </Link>

        <div className="flex items-center justify-end gap-3">
          <Show when="signed-out">
            <SignInButton>
              <button
                type="button"
                className="text-sm"
                style={{ color: colors.slate }}
              >
                Sign In
              </button>
            </SignInButton>
            <SignUpButton>
              <button
                type="button"
                className="rounded px-3 py-1.5 text-sm font-medium text-white"
                style={{ background: colors.navy }}
              >
                Sign Up
              </button>
            </SignUpButton>
          </Show>

          <Show when="signed-in">
            <UserButton
              appearance={{
                variables: {
                  colorPrimary: colors.navy,
                },
                elements: {
                  avatarBox: {
                    width: 32,
                    height: 32,
                    backgroundColor: colors.slate,
                    color: "white",
                  },
                  userButtonPopoverActionButton: {
                    color: colors.ink,
                    "&:hover": { backgroundColor: colors.paleAccent },
                  },
                  userButtonPopoverFooter: { display: "none" },
                },
              }}
            >
              <UserButton.MenuItems>
                <UserButton.Link
                  label="Billing"
                  href="/billing"
                  labelIcon={
                    <MenuIcon path="M4 6h16M4 10h16M4 14h10M4 18h7" />
                  }
                />
                {/* TODO: point to Stripe Billing Portal route when it exists */}
                <UserButton.Link
                  label="Manage Subscription"
                  href="/billing"
                  labelIcon={
                    <MenuIcon path="M12 3v18M8 8h7a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h8" />
                  }
                />
              </UserButton.MenuItems>
            </UserButton>
          </Show>
        </div>
      </div>
    </nav>
  );
}
