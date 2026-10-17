"use client";

// NoteDetail.jsx — detail content for a single showing note (no notes list).

import { useState } from "react";
import OutputSection from "./OutputSection";
import {
  CANONICAL_CLIENT_SIGNOFF,
  composeClientEmailBody,
  formatClientEmailLead,
  resolveClientSnapshot,
} from "@/lib/showing-notes/schema/showingNotes.js";
import { colors, sectionHeaderBar, calloutBox } from "./theme";

function openMailto(to, subject, body) {
  const recipients = (Array.isArray(to) ? to : [])
    .filter((email) => typeof email === "string" && email.trim())
    .map((email) => email.trim())
    .join(",");
  window.location.href =
    `mailto:${recipients}?subject=${encodeURIComponent(subject || "")}` +
    `&body=${encodeURIComponent(body || "")}`;
}

function renderInlineMarkdown(text) {
  const str = String(text || "");
  if (!str) return null;
  const parts = str.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) {
      return (
        <strong key={index} style={{ fontWeight: 700, color: colors.ink }}>
          {bold[1]}
        </strong>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

function ShowingSnapshotDocument({ snapshot }) {
  const propertiesRow = snapshot?.stats?.find((row) =>
    /^properties viewed$/i.test(row.label)
  );
  const propertiesViewed = propertiesRow?.value || "";
  const sections = snapshot?.sections || [];

  return (
    <section style={styles.snapshotCard}>
      <div style={styles.snapshotHeader}>{snapshot?.title || "Showing Snapshot"}</div>
      <div style={styles.snapshotBody}>
        {propertiesViewed ? (
          <section style={styles.snapshotSection}>
            <h4 style={styles.snapshotSectionTitle}>Properties viewed</h4>
            <p style={styles.snapshotSectionBody}>
              {renderInlineMarkdown(propertiesViewed)}
            </p>
          </section>
        ) : null}

        {propertiesViewed && sections.length ? (
          <hr style={styles.snapshotRule} />
        ) : null}

        {sections.map((section, index) => (
          <section key={`${section.heading}-${index}`} style={styles.snapshotSection}>
            <h4 style={styles.snapshotSectionTitle}>{section.heading}</h4>
            <p style={styles.snapshotSectionBody}>{section.body || ""}</p>
          </section>
        ))}
      </div>
    </section>
  );
}

export default function NoteDetail({ note }) {
  const [hoveredButton, setHoveredButton] = useState(null);

  if (!note) return null;

  const snapshot = resolveClientSnapshot(note);
  const { lead, bridge, closing } = formatClientEmailLead(note);

  return (
    <section style={styles.detail}>
      <section style={styles.clientDetail}>
        <h3 style={styles.blockTitleLarge}>Client Details</h3>
        <p style={styles.clientDetailRow}>
          <span style={styles.clientDetailLabel}>Client name(s)</span>
          <span style={styles.body}>
            {note.client_names?.length ? note.client_names.join(", ") : "—"}
          </span>
        </p>
        <p style={{ ...styles.clientDetailRow, marginBottom: 0 }}>
          <span style={styles.clientDetailLabel}>Client email(s)</span>
          <span style={styles.body}>
            {note.client_emails?.length ? note.client_emails.join(", ") : "—"}
          </span>
        </p>
      </section>

      <section style={styles.internalSummaryCard}>
        <div style={styles.emailCardHeader}>
          <span>Internal Summary (Not Sent to Client)</span>
        </div>
        <div style={styles.internalSummaryBody}>
          <section style={styles.block}>
            <h3 style={styles.blockTitleLarge}>Client Sentiment</h3>
            <p style={styles.body}>{note.client_sentiment || "—"}</p>
          </section>

          <section style={styles.internalCallout}>
            <h3 style={styles.internalTitle}>Coach's Insight</h3>
            <p style={styles.body}>{note.coaching_insights || "—"}</p>
          </section>

          <OutputSection
            title="Realtor Action Items"
            items={note.realtor_action_items}
            variant="section"
          />
          <OutputSection title="Follow-ups" items={note.follow_ups} variant="section" />
        </div>
      </section>

      <section style={styles.emailCard}>
        <div style={styles.emailCardHeader}>
          <span>Client Email Preview</span>
          <span style={styles.emailCardHeaderTag}>Sent to client</span>
        </div>
        <div style={styles.emailCardBody}>
          {lead ? (
            <section style={styles.block}>
              <p style={styles.body}>{lead}</p>
            </section>
          ) : null}

          {bridge ? (
            <section style={styles.block}>
              <p style={styles.body}>{bridge}</p>
            </section>
          ) : null}

          <ShowingSnapshotDocument snapshot={snapshot} />

          {closing ? (
            <section style={styles.block}>
              <p style={styles.body}>{closing}</p>
            </section>
          ) : null}

          <section style={styles.block}>
            <p style={styles.body}>{CANONICAL_CLIENT_SIGNOFF}</p>
          </section>

          <div style={styles.sendRow}>
            <button
              type="button"
              style={{
                ...styles.primaryButton,
                ...(hoveredButton === "client" ? styles.primaryButtonHover : {}),
              }}
              onMouseEnter={() => setHoveredButton("client")}
              onMouseLeave={() => setHoveredButton(null)}
              onClick={() =>
                openMailto(
                  note.client_emails,
                  note.email_subject_client?.trim() || "Showing summary",
                  composeClientEmailBody(note)
                )
              }
            >
              Send to Client
            </button>
          </div>
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
  snapshotList: {
    margin: 0,
    paddingLeft: "1.15rem",
  },
  snapshotListItem: {
    marginBottom: "0.2rem",
    lineHeight: 1.5,
  },
  block: {
    marginBottom: "1.35rem",
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
  sendRow: {
    marginTop: "0.5rem",
    marginBottom: 0,
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
