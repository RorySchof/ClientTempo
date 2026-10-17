"use client";

// NotesListPage.jsx — dedicated page listing all showing notes, grouped by client.

import { useEffect, useState } from "react";
import Link from "next/link";
import { colors, sectionHeaderBar } from "./theme";
import { collectPropertiesPreviewed } from "@/lib/showing-notes/schema/showingNotes.js";
import { formatDisplayDate } from "./formatDate";
import { pageStyles } from "./pageStyles";
import BackLink from "@/components/BackLink";

const NO_CLIENT_LABEL = "No client name";

function clientGroupLabel(note) {
  const names = Array.isArray(note.client_names)
    ? note.client_names
        .filter((name) => typeof name === "string" && name.trim())
        .map((name) => name.trim())
    : [];
  return names.length ? names.join(", ") : NO_CLIENT_LABEL;
}

function groupNotesByClient(notes) {
  const map = new Map();
  for (const note of notes) {
    const label = clientGroupLabel(note);
    if (!map.has(label)) map.set(label, []);
    map.get(label).push(note);
  }

  const groups = Array.from(map.entries()).map(([label, items]) => ({
    label,
    notes: [...items].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    ),
  }));

  groups.sort((a, b) => {
    if (a.label === NO_CLIENT_LABEL) return 1;
    if (b.label === NO_CLIENT_LABEL) return -1;
    const aNewest = new Date(a.notes[0]?.createdAt || 0).getTime();
    const bNewest = new Date(b.notes[0]?.createdAt || 0).getTime();
    if (bNewest !== aNewest) return bNewest - aNewest;
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  });

  return groups;
}

function reportRowTitle(note) {
  const properties = collectPropertiesPreviewed(note);
  if (properties.length) return properties.join(" · ");

  const clientSubject = note.email_subject_client?.trim();
  if (clientSubject && clientSubject.toLowerCase() !== "showing notes") {
    return clientSubject;
  }

  const firstHighlight = note.property_highlights?.[0];
  if (typeof firstHighlight === "string" && firstHighlight.trim()) {
    return firstHighlight.trim().slice(0, 80);
  }

  return "Showing report";
}

function sentimentLabel(note) {
  const raw = typeof note.client_sentiment === "string" ? note.client_sentiment.trim() : "";
  if (!raw) return "";
  const match = raw.match(/^(positive|neutral|mixed|negative)\b/i);
  if (match) {
    const word = match[1].toLowerCase();
    return word.charAt(0).toUpperCase() + word.slice(1);
  }
  const beforeDash = raw.split(/\s+[—–-]\s+/)[0].trim();
  return beforeDash.slice(0, 24);
}

function NoteRow({ note, isLast }) {
  const [hovered, setHovered] = useState(false);
  const sentiment = sentimentLabel(note);
  const dateLabel = formatDisplayDate(note.createdAt);

  return (
    <li>
      <Link
        href={`/showing-notes/notes/${note.id}`}
        style={{
          ...styles.noteLink,
          background: hovered ? colors.bgMuted : colors.bg,
          ...(isLast ? styles.noteLinkLast : null),
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span style={styles.noteTitle}>{reportRowTitle(note)}</span>
        <span style={styles.noteMeta}>
          {dateLabel}
          {dateLabel && sentiment ? "  ·  " : null}
          {sentiment ? <span style={styles.sentiment}>{sentiment}</span> : null}
        </span>
      </Link>
    </li>
  );
}

function NewReportButton() {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href="/showing-notes"
      style={{
        ...styles.primaryButton,
        ...(hovered ? styles.primaryButtonHover : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      New showing report
    </Link>
  );
}

export default function NotesListPage() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/showing-notes/notes");
        let data;
        try {
          data = await res.json();
        } catch {
          throw new Error("Failed to load notes.");
        }
        if (!res.ok) throw new Error(data.error || "Failed to load notes.");
        if (!cancelled) setNotes(data.notes || []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load notes");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = groupNotesByClient(notes);

  return (
    <div style={pageStyles.page}>
      <BackLink fallbackHref="/showing-notes" />
      <header style={pageStyles.header}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={pageStyles.title}>Showing Reports</h1>
            <p style={pageStyles.subtitle}>Your saved showing reports</p>
          </div>
          <NewReportButton />
        </div>
      </header>

      {error ? <p style={pageStyles.error}>{error}</p> : null}

      {loading ? (
        <section style={styles.groupCard} aria-busy="true" aria-label="Loading reports">
          <div style={styles.groupHeader}>
            <span>Loading reports</span>
          </div>
          <ul style={styles.noteList}>
            {[0, 1, 2].map((index) => (
              <li
                key={index}
                style={{
                  ...styles.skeletonRow,
                  ...(index === 2 ? styles.noteLinkLast : null),
                }}
              >
                <span style={styles.skeletonTitle} />
                <span style={styles.skeletonMeta} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!loading && !error && notes.length === 0 ? (
        <section style={styles.emptyCard}>
          <p style={styles.emptyCopy}>No showing reports yet.</p>
          <NewReportButton />
        </section>
      ) : null}

      {!loading && groups.length > 0 ? (
        <div style={styles.groups}>
          {groups.map((group) => {
            const count = group.notes.length;
            const countLabel = `${count} ${count === 1 ? "report" : "reports"}`;
            return (
              <section key={group.label} style={styles.groupCard}>
                <div style={styles.groupHeader}>
                  <span style={styles.groupName}>{group.label}</span>
                  <span style={styles.groupCount}>{countLabel}</span>
                </div>
                <ul style={styles.noteList}>
                  {group.notes.map((note, index) => (
                    <NoteRow
                      key={note.id}
                      note={note}
                      isLast={index === group.notes.length - 1}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
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
  primaryButton: {
    display: "inline-block",
    background: colors.navy,
    color: "white",
    fontSize: "0.9rem",
    fontWeight: 600,
    padding: "0.65rem 1.1rem",
    borderRadius: "6px",
    border: "none",
    textDecoration: "none",
    transition: "background 0.12s ease",
  },
  primaryButtonHover: {
    background: colors.navyDark,
  },
  groups: {
    display: "flex",
    flexDirection: "column",
    gap: "1.75rem",
  },
  groupCard: {
    border: `1px solid ${colors.hairline}`,
    borderRadius: "8px",
    overflow: "hidden",
    background: colors.bg,
  },
  groupHeader: {
    ...sectionHeaderBar,
    borderRadius: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
  },
  groupName: {
    fontSize: "0.95rem",
    fontWeight: 600,
    letterSpacing: "0.01em",
  },
  groupCount: {
    fontSize: "0.72rem",
    fontWeight: 500,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "#C9D8DF",
    flexShrink: 0,
  },
  noteList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    background: colors.bg,
  },
  noteLink: {
    display: "block",
    textAlign: "left",
    padding: "1.15rem 1.5rem",
    borderBottom: `1px solid ${colors.hairline}`,
    textDecoration: "none",
    color: "inherit",
    transition: "background 0.12s ease",
  },
  noteLinkLast: {
    borderBottom: "none",
  },
  noteTitle: {
    display: "block",
    margin: 0,
    fontWeight: 600,
    fontSize: "0.95rem",
    color: colors.ink,
    lineHeight: 1.5,
  },
  noteMeta: {
    display: "block",
    margin: "0.25rem 0 0",
    fontSize: "0.85rem",
    color: colors.slateLight,
    lineHeight: 1.5,
  },
  sentiment: {
    color: colors.slate,
    fontWeight: 600,
  },
  emptyCard: {
    border: `1px solid ${colors.hairline}`,
    borderRadius: "8px",
    padding: "1.75rem 1.5rem",
    background: colors.bg,
  },
  emptyCopy: {
    margin: "0 0 1rem",
    color: colors.slate,
    fontSize: "0.95rem",
  },
  skeletonRow: {
    padding: "1.15rem 1.5rem",
    borderBottom: `1px solid ${colors.hairline}`,
  },
  skeletonTitle: {
    display: "block",
    height: "0.85rem",
    width: "55%",
    borderRadius: "4px",
    background: colors.navyLight,
  },
  skeletonMeta: {
    display: "block",
    height: "0.7rem",
    width: "28%",
    marginTop: "0.45rem",
    borderRadius: "4px",
    background: colors.hairline,
  },
};
