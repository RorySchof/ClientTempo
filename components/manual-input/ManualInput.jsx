"use client";

// src/pages/ManualInput.jsx

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardCrumb from "@/components/DashboardCrumb";

// Design tokens mirrored from Showing Notes (theme.js / pageStyles.js)
const colors = {
  ink: "#1A2331",
  slate: "#4B5768",
  slateLight: "#8592A3",
  navy: "#1B3A4B",
  navyDark: "#132A37",
  navyLight: "#E7EEF0",
  paleAccent: "#E7EEF0",
  hairline: "#DCE3E8",
  bgMuted: "#F7F9FA",
  bg: "#FFFFFF",
  danger: "#9C3B3B",
};

const type = {
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif',
};

const sectionHeaderBar = {
  background: colors.navy,
  color: "#FFFFFF",
  padding: "0.65rem 1.25rem",
  fontSize: "0.95rem",
  fontWeight: 600,
  letterSpacing: "0.01em",
  borderRadius: "6px 6px 0 0",
};

const calloutBox = {
  background: colors.paleAccent,
  border: `1px solid ${colors.hairline}`,
  borderRadius: "6px",
  padding: "0.85rem 1rem",
};

/** Split a comma-separated input into trimmed non-empty strings. */
function parseListInput(value) {
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ManualInput({ inboundAddress = "" }) {
  const router = useRouter();
  const [clientNames, setClientNames] = useState("");
  const [clientEmails, setClientEmails] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitHovered, setSubmitHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyHovered, setCopyHovered] = useState(false);

  async function handleCopyAddress() {
    if (!inboundAddress) return;
    try {
      await navigator.clipboard.writeText(inboundAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    if (!text.trim()) {
      setError("Email text is required.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/manual-input/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(60000),
        body: JSON.stringify({
          text,
          client_names: parseListInput(clientNames),
          client_emails: parseListInput(clientEmails),
          email_subject: emailSubject,
          store: true,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

      const note = data.note;
      if (!note?.id) {
        throw new Error("Reply generation returned no usable fields");
      }

      setClientNames("");
      setClientEmails("");
      setEmailSubject("");
      setText("");
      router.push(`/manual-input/notes/${note.id}`);
    } catch (err) {
      const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
      setError(
        timedOut
          ? "Timed out — try again."
          : "Something went wrong generating the reply. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <DashboardCrumb />
      <header style={styles.header}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>Realtor Reply</h1>
            <p style={styles.subtitle}>Draft a professional reply to your client</p>
          </div>
          <Link href="/manual-input/notes" style={styles.navLink}>
            All replies
          </Link>
        </div>
      </header>

      {inboundAddress ? (
        <section style={styles.forwardBox} aria-label="Forwarding address">
          <p style={styles.forwardText}>
            Prefer to skip the form? Simply forward any client email to your personal ClientTempo address.
          </p>
          <div style={styles.forwardRow}>
            <p style={styles.forwardAddress}>{inboundAddress}</p>
            <button
              type="button"
              onClick={handleCopyAddress}
              onMouseEnter={() => setCopyHovered(true)}
              onMouseLeave={() => setCopyHovered(false)}
              style={{
                ...styles.copyButton,
                ...(copyHovered ? styles.copyButtonHover : {}),
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </section>
      ) : null}

      <div style={styles.card}>
        <div style={styles.cardHeader}>New client reply</div>
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
            <div style={styles.field}>
              <label htmlFor="realtor-reply-subject" style={styles.fieldCaption}>
                Email subject
              </label>
              <input
                id="realtor-reply-subject"
                type="text"
                style={{ ...styles.input, marginTop: 0 }}
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="e.g., Re: Sunday showing follow-up"
              />
            </div>

            <div style={styles.field}>
              <label htmlFor="realtor-reply-message" style={styles.fieldCaption}>
                Client Message
              </label>
              <textarea
                id="realtor-reply-message"
                style={{ ...styles.textarea, marginTop: 0 }}
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                placeholder="Paste the email here..."
              />
            </div>
          </div>

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
            {loading ? "Generating reply…" : "Generate draft"}
          </button>
        </form>
      </div>
    </div>
  );
}

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
  headerRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "1rem",
    flexWrap: "wrap",
  },
  navLink: {
    fontSize: "0.9rem",
    fontWeight: 600,
    color: colors.navy,
    textDecoration: "none",
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
  forwardBox: {
    ...calloutBox,
    marginBottom: "1.75rem",
  },
  forwardText: {
    margin: 0,
    color: colors.ink,
    fontSize: "0.95rem",
  },
  forwardRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginTop: "0.75rem",
    flexWrap: "wrap",
  },
  forwardAddress: {
    margin: 0,
    flex: "1 1 16rem",
    minWidth: 0,
    padding: "0.55rem 0.75rem",
    borderRadius: "6px",
    border: `1px solid ${colors.hairline}`,
    background: colors.bg,
    color: colors.ink,
    fontSize: "0.9rem",
    lineHeight: 1.4,
    overflowWrap: "anywhere",
  },
  copyButton: {
    background: colors.navy,
    color: "white",
    fontSize: "0.9rem",
    fontWeight: 600,
    padding: "0.55rem 1rem",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    transition: "background 0.12s ease",
  },
  copyButtonHover: {
    background: colors.navyDark,
  },
  card: {
    marginBottom: "2rem",
    border: `1px solid ${colors.hairline}`,
    borderRadius: "8px",
    overflow: "hidden",
    background: colors.bg,
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
  field: {
    display: "block",
    marginBottom: "0.85rem",
  },
  fieldCaption: {
    display: "block",
    fontSize: "0.9rem",
    fontWeight: 500,
    marginBottom: "0.35rem",
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
    background: colors.bg,
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
