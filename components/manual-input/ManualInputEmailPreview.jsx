"use client";

// src/components/ManualInputEmailPreview.jsx

import { useEffect, useState } from "react";
import { colors, type, sectionHeaderBar, calloutBox } from "./theme";

function savedReplyText(agent) {
  return (
    (typeof agent?.reply === "string" && agent.reply) ||
    (typeof agent?.draft_reply === "string" && agent.draft_reply) ||
    ""
  );
}

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function asLine(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "—";
}

function ItemList({ title, items }) {
  const list = asList(items);
  return (
    <section style={styles.listSection}>
      <h3 style={styles.blockTitle}>{title}</h3>
      {list.length === 0 ? (
        <p style={styles.empty}>None</p>
      ) : (
        <ul style={styles.list}>
          {list.map((item, index) => (
            <li key={`${title}-${index}`} style={styles.listItem}>
              {String(item)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Structured agent output using the same card chrome as Showing / Open House Notes.
 * Internal fields share one summary card. No snapshot document.
 */
export default function ManualInputEmailPreview({
  note,
  onNoteChange,
  agent,
  emailSubject = "",
  clientEmails = [],
}) {
  const resolvedAgent = note?.agent || agent;
  const resolvedSubject = note?.email_subject ?? emailSubject;
  const resolvedEmails = note?.client_emails ?? clientEmails;
  const savedReply = savedReplyText(resolvedAgent);

  const [hoveredButton, setHoveredButton] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveMessage, setSaveMessage] = useState(null);
  const [emailDraft, setEmailDraft] = useState(() => savedReply);
  const [copyFeedback, setCopyFeedback] = useState(null);

  useEffect(() => {
    setEmailDraft(savedReplyText(note?.agent || agent));
    setEditing(false);
    setSaveError(null);
    setSaveMessage(null);
  }, [note?.id]);

  const dirty = emailDraft !== savedReply;
  const summary = resolvedAgent?.client_snapshot || {};
  const actionItems = asList(resolvedAgent?.action_items);
  const coachNotes = asList(resolvedAgent?.coach_notes);
  const followUps = asList(
    resolvedAgent?.followups?.length
      ? resolvedAgent.followups
      : resolvedAgent?.followup_items
  );
  const mailtoTo = asList(resolvedEmails).join(",");
  const mailtoSubject = String(resolvedSubject || "").trim() || "Re: Your inquiry";
  const mailtoHref =
    `mailto:${mailtoTo}?subject=${encodeURIComponent(mailtoSubject)}` +
    `&body=${encodeURIComponent(emailDraft || "")}`;

  async function handleSave() {
    if (!note) return;
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/manual-input/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: {
            ...note,
            agent: {
              ...(note.agent && typeof note.agent === "object" ? note.agent : {}),
              reply: emailDraft,
            },
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save reply");
      onNoteChange?.(data.note);
      setEmailDraft(savedReplyText(data.note?.agent) || emailDraft);
      setEditing(false);
      setSaveMessage("Saved");
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (err) {
      setSaveError(err.message || "Failed to save reply");
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyReply(e) {
    e.preventDefault();
    if (!emailDraft) return;
    try {
      await navigator.clipboard.writeText(emailDraft);
      setCopyFeedback("Copied!");
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch {
      setCopyFeedback("Couldn't copy — try again.");
    }
  }

  return (
    <div style={styles.stack}>
      <section style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <span>Internal Summary (Not Sent to Client)</span>
        </div>
        <div style={styles.internalBody}>
          <section style={styles.block}>
            <h3 style={styles.blockTitle}>Client Summary</h3>
            <p style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Client Status</span>
              <span style={styles.body}>{asLine(summary.client_status)}</span>
            </p>
            <p style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Decision Factors</span>
              <span style={styles.body}>{asLine(summary.decision_factors)}</span>
            </p>
            <p style={{ ...styles.summaryRow, marginBottom: 0 }}>
              <span style={styles.summaryLabel}>Momentum Signal</span>
              <span style={styles.body}>{asLine(summary.momentum_signal)}</span>
            </p>
          </section>

          <section style={styles.coachCallout}>
            <h3 style={styles.coachTitle}>Coach’s Insight</h3>
            {coachNotes.length === 0 ? (
              <p style={styles.empty}>None</p>
            ) : (
              <ul style={styles.list}>
                {coachNotes.map((item, index) => (
                  <li key={`coach-${index}`} style={styles.listItem}>
                    {String(item)}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <ItemList title="Action Items" items={actionItems} />
          <ItemList title="Follow-ups" items={followUps} />
        </div>
      </section>

      <section style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <span>Draft Reply</span>
          <span style={styles.sectionHeaderTag}>Sent to client</span>
        </div>
        <div style={styles.emailBody}>
          {editing ? (
            <textarea
              style={styles.textarea}
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              rows={12}
              aria-label="Draft reply"
            />
          ) : (
            <p style={styles.body}>{emailDraft || "—"}</p>
          )}
          <div style={styles.actionRow}>
            <button
              type="button"
              style={{
                ...styles.primaryButton,
                ...(hoveredButton === "save" && !saving && dirty
                  ? styles.primaryButtonHover
                  : {}),
                ...(saving || !dirty || !note ? styles.primaryButtonDisabled : {}),
              }}
              onMouseEnter={() => setHoveredButton("save")}
              onMouseLeave={() => setHoveredButton(null)}
              onClick={handleSave}
              disabled={saving || !dirty || !note}
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
            <button
              type="button"
              style={{
                ...styles.secondaryButton,
                ...(hoveredButton === "edit" && !editing
                  ? styles.secondaryButtonHover
                  : {}),
                ...(editing ? styles.primaryButtonDisabled : {}),
              }}
              onMouseEnter={() => setHoveredButton("edit")}
              onMouseLeave={() => setHoveredButton(null)}
              onClick={() => setEditing(true)}
              disabled={editing}
            >
              Edit
            </button>
            <a
              href={mailtoHref}
              style={{
                ...styles.primaryButton,
                ...(hoveredButton === "email" ? styles.primaryButtonHover : {}),
              }}
              onMouseEnter={() => setHoveredButton("email")}
              onMouseLeave={() => setHoveredButton(null)}
            >
              Send to Client
            </a>
            <button
              type="button"
              onClick={handleCopyReply}
              style={{
                ...styles.secondaryButton,
                ...(hoveredButton === "copy" ? styles.secondaryButtonHover : {}),
              }}
              onMouseEnter={() => setHoveredButton("copy")}
              onMouseLeave={() => setHoveredButton(null)}
            >
              Copy Reply
            </button>
          </div>
          {saveError ? <p style={styles.saveError}>{saveError}</p> : null}
          {saveMessage ? <p style={styles.saveConfirm}>{saveMessage}</p> : null}
          {copyFeedback ? (
            <p
              style={
                copyFeedback === "Copied!"
                  ? styles.copyConfirm
                  : styles.copyError
              }
            >
              {copyFeedback}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

const styles = {
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: "1.75rem",
    marginBottom: "2rem",
  },
  sectionCard: {
    border: `1px solid ${colors.hairline}`,
    borderRadius: "8px",
    overflow: "hidden",
    background: colors.bg,
  },
  sectionHeader: {
    ...sectionHeaderBar,
    borderRadius: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
  },
  sectionHeaderTag: {
    marginLeft: "1rem",
    fontSize: "0.72rem",
    fontWeight: 500,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "#C9D8DF",
  },
  internalBody: {
    padding: "1.25rem 1.5rem 0.5rem",
    background: colors.bg,
    fontFamily: type.fontFamily,
  },
  emailBody: {
    padding: "1.25rem 1.5rem 1.5rem",
    background: colors.bg,
    fontFamily: type.fontFamily,
  },
  block: {
    marginBottom: "1.35rem",
  },
  blockTitle: {
    fontSize: "1.02rem",
    fontWeight: 650,
    margin: "0 0 0.4rem",
    color: colors.navy,
  },
  summaryRow: {
    margin: "0 0 0.55rem",
    display: "flex",
    flexWrap: "wrap",
    gap: "0.35rem 0.75rem",
  },
  summaryLabel: {
    minWidth: "8.5rem",
    fontSize: "0.85rem",
    fontWeight: 600,
    color: colors.slate,
  },
  body: {
    margin: 0,
    whiteSpace: "pre-wrap",
    color: colors.slate,
    lineHeight: 1.6,
    fontSize: "0.95rem",
  },
  coachCallout: {
    ...calloutBox,
    marginTop: "0.5rem",
    marginBottom: "1.35rem",
  },
  coachTitle: {
    fontSize: "1.02rem",
    fontWeight: 650,
    margin: "0 0 0.4rem",
    color: colors.navy,
  },
  listSection: {
    marginBottom: "1.5rem",
  },
  actionRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.65rem",
    marginTop: "1rem",
  },
  list: {
    margin: 0,
    paddingLeft: "1.15rem",
  },
  listItem: {
    marginBottom: "0.3rem",
    lineHeight: 1.6,
    fontSize: "0.95rem",
    color: colors.slate,
  },
  empty: {
    margin: 0,
    color: colors.slateLight,
    fontStyle: "italic",
    fontSize: "0.9rem",
  },
  primaryButton: {
    display: "inline-block",
    background: colors.navy,
    color: "white",
    fontSize: "0.9rem",
    fontWeight: 600,
    padding: "0.65rem 1.1rem",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "background 0.12s ease",
    textDecoration: "none",
    border: "none",
  },
  primaryButtonHover: {
    background: colors.navyDark,
  },
  secondaryButton: {
    padding: "0.6rem 1.1rem",
    fontSize: "0.9rem",
    fontWeight: 600,
    color: colors.navy,
    background: colors.bg,
    border: `1px solid ${colors.navy}`,
    borderRadius: "6px",
    cursor: "pointer",
    transition: "background 0.12s ease, color 0.12s ease",
    fontFamily: type.fontFamily,
  },
  secondaryButtonHover: {
    background: colors.navyLight,
    color: colors.navyDark,
  },
  copyConfirm: {
    margin: "0.65rem 0 0",
    fontSize: "0.85rem",
    color: colors.slate,
    fontWeight: 600,
  },
  copyError: {
    margin: "0.65rem 0 0",
    fontSize: "0.85rem",
    color: colors.danger,
    fontWeight: 600,
  },
  textarea: {
    display: "block",
    width: "100%",
    maxWidth: "100%",
    margin: "0 0 0.25rem",
    padding: "0.75rem",
    fontSize: "0.95rem",
    border: `1px solid ${colors.hairline}`,
    borderRadius: "6px",
    boxSizing: "border-box",
    fontFamily: type.fontFamily,
    color: colors.ink,
    lineHeight: 1.6,
    resize: "vertical",
    minHeight: "12rem",
    whiteSpace: "pre-wrap",
  },
  primaryButtonDisabled: {
    opacity: 0.55,
    cursor: "not-allowed",
  },
  saveConfirm: {
    margin: "0.65rem 0 0",
    fontSize: "0.85rem",
    color: colors.slate,
    fontWeight: 600,
  },
  saveError: {
    margin: "0.65rem 0 0",
    fontSize: "0.85rem",
    color: colors.danger,
    fontWeight: 600,
  },
};
