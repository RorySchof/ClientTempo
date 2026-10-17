"use client";

// NoteDetail.jsx — detail content for a single open house note (no notes list).

import { useEffect, useState } from "react";
import OutputSection from "./OutputSection";
import {
  composeSellerEmailBody,
  resolveSellerSnapshot,
  sellerSnapshotHasContent,
  splitSellerEmail,
  stripSnapshotMarker,
} from "@/lib/open-house-notes/schema/showingNotes.js";
import { colors, type, sectionHeaderBar, calloutBox } from "./theme";

function openMailto(to, subject, body) {
  const recipients = (Array.isArray(to) ? to : [])
    .filter((email) => typeof email === "string" && email.trim())
    .map((email) => email.trim())
    .join(",");
  window.location.href =
    `mailto:${recipients}?subject=${encodeURIComponent(subject || "")}` +
    `&body=${encodeURIComponent(body || "")}`;
}

function SellerSnapshotDocument({ snapshot }) {
  if (!sellerSnapshotHasContent(snapshot)) return null;

  return (
    <section style={styles.snapshotCard}>
      <div style={styles.snapshotHeader}>{snapshot.title || "Open House Snapshot"}</div>
      <div style={styles.snapshotBody}>
        {snapshot.stats?.length ? (
          <table style={styles.snapshotTable}>
            <tbody>
              {snapshot.stats.map((row, index) => (
                <tr key={`${row.label}-${index}`}>
                  <td style={styles.snapshotLabel}>{row.label}</td>
                  <td style={styles.snapshotValue}>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {snapshot.stats?.length && snapshot.sections?.length ? (
          <hr style={styles.snapshotRule} />
        ) : null}

        {snapshot.sections?.map((section, index) => (
          <section key={`${section.heading}-${index}`} style={styles.snapshotSection}>
            <h4 style={styles.snapshotSectionTitle}>{section.heading}</h4>
            <p style={styles.snapshotSectionBody}>{section.body}</p>
          </section>
        ))}
      </div>
    </section>
  );
}

export default function NoteDetail({ note, onNoteChange }) {
  const [hoveredButton, setHoveredButton] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveMessage, setSaveMessage] = useState(null);
  const [emailDraft, setEmailDraft] = useState(() =>
    stripSnapshotMarker(note?.seller_report_email || "")
  );

  useEffect(() => {
    setEmailDraft(stripSnapshotMarker(note?.seller_report_email || ""));
    setEditing(false);
    setSaveError(null);
    setSaveMessage(null);
  }, [note?.id]);

  if (!note) return null;

  const snapshot = resolveSellerSnapshot(note);
  const hasSnapshot = sellerSnapshotHasContent(snapshot);
  const savedEmail = stripSnapshotMarker(note.seller_report_email || "");
  const dirty = emailDraft !== savedEmail;
  const noteForEmail = { ...note, seller_report_email: emailDraft };
  const { before, after } = splitSellerEmail(noteForEmail.seller_report_email || "");

  async function handleSave() {
    if (!note) return;
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/open-house-notes/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: {
            ...note,
            seller_report_email: emailDraft,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save note");
      onNoteChange?.(data.note);
      setEmailDraft(stripSnapshotMarker(data.note?.seller_report_email || emailDraft));
      setEditing(false);
      setSaveMessage("Saved");
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (err) {
      setSaveError(err.message || "Failed to save note");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={styles.detail}>
      <section style={styles.clientDetail}>
        <h3 style={styles.blockTitleLarge}>Seller information</h3>
        <p style={styles.clientDetailRow}>
          <span style={styles.clientDetailLabel}>Names</span>
          <span style={styles.body}>
            {note.seller_names?.length ? note.seller_names.join(", ") : "—"}
          </span>
        </p>
        <p style={styles.clientDetailRow}>
          <span style={styles.clientDetailLabel}>Emails</span>
          <span style={styles.body}>
            {note.seller_emails?.length ? note.seller_emails.join(", ") : "—"}
          </span>
        </p>
        <p style={{ ...styles.clientDetailRow, marginBottom: 0 }}>
          <span style={styles.clientDetailLabel}>Address</span>
          <span style={styles.body}>
            {note.property_address?.trim() ? note.property_address.trim() : "—"}
          </span>
        </p>
      </section>

      <section style={styles.internalSummaryCard}>
        <div style={styles.emailCardHeader}>
          <span>Internal Summary (Not Sent to Seller)</span>
        </div>
        <div style={styles.internalSummaryBody}>
          <section style={styles.block}>
            <h3 style={styles.blockTitleLarge}>Interest Level</h3>
            <p style={styles.body}>{note.interest_level_summary || "—"}</p>
          </section>

          <section style={styles.internalCallout}>
            <h3 style={styles.internalTitle}>Agent coaching insights</h3>
            <p style={styles.body}>{note.coaching_insights || "—"}</p>
          </section>

          <OutputSection
            title="Host action items"
            items={note.host_action_items}
            variant="section"
          />
        </div>
      </section>

      <section style={styles.emailCard}>
        <div style={styles.emailCardHeader}>
          <span>Seller Report Email</span>
          <span style={styles.emailCardHeaderTag}>Sent to seller</span>
        </div>
        <div style={styles.emailCardBody}>
          {editing ? (
            <textarea
              style={styles.textarea}
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              rows={12}
              aria-label="Seller report email"
            />
          ) : (
            <>
              {before ? (
                <section style={styles.block}>
                  <p style={styles.body}>{before}</p>
                </section>
              ) : null}

              {hasSnapshot ? <SellerSnapshotDocument snapshot={snapshot} /> : null}

              {after ? (
                <section style={styles.block}>
                  <p style={styles.body}>{after}</p>
                </section>
              ) : null}

              {!before && !after && !hasSnapshot ? (
                <section style={styles.block}>
                  <p style={styles.body}>—</p>
                </section>
              ) : null}
            </>
          )}

          <div style={styles.actionRow}>
            <button
              type="button"
              style={{
                ...styles.primaryButton,
                ...(hoveredButton === "save" && !saving && dirty
                  ? styles.primaryButtonHover
                  : {}),
                ...(saving || !dirty ? styles.primaryButtonDisabled : {}),
              }}
              onMouseEnter={() => setHoveredButton("save")}
              onMouseLeave={() => setHoveredButton(null)}
              onClick={handleSave}
              disabled={saving || !dirty}
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
            <button
              type="button"
              style={{
                ...styles.primaryButton,
                ...(hoveredButton === "email" ? styles.primaryButtonHover : {}),
              }}
              onMouseEnter={() => setHoveredButton("email")}
              onMouseLeave={() => setHoveredButton(null)}
              onClick={() =>
                openMailto(
                  note.seller_emails,
                  note.email_subject_seller?.trim() || "Open House Notes",
                  composeSellerEmailBody(noteForEmail)
                )
              }
            >
              Send to Seller
            </button>
          </div>
          {saveError ? <p style={styles.saveError}>{saveError}</p> : null}
          {saveMessage ? <p style={styles.saveConfirm}>{saveMessage}</p> : null}
        </div>
      </section>
    </section>
  );
}

const styles = {
  detail: {
    border: `1px solid ${colors.hairline}`,
    borderRadius: "6px",
    padding: "1.5rem",
    background: colors.bg,
  },
  emailCard: {
    border: `1px solid ${colors.hairline}`,
    borderRadius: "8px",
    marginBottom: "1.75rem",
    overflow: "hidden",
  },
  internalSummaryCard: {
    border: `1px solid ${colors.hairline}`,
    borderRadius: "8px",
    marginBottom: "2rem",
    overflow: "hidden",
  },
  internalSummaryBody: {
    padding: "1.25rem 1.5rem 0.5rem",
    background: colors.bg,
  },
  emailCardHeader: {
    ...sectionHeaderBar,
    borderRadius: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  emailCardHeaderTag: {
    fontSize: "0.72rem",
    fontWeight: 500,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "#C9D8DF",
  },
  emailCardBody: {
    padding: "1.25rem 1.5rem 1.5rem",
    background: colors.bg,
  },
  snapshotCard: {
    border: `1px solid ${colors.hairline}`,
    borderRadius: "8px",
    overflow: "hidden",
    margin: "0 0 1.35rem",
    background: colors.bgMuted,
  },
  snapshotHeader: {
    ...sectionHeaderBar,
    borderRadius: 0,
  },
  snapshotBody: {
    padding: "1rem 1.25rem 1.15rem",
    background: colors.bgMuted,
  },
  snapshotTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "0.95rem",
    color: colors.ink,
  },
  snapshotLabel: {
    padding: "0.45rem 0.75rem 0.45rem 0",
    fontWeight: 600,
    width: "34%",
    color: colors.slate,
    verticalAlign: "top",
    borderBottom: `1px solid ${colors.hairline}`,
  },
  snapshotValue: {
    padding: "0.45rem 0",
    color: colors.ink,
    verticalAlign: "top",
    lineHeight: 1.5,
    borderBottom: `1px solid ${colors.hairline}`,
  },
  snapshotRule: {
    border: "none",
    borderTop: `1px solid ${colors.hairline}`,
    margin: "0.85rem 0 0.35rem",
  },
  snapshotSection: {
    marginTop: "0.85rem",
  },
  snapshotSectionTitle: {
    margin: "0 0 0.3rem",
    fontSize: "0.82rem",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: colors.navy,
  },
  snapshotSectionBody: {
    margin: 0,
    whiteSpace: "pre-wrap",
    color: colors.slate,
    lineHeight: 1.55,
    fontSize: "0.95rem",
  },
  block: {
    marginBottom: "1.35rem",
  },
  blockTitle: {
    fontSize: "0.92rem",
    fontWeight: 650,
    margin: "0 0 0.4rem",
    color: colors.ink,
  },
  blockTitleLarge: {
    fontSize: "1.02rem",
    fontWeight: 650,
    margin: "0 0 0.4rem",
    color: colors.navy,
  },
  body: {
    margin: 0,
    whiteSpace: "pre-wrap",
    color: colors.slate,
    lineHeight: 1.6,
    fontSize: "0.95rem",
  },
  summaryParagraphFollow: {
    marginTop: "0.85rem",
  },
  bulletList: {
    margin: 0,
    paddingLeft: "1.15rem",
  },
  bulletItem: {
    marginBottom: "0.3rem",
    lineHeight: 1.6,
    fontSize: "0.95rem",
    color: colors.slate,
  },
  sendRow: {
    marginTop: "0.5rem",
    marginBottom: 0,
  },
  actionRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.65rem",
    marginTop: "1rem",
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
  },
  secondaryButtonHover: {
    background: colors.navyLight,
    color: colors.navyDark,
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
  internalCallout: {
    ...calloutBox,
    marginTop: "0.5rem",
    marginBottom: "1.35rem",
  },
  internalTitle: {
    fontSize: "1.02rem",
    fontWeight: 650,
    margin: "0 0 0.4rem",
    color: colors.navy,
  },
  clientDetail: {
    ...calloutBox,
    marginBottom: "1.5rem",
  },
  clientDetailRow: {
    margin: "0 0 0.55rem",
    display: "flex",
    flexWrap: "wrap",
    gap: "0.35rem 0.75rem",
  },
  clientDetailLabel: {
    minWidth: "4.5rem",
    fontSize: "0.85rem",
    fontWeight: 600,
    color: colors.slate,
  },
};
