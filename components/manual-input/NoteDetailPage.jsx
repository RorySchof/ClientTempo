"use client";

// NoteDetailPage.jsx — single saved reply.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ManualInputEmailPreview from "./ManualInputEmailPreview";
import { formatDisplayDate } from "./formatDate";
import { colors, type, calloutBox } from "./theme";
import { pageStyles } from "./pageStyles";
import BackLink from "@/components/BackLink";

export default function NoteDetailPage() {
  const { id } = useParams();
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setNote(null);
      try {
        const res = await fetch(
          `/api/manual-input/notes?id=${encodeURIComponent(id)}`
        );
        let data;
        try {
          data = await res.json();
        } catch {
          throw new Error("Failed to load reply.");
        }
        if (!res.ok) throw new Error(data.error || "Failed to load reply.");
        if (!cancelled) setNote(data.note || null);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load reply");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (id) load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div style={pageStyles.page}>
      <BackLink fallbackHref="/manual-input/notes" />
      <header style={pageStyles.header}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={pageStyles.title}>Realtor Reply</h1>
            {note?.createdAt ? (
              <p style={pageStyles.subtitle}>
                {formatDisplayDate(note.createdAt)}
              </p>
            ) : null}
          </div>
          <Link href="/manual-input/notes" style={styles.navLink}>
            All replies
          </Link>
        </div>
      </header>

      {loading ? <p style={pageStyles.status}>Loading reply…</p> : null}
      {error ? <p style={pageStyles.error}>{error}</p> : null}
      {!loading && !error && !note ? (
        <p style={pageStyles.status}>
          Reply not found.{" "}
          <Link href="/manual-input/notes" style={styles.inlineLink}>
            Back to replies
          </Link>
        </p>
      ) : null}

      {note ? (
        <>
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
          <ManualInputEmailPreview
            note={note}
            onNoteChange={setNote}
            agent={note.agent}
            emailSubject={note.email_subject}
            clientEmails={note.client_emails}
          />
        </>
      ) : null}
    </div>
  );
}

const styles = {
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
  inlineLink: {
    fontSize: "0.9rem",
    fontWeight: 600,
    color: colors.navy,
    textDecoration: "none",
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
    display: "inline-block",
    minWidth: "8.5rem",
    marginRight: "0.75rem",
    fontSize: "0.85rem",
    fontWeight: 600,
    color: colors.slate,
  },
  blockTitleLarge: {
    fontSize: "1.02rem",
    fontWeight: 650,
    margin: "0 0 0.4rem",
    color: colors.navy,
  },
  body: {
    margin: 0,
    fontFamily: type.fontFamily,
    color: colors.ink,
    fontSize: "0.95rem",
  },
};
