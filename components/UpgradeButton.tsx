"use client";

import { useUser } from "@clerk/nextjs";
import { useState } from "react";

const colors = {
  navy: "#1B3A4B",
  navyDark: "#132A37",
  danger: "#9C3B3B",
};

type Props = {
  plan?: "pro" | "pro_plus";
  label?: string;
};

export default function UpgradeButton({
  plan = "pro",
  label,
}: Props) {
  const { isLoaded, isSignedIn, user } = useUser();
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentPlan =
    user?.publicMetadata?.plan === "pro_plus"
      ? "pro_plus"
      : user?.publicMetadata?.plan === "pro" ||
          user?.publicMetadata?.pro === true
        ? "pro"
        : "free";

  if (!isLoaded || !isSignedIn || currentPlan === plan) {
    return null;
  }

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      let data: { url?: string } = {};
      try {
        data = (await response.json()) as { url?: string };
      } catch {
        setError("Couldn't start checkout — try again.");
        return;
      }
      if (!response.ok || !data.url) {
        setError("Couldn't start checkout — try again.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Couldn't start checkout — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          ...styles.primaryButton,
          ...(hovered && !loading ? styles.primaryButtonHover : {}),
          ...(loading ? styles.primaryButtonDisabled : {}),
        }}
      >
        {loading
          ? "Redirecting…"
          : label || (plan === "pro_plus" ? "Upgrade to Pro Plus" : "Upgrade to Pro")}
      </button>
      {error ? <p style={styles.error}>{error}</p> : null}
    </div>
  );
}

const styles = {
  primaryButton: {
    background: colors.navy,
    color: "white",
    fontSize: "0.9rem",
    fontWeight: 600,
    padding: "0.65rem 1.1rem",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    transition: "background 0.12s ease",
  },
  primaryButtonHover: {
    background: colors.navyDark,
  },
  primaryButtonDisabled: {
    opacity: 0.55,
    cursor: "not-allowed",
  },
  error: {
    color: colors.danger,
    fontSize: "0.9rem",
    margin: "0.65rem 0 0",
  },
};
