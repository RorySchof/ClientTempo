"use client";

//ListingListPage.jsx — dedicated page listing all saved listings.

import { useEffect, useState } from "react";
import Link from "next/link";
import { colors, sectionHeaderBar } from "./theme";
import { formatDisplayDate } from "./formatDate";
import { pageStyles } from "./pageStyles";
import BackLink from "@/components/BackLink";

function listingRowTitle(listing) {
  const title = (listing.title || "").trim();
  if (title) return title;
  const address = (listing.address || "").trim();
  if (address) return address;
  return "Untitled listing";
}

function ListingRow({ listing, isLast }) {
  const [hovered, setHovered] = useState(false);
  const dateLabel = formatDisplayDate(listing.createdAt);

  return (
    <li>
      <Link
        href={`/listing-generator/listings/${listing.id}`}
        style={{
          ...styles.listingLink,
          background: hovered ? colors.bgMuted : colors.bg,
          ...(isLast ? styles.listingLinkLast : null),
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span style={styles.listingTitle}>{listingRowTitle(listing)}</span>
        {dateLabel ? <span style={styles.listingMeta}>{dateLabel}</span> : null}
      </Link>
    </li>
  );
}

function NewListingButton() {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href="/listing-generator"
      style={{
        ...styles.primaryButton,
        ...(hovered ? styles.primaryButtonHover : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      New listing
    </Link>
  );
}

export default function ListingListPage() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/listing-generator/listings");
        let data;
        try {
          data = await res.json();
        } catch {
          throw new Error("Failed to load listings.");
        }
        if (!res.ok) throw new Error(data.error || "Failed to load listings");
        if (!cancelled) setListings(data.listings || []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load listings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const count = listings.length;
  const countLabel = `${count} ${count === 1 ? "listing" : "listings"}`;

  return (
    <div style={pageStyles.page}>
      <BackLink fallbackHref="/listing-generator" />
      <header style={pageStyles.header}>
        <div style={styles.headerRow}>
          <div style={styles.headerText}>
            <h1 style={pageStyles.title}>Saved Listings</h1>
            <p style={pageStyles.subtitle}>Your saved listing descriptions</p>
          </div>
          <NewListingButton />
        </div>
      </header>

      {error ? <p style={pageStyles.error}>{error}</p> : null}

      {loading ? (
        <section style={styles.groupCard} aria-busy="true" aria-label="Loading listings">
          <div style={styles.groupHeader}>
            <span>Loading listings</span>
          </div>
          <ul style={styles.listingList}>
            {[0, 1, 2].map((index) => (
              <li
                key={index}
                style={{
                  ...styles.skeletonRow,
                  ...(index === 2 ? styles.listingLinkLast : null),
                }}
              >
                <span style={styles.skeletonTitle} />
                <span style={styles.skeletonMeta} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!loading && !error && listings.length === 0 ? (
        <section style={styles.emptyCard}>
          <p style={styles.emptyCopy}>No listing descriptions yet.</p>
          <NewListingButton />
        </section>
      ) : null}

      {!loading && listings.length > 0 ? (
        <section style={styles.groupCard}>
          <div style={styles.groupHeader}>
            <span style={styles.groupName}>Listings</span>
            <span style={styles.groupCount}>{countLabel}</span>
          </div>
          <ul style={styles.listingList}>
            {listings.map((listing, index) => (
              <ListingRow
                key={listing.id}
                listing={listing}
                isLast={index === listings.length - 1}
              />
            ))}
          </ul>
        </section>
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
  headerText: {
    minWidth: 0,
    flex: "1 1 12rem",
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
  groupCard: {
    border: `1px solid ${colors.hairline}`,
    borderRadius: "8px",
    overflow: "hidden",
    background: colors.bg,
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "100%",
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
  listingList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    background: colors.bg,
  },
  listingLink: {
    display: "block",
    textAlign: "left",
    padding: "1.15rem 1.5rem",
    borderBottom: `1px solid ${colors.hairline}`,
    textDecoration: "none",
    color: "inherit",
    transition: "background 0.12s ease",
    boxSizing: "border-box",
  },
  listingLinkLast: {
    borderBottom: "none",
  },
  listingTitle: {
    display: "block",
    margin: 0,
    fontWeight: 600,
    fontSize: "0.95rem",
    color: colors.ink,
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  listingMeta: {
    display: "block",
    margin: "0.25rem 0 0",
    fontSize: "0.85rem",
    color: colors.slateLight,
    lineHeight: 1.5,
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
