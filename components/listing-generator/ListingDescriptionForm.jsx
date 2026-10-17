"use client";

//ListingDescriptionForm.jsx

import { useEffect, useState } from "react";
import { colors, type, sectionHeaderBar, calloutBox } from "./theme";

const CHAR_LIMIT_STORAGE_KEY = "listingGeneratorCharLimit";
const PRESET_CHAR_LIMITS = [300, 500, 800, 1000, 1500];

function parseStoredCharLimit(raw) {
  if (raw == null || raw === "" || raw === "none") {
    return { mode: "none", custom: "" };
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    return { mode: "none", custom: "" };
  }
  const int = Math.floor(n);
  if (PRESET_CHAR_LIMITS.includes(int)) {
    return { mode: String(int), custom: "" };
  }
  return { mode: "custom", custom: String(int) };
}

function persistCharLimit(mode, custom) {
  try {
    if (mode === "none") {
      localStorage.setItem(CHAR_LIMIT_STORAGE_KEY, "none");
      return;
    }
    if (mode === "custom") {
      const n = Number(custom);
      if (Number.isFinite(n) && n > 0) {
        localStorage.setItem(CHAR_LIMIT_STORAGE_KEY, String(Math.floor(n)));
      }
      return;
    }
    localStorage.setItem(CHAR_LIMIT_STORAGE_KEY, mode);
  } catch {
    // Ignore private-mode / storage failures.
  }
}

export default function ListingDescriptionForm({ onCreated }) {
  const [clientNames, setClientNames] = useState("");
  const [clientEmails, setClientEmails] = useState("");
  const [address, setAddress] = useState("");
  const [rawDescription, setRawDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitHovered, setSubmitHovered] = useState(false);
  const [charLimitMode, setCharLimitMode] = useState("none");
  const [customCharLimit, setCustomCharLimit] = useState("");

  useEffect(() => {
    try {
      const stored = parseStoredCharLimit(
        localStorage.getItem(CHAR_LIMIT_STORAGE_KEY)
      );
      setCharLimitMode(stored.mode);
      setCustomCharLimit(stored.custom);
    } catch {
      setCharLimitMode("none");
      setCustomCharLimit("");
    }
  }, []);

  function resolvedCharLimit() {
    if (charLimitMode === "none") return null;
    const n =
      charLimitMode === "custom" ? Number(customCharLimit) : Number(charLimitMode);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.floor(n);
  }

  function handleCharLimitModeChange(event) {
    const next = event.target.value;
    setCharLimitMode(next);
    persistCharLimit(next, customCharLimit);
  }

  function handleCustomCharLimitChange(event) {
    const next = event.target.value;
    setCustomCharLimit(next);
    persistCharLimit("custom", next);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (!rawDescription.trim()) {
      setError("Property description is required.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        address: address.trim(),
        description: rawDescription,
        clientNames,
        clientEmails,
        store: true,
      };
      const charLimit = resolvedCharLimit();
      if (charLimit != null) {
        payload.char_limit = charLimit;
      }

      const res = await fetch("/api/listing-generator/generate-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(60000),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate listing");
      }

      setClientNames("");
      setClientEmails("");
      setAddress("");
      setRawDescription("");
      onCreated?.(data.listing);
    } catch (err) {
      const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
      setError(timedOut ? "Timed out — try again." : err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>New listing description</div>
      <form onSubmit={handleSubmit} style={styles.form}>
        <section style={styles.clientCard}>
          <div style={styles.clientHeader}>
            <h3 style={styles.clientTitle}>Client Details</h3>
          </div>
          <div style={styles.clientBody}>
            <div style={styles.clientField}>
              <label style={styles.clientLabel}>Client name(s)</label>
              <input
                type="text"
                style={styles.clientInput}
                value={clientNames}
                onChange={(e) => setClientNames(e.target.value)}
                placeholder="e.g., Sarah Thompson, Michael Lee"
              />
            </div>
            <div style={styles.clientField}>
              <label style={styles.clientLabel}>Client email(s)</label>
              <input
                type="text"
                style={styles.clientInput}
                value={clientEmails}
                onChange={(e) => setClientEmails(e.target.value)}
                placeholder="e.g., sarah@example.com, michael@example.com"
              />
            </div>
          </div>
        </section>

        <div style={styles.showingBlock}>
          <label style={styles.label}>
            Property Address
            <input
              type="text"
              style={styles.input}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Oak St"
              autoComplete="street-address"
            />
          </label>

          <label style={styles.label}>
            Property Notes
            <textarea
              style={styles.textarea}
              value={rawDescription}
              onChange={(e) => setRawDescription(e.target.value)}
              rows={8}
              placeholder="Paste property features, room details, location notes…"
            />
          </label>
        </div>

        {error ? <p style={styles.error}>{error}</p> : null}

        <div style={styles.outputSettings}>
          <div style={styles.charLimitRow}>
            <label htmlFor="listing-char-limit" style={styles.charLimitLabel}>
              Character Limit
            </label>
            <select
              id="listing-char-limit"
              style={styles.charLimitSelect}
              value={charLimitMode}
              onChange={handleCharLimitModeChange}
            >
              <option value="none">None</option>
              {PRESET_CHAR_LIMITS.map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
              <option value="custom">Custom…</option>
            </select>
            {charLimitMode === "custom" ? (
              <input
                type="number"
                min={1}
                step={1}
                style={styles.charLimitCustom}
                value={customCharLimit}
                onChange={handleCustomCharLimitChange}
                placeholder="e.g. 650"
                aria-label="Custom character limit"
              />
            ) : null}
          </div>
        </div>

        <button
          type="submit"
          style={{
            ...styles.primaryButton,
            ...(submitHovered && !loading ? styles.primaryButtonHover : {}),
            ...(loading ? styles.primaryButtonDisabled : {}),
          }}
          disabled={loading}
          onMouseEnter={() => setSubmitHovered(true)}
          onMouseLeave={() => setSubmitHovered(false)}
        >
          {loading ? "Generating description…" : "Generate listing"}
        </button>
      </form>
    </div>
  );
}

const styles = {
  card: {
    marginBottom: "2rem",
    border: `1px solid ${colors.hairline}`,
    borderRadius: "8px",
    overflow: "hidden",
  },
  cardHeader: {
    ...sectionHeaderBar,
    borderRadius: 0,
  },
  form: {
    padding: "1.5rem",
    background: colors.bg,
  },
  clientCard: {
    ...calloutBox,
    padding: 0,
    marginBottom: "1.25rem",
  },
  clientHeader: {
    ...sectionHeaderBar,
    borderRadius: "6px 6px 0 0",
  },
  clientTitle: {
    margin: 0,
    fontSize: "1rem",
    fontWeight: 650,
  },
  clientBody: {
    padding: "1.25rem 1.5rem",
  },
  clientField: {
    marginBottom: "1rem",
  },
  clientLabel: {
    display: "block",
    fontSize: "0.85rem",
    fontWeight: 600,
    color: colors.slate,
    marginBottom: "0.35rem",
  },
  clientInput: {
    width: "100%",
    padding: "0.55rem 0.75rem",
    borderRadius: "6px",
    border: `1px solid ${colors.hairline}`,
    fontSize: "0.95rem",
    fontFamily: type.fontFamily,
    color: colors.ink,
    background: colors.bg,
    boxSizing: "border-box",
  },
  showingBlock: {
    marginBottom: "1rem",
  },
  label: {
    display: "block",
    fontSize: "0.9rem",
    fontWeight: 500,
    marginBottom: "0.85rem",
    color: colors.ink,
  },
  input: {
    display: "block",
    width: "100%",
    marginTop: "0.35rem",
    padding: "0.6rem 0.75rem",
    fontSize: "0.95rem",
    border: `1px solid ${colors.hairline}`,
    borderRadius: "6px",
    boxSizing: "border-box",
    fontFamily: type.fontFamily,
    color: colors.ink,
  },
  textarea: {
    display: "block",
    width: "100%",
    marginTop: "0.35rem",
    padding: "0.75rem",
    fontSize: "0.95rem",
    border: `1px solid ${colors.hairline}`,
    borderRadius: "6px",
    boxSizing: "border-box",
    fontFamily: type.fontFamily,
    color: colors.ink,
    lineHeight: 1.5,
    resize: "vertical",
  },
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
    margin: "0 0 0.75rem",
  },
  outputSettings: {
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
    marginBottom: "0.85rem",
  },
  charLimitRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    flexWrap: "wrap",
  },
  charLimitLabel: {
    fontSize: "0.85rem",
    fontWeight: 500,
    color: colors.ink,
  },
  charLimitSelect: {
    fontSize: "0.85rem",
    padding: "0.4rem 0.55rem",
    border: `1px solid ${colors.hairline}`,
    borderRadius: "6px",
    fontFamily: type.fontFamily,
    color: colors.ink,
    background: colors.bg,
  },
  charLimitCustom: {
    width: "6.5rem",
    fontSize: "0.85rem",
    padding: "0.4rem 0.55rem",
    border: `1px solid ${colors.hairline}`,
    borderRadius: "6px",
    fontFamily: type.fontFamily,
    color: colors.ink,
    background: colors.bg,
  },
};
