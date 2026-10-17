"use client";

//ShowingNotesForm.jsx

import { useState } from "react";
import { colors, type, sectionHeaderBar, calloutBox } from "./theme";

const emptyShowing = () => ({ address: "", notes: "" });

/** Split a comma-separated input into trimmed non-empty strings. */
function parseListInput(value) {
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ShowingNotesForm({ onCreated }) {
  const [sellerNames, setSellerNames] = useState("");
  const [sellerEmails, setSellerEmails] = useState("");
  const [showings, setShowings] = useState([emptyShowing()]);
  const [realtorNotes, setRealtorNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitHovered, setSubmitHovered] = useState(false);

  function updateShowing(field, value) {
    setShowings((prev) => [{ ...prev[0], [field]: value }]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    const hasNotes = showings.some((s) => s.notes.trim());
    if (!hasNotes) {
      setError("Open house notes text is required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/open-house-notes/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(60000),
        body: JSON.stringify({
          open_houses: showings,
          seller_names: parseListInput(sellerNames),
          seller_emails: parseListInput(sellerEmails),
          realtorNotes: realtorNotes || "",
          store: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate summary");
      }

      setSellerNames("");
      setSellerEmails("");
      setShowings([emptyShowing()]);
      setRealtorNotes("");
      onCreated?.(data.note);
    } catch (err) {
      const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
      setError(timedOut ? "Timed out — try again." : err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>New open house note</div>
      <form onSubmit={handleSubmit} style={styles.form}>
        <section style={styles.clientCard}>
          <div style={styles.clientHeader}>
            <h3 style={styles.clientTitle}>Seller Details</h3>
          </div>
          <div style={styles.clientBody}>
            <div style={styles.clientField}>
              <label style={styles.clientLabel}>Seller name(s)</label>
              <input
                type="text"
                style={styles.clientInput}
                value={sellerNames}
                onChange={(e) => setSellerNames(e.target.value)}
                placeholder="e.g., Sarah Thompson, Michael Lee"
              />
            </div>
            <div style={styles.clientField}>
              <label style={styles.clientLabel}>Seller email(s)</label>
              <input
                type="text"
                style={styles.clientInput}
                value={sellerEmails}
                onChange={(e) => setSellerEmails(e.target.value)}
                placeholder="e.g., sarah@example.com, michael@example.com"
              />
            </div>
          </div>
        </section>

        <div style={styles.showingBlock}>
          <label style={styles.label}>
            Property Address
            <input
              style={styles.input}
              value={showings[0].address}
              onChange={(e) => updateShowing("address", e.target.value)}
              placeholder="123 Oak St"
            />
          </label>

          <label style={styles.label}>
            Visitor Feedback
            <textarea
              style={styles.textarea}
              value={showings[0].notes}
              onChange={(e) => updateShowing("notes", e.target.value)}
              rows={8}
              placeholder="Paste visitor notes from today's open house..."
            />
          </label>
        </div>

        <section style={styles.realtorNotesCard}>
          <label style={styles.label}>
            Realtor Notes (optional)
            <textarea
              style={styles.realtorNotesTextarea}
              value={realtorNotes}
              onChange={(e) => setRealtorNotes(e.target.value)}
              rows={4}
              placeholder="Add any personal notes, observations, or context you want included in the report..."
            />
          </label>
        </section>

        {error ? <p style={styles.error}>{error}</p> : null}

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
          {loading ? "Generating summary…" : "Generate report"}
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
  realtorNotesCard: {
    ...calloutBox,
    marginBottom: "1.25rem",
    padding: "1rem 1.15rem",
    borderLeft: `3px solid ${colors.navy}`,
  },
  realtorNotesTextarea: {
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
    background: colors.bg,
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
};
