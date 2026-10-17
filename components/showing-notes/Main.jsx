"use client";

//Main.jsx — home: create a new showing note (form). List lives at /notes.

import Link from "next/link";
import { useRouter } from "next/navigation";
import ShowingNotesForm from "./ShowingNotesForm";
import DashboardCrumb from "@/components/DashboardCrumb";
import { colors } from "./theme";
import { pageStyles } from "./pageStyles";

export default function Main() {
  const router = useRouter();

  return (
    <div style={pageStyles.page}>
      <DashboardCrumb />
      <header style={pageStyles.header}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={pageStyles.title}>Showing Report</h1>
            <p style={pageStyles.subtitle}>
              Turn showing feedback into a clear client update and next steps.
            </p>
          </div>
          <Link href="/showing-notes/notes" style={styles.linkStyles}>
            All notes
          </Link>
        </div>
      </header>

      <ShowingNotesForm
        onCreated={(note) => {
          if (note?.id) router.push(`/showing-notes/notes/${note.id}`);
        }}
      />
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
