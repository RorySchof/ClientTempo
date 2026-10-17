"use client";

//ListingGenerator.jsx — create a new listing description. List lives at /listings.

import Link from "next/link";
import { useRouter } from "next/navigation";
import ListingDescriptionForm from "./ListingDescriptionForm";
import DashboardCrumb from "@/components/DashboardCrumb";
import { colors } from "./theme";
import { pageStyles } from "./pageStyles";

export default function ListingGenerator() {
  const router = useRouter();

  return (
    <div style={pageStyles.page}>
      <DashboardCrumb />
      <header style={pageStyles.header}>
        <div style={styles.headerRow}>
          <div style={styles.headerText}>
            <h1 style={pageStyles.title}>Listing Generator</h1>
            <p style={pageStyles.subtitle}>
              Generate a polished MLS listing description
            </p>
          </div>
          <Link href="/listing-generator/listings" style={styles.navLink}>
            Saved listings
          </Link>
        </div>
      </header>

      <ListingDescriptionForm
        onCreated={(listing) => {
          if (listing?.id) router.push(`/listing-generator/listings/${listing.id}`);
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
  headerText: {
    minWidth: 0,
    flex: "1 1 12rem",
  },
  navLink: {
    fontSize: "0.9rem",
    fontWeight: 600,
    color: colors.navy,
    textDecoration: "none",
  },
};
