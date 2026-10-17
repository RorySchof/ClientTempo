"use client";

// NoteDetailPage.jsx — single-note detail view (no notes list sidebar).

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import NoteDetail from "./NoteDetail";
import { formatDisplayDate } from "./formatDate";
import { colors } from "./theme";
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
        const res = await fetch(`/api/showing-notes/notes?id=${encodeURIComponent(id)}`);
        let data;
        try {
          data = await res.json();
        } catch {
          throw new Error("Failed to load notes.");
        }
        if (!res.ok) throw new Error(data.error || "Failed to load notes.");
        if (!cancelled) setNote(data.note || null);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load note");
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
      <BackLink fallbackHref="/showing-notes/notes" />
      <header style={pageStyles.header}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={pageStyles.title}>Showing Report</h1>
            {note?.createdAt ? (
              <p style={pageStyles.subtitle}>
                {formatDisplayDate(note.createdAt)}
              </p>
            ) : null}
          </div>
          <Link href="/showing-notes/notes" style={styles.linkStyles}>
            All notes
          </Link>
        </div>
      </header>

      {loading ? <p style={pageStyles.status}>Loading note…</p> : null}
      {error ? <p style={pageStyles.error}>{error}</p> : null}
      {!loading && !error && !note ? (
        <p style={pageStyles.status}>
          Note not found.{" "}
          <Link href="/showing-notes/notes" style={styles.linkStyles}>
            Back to notes
          </Link>
        </p>
      ) : null}
      {note ? <NoteDetail note={note} /> : null}
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
  linkStyles: {
    fontSize: "0.9rem",
    fontWeight: 600,
    color: colors.navy,
    textDecoration: "none",
  },
};
