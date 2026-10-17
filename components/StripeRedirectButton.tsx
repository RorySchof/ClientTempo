"use client";

import { useState } from "react";

const colors = {
  navy: "#1B3A4B",
  navyDark: "#132A37",
  danger: "#9C3B3B",
  bg: "#FFFFFF",
};

type Props = {
  label: string;
  loadingLabel?: string;
  endpoint: string;
  body?: Record<string, string>;
  variant?: "primary" | "secondary";
};

export default function StripeRedirectButton({
  label,
  loadingLabel = "Redirecting…",
  endpoint,
  body,
  variant = "primary",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      let data: { url?: string } = {};
      try {
        data = (await response.json()) as { url?: string };
      } catch {
        setError("Couldn't continue — try again.");
        return;
      }
      if (!response.ok || !data.url) {
        setError("Couldn't continue — try again.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Couldn't continue — try again.");
    } finally {
      setLoading(false);
    }
  }

  const base =
    variant === "secondary" ? styles.secondaryButton : styles.primaryButton;
  const hover =
    variant === "secondary"
      ? styles.secondaryButtonHover
      : styles.primaryButtonHover;

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          ...base,
          ...(hovered && !loading ? hover : {}),
          ...(loading ? styles.disabled : {}),
        }}
      >
        {loading ? loadingLabel : label}
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
  secondaryButton: {
    background: colors.bg,
    color: colors.navy,
    fontSize: "0.9rem",
    fontWeight: 600,
    padding: "0.65rem 1.1rem",
    borderRadius: "6px",
    border: `1px solid ${colors.navy}`,
    cursor: "pointer",
    transition: "background 0.12s ease",
  },
  secondaryButtonHover: {
    background: "#E7EEF0",
  },
  disabled: {
    opacity: 0.55,
    cursor: "not-allowed",
  },
  error: {
    color: colors.danger,
    fontSize: "0.9rem",
    margin: "0.65rem 0 0",
  },
};
