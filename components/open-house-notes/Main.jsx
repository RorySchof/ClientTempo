"use client";

//Main.jsx — home: create a new open house note (form). List lives at /notes.

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
            <h1 style={pageStyles.title}>Open House Report</h1>
            <p style={pageStyles.subtitle}>
              Turn open house feedback into a clear seller update and next steps.
            </p>
          </div>
          <Link href="/open-house-notes/notes" style={styles.navLink}>
            All notes
          </Link>
        </div>
      </header>

      <ShowingNotesForm
        onCreated={(note) => {
          if (note?.id) router.push(`/open-house-notes/notes/${note.id}`);
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
  navLink: {
    fontSize: "0.9rem",
    fontWeight: 600,
    color: colors.navy,
    textDecoration: "none",
  },
};
