"use client";

//ListingDetailPage.jsx — single-listing detail view.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { asListingText } from "@/lib/listing-generator/schema/listing.js";
import { formatDisplayDate } from "./formatDate";
import { colors, type, sectionHeaderBar, calloutBox } from "./theme";
import { pageStyles } from "./pageStyles";
import BackLink from "@/components/BackLink";

export default function ListingDetailPage() {
  const { id } = useParams();
  const [listing, setListing] = useState(null);
  const [savedGenerated, setSavedGenerated] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(null);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [hoveredButton, setHoveredButton] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setListing(null);
      setSavedGenerated("");
      setEditing(false);
      setCopied(false);
      setSaveMessage(null);
      try {
        const res = await fetch(`/api/listing-generator/listings?id=${encodeURIComponent(id)}`);
        let data;
        try {
          data = await res.json();
        } catch {
          throw new Error("Failed to load notes.");
        }
        if (!res.ok) throw new Error(data.error || "Failed to load listing");
        if (!cancelled) {
          const next = data.listing || null;
          setListing(next);
          setSavedGenerated(asListingText(next?.generatedDescription));
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load listing");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (id) load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const addressText = asListingText(listing?.address).trim();
  const titleText = asListingText(listing?.title).trim();
  const rawText = asListingText(listing?.rawDescription).trim();
  const generatedText = asListingText(listing?.generatedDescription);
  const clientNamesText = Array.isArray(listing?.clientNames)
    ? listing.clientNames.filter((name) => typeof name === "string" && name.trim()).join(", ")
    : "";
  const clientEmailsText = Array.isArray(listing?.clientEmails)
    ? listing.clientEmails.filter((email) => typeof email === "string" && email.trim()).join(", ")
    : "";
  const dirty = listing != null && generatedText !== savedGenerated;

  function updateGeneratedDescription(value) {
    setListing((prev) =>
      prev
        ? {
            ...prev,
            generatedDescription: value,
          }
        : prev
    );
  }

  async function handleCopy() {
    const text = generatedText.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopyFeedback("Copied!");
      setTimeout(() => {
        setCopied(false);
        setCopyFeedback(null);
      }, 2000);
    } catch {
      setCopied(false);
      setCopyFeedback("Couldn't copy — try again.");
    }
  }

  async function handleSave() {
    if (!listing) return;
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/listing-generator/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing: {
            ...listing,
            address: asListingText(listing.address),
            title: asListingText(listing.address).trim() || asListingText(listing.title),
            generatedDescription: asListingText(listing.generatedDescription),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save listing");
      const saved = data.listing;
      setListing(saved);
      setSavedGenerated(asListingText(saved?.generatedDescription));
      setEditing(false);
      setSaveMessage("Saved");
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (err) {
      setError(err.message || "Failed to save listing");
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate() {
    const inputText = generatedText.trim();
    if (!listing || !inputText) return;
    setRegenerating(true);
    setError(null);
    setSaveMessage(null);
    try {
      // Refine from the current edited generated description (not raw notes).
      const res = await fetch("/api/listing-generator/generate-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: inputText,
          store: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to regenerate");
      const nextGenerated = asListingText(data.listing?.generatedDescription);
      // Replace only generatedDescription; keep address, title, raw, id, etc.
      setListing((prev) =>
        prev
          ? {
              ...prev,
              generatedDescription: nextGenerated,
            }
          : prev
      );
      setEditing(true);
      setSaveMessage("Regenerated — save to keep changes");
    } catch (err) {
      setError(err.message || "Failed to regenerate description");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div style={pageStyles.page}>
      <BackLink fallbackHref="/listing-generator/listings" />
      <header style={pageStyles.header}>
        <div style={styles.headerRow}>
          <div style={styles.headerText}>
            <h1 style={pageStyles.title}>
              {titleText || addressText || "Listing Description"}
            </h1>
            {listing?.createdAt ? (
              <p style={pageStyles.subtitle}>
                {formatDisplayDate(listing.createdAt)}
              </p>
            ) : null}
          </div>
          <div style={styles.navLinks}>
            <Link href="/listing-generator/listings" style={styles.navLink}>
              Saved listings
            </Link>
          </div>
        </div>
      </header>

      {loading ? <p style={pageStyles.status}>Loading listing…</p> : null}
      {error ? <p style={pageStyles.error}>{error}</p> : null}
      {!loading && !error && !listing ? (
        <p style={pageStyles.status}>
          Listing not found.{" "}
          <Link href="/listing-generator/listings" style={styles.inlineLink}>
            Back to listings
          </Link>
        </p>
      ) : null}

      {listing ? (
        <section style={styles.detail}>
          {clientNamesText || clientEmailsText ? (
            <section style={styles.addressBlock}>
              <h3 style={styles.blockTitleLarge}>Client Details</h3>
              {clientNamesText ? (
                <p style={styles.addressBody}>{clientNamesText}</p>
              ) : null}
              {clientEmailsText ? (
                <p style={clientNamesText ? styles.body : styles.addressBody}>
                  {clientEmailsText}
                </p>
              ) : null}
            </section>
          ) : null}
          {addressText ? (
            <section style={styles.addressBlock}>
              <h3 style={styles.blockTitleLarge}>Property Address</h3>
              <p style={styles.addressBody}>{addressText}</p>
            </section>
          ) : null}

          <section style={styles.emailCard}>
            <div style={styles.emailCardHeader}>
              <span>Generated description</span>
            </div>
            <div style={styles.emailCardBody}>
              {editing ? (
                <textarea
                  style={styles.textarea}
                  value={generatedText}
                  onChange={(e) => updateGeneratedDescription(e.target.value)}
                  rows={10}
                  aria-label="Generated description"
                />
              ) : (
                <p style={styles.body}>{generatedText.trim() || "—"}</p>
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
                    ...(hoveredButton === "regen" &&
                    !regenerating &&
                    generatedText.trim()
                      ? styles.primaryButtonHover
                      : {}),
                    ...(regenerating || !generatedText.trim()
                      ? styles.primaryButtonDisabled
                      : {}),
                  }}
                  onMouseEnter={() => setHoveredButton("regen")}
                  onMouseLeave={() => setHoveredButton(null)}
                  onClick={handleRegenerate}
                  disabled={regenerating || !generatedText.trim()}
                >
                  {regenerating ? "Regenerating…" : "Regenerate Listing"}
                </button>
                <button
                  type="button"
                  style={{
                    ...styles.secondaryButton,
                    ...(hoveredButton === "copy" && generatedText.trim()
                      ? styles.secondaryButtonHover
                      : {}),
                    ...(!generatedText.trim() ? styles.primaryButtonDisabled : {}),
                  }}
                  onMouseEnter={() => setHoveredButton("copy")}
                  onMouseLeave={() => setHoveredButton(null)}
                  onClick={handleCopy}
                  disabled={!generatedText.trim()}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              {copyFeedback ? (
                <p
                  style={
                    copyFeedback === "Copied!"
                      ? styles.confirm
                      : styles.copyError
                  }
                >
                  {copyFeedback}
                </p>
              ) : saveMessage ? (
                <p style={styles.confirm}>{saveMessage}</p>
              ) : null}
            </div>
          </section>

          <section style={styles.rawCallout}>
            <h3 style={styles.blockTitleLarge}>Raw description</h3>
            <p style={styles.body}>{rawText || "—"}</p>
          </section>
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
  navLinks: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "0.5rem",
    flex: "0 1 auto",
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
  detail: {
    border: `1px solid ${colors.hairline}`,
    borderRadius: "6px",
    padding: "1.25rem",
    background: colors.bg,
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
  },
  addressBlock: {
    marginBottom: "1.25rem",
  },
  addressBody: {
    margin: 0,
    color: colors.ink,
    fontSize: "1.05rem",
    fontWeight: 600,
    lineHeight: 1.45,
    wordBreak: "break-word",
  },
  rawCallout: {
    ...calloutBox,
    marginTop: "1.25rem",
    marginBottom: 0,
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
    wordBreak: "break-word",
    color: colors.slate,
    lineHeight: 1.6,
    fontSize: "0.95rem",
  },
  emailCard: {
    border: `1px solid ${colors.hairline}`,
    borderRadius: "8px",
    marginBottom: 0,
    overflow: "hidden",
  },
  emailCardHeader: {
    ...sectionHeaderBar,
    borderRadius: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  emailCardBody: {
    padding: "1.1rem 1.15rem 1.25rem",
    background: colors.bg,
  },
  textarea: {
    display: "block",
    width: "100%",
    maxWidth: "100%",
    margin: 0,
    padding: "0.75rem",
    fontSize: "16px",
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
  actionRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.65rem",
    marginTop: "1rem",
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
    flex: "1 1 auto",
    minWidth: "8.5rem",
  },
  primaryButtonHover: {
    background: colors.navyDark,
  },
  primaryButtonDisabled: {
    opacity: 0.55,
    cursor: "not-allowed",
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
    flex: "1 1 auto",
    minWidth: "8.5rem",
  },
  secondaryButtonHover: {
    background: colors.navyLight,
    color: colors.navyDark,
  },
  confirm: {
    margin: "0.75rem 0 0",
    fontSize: "0.85rem",
    color: colors.slate,
    fontWeight: 600,
  },
  copyError: {
    margin: "0.75rem 0 0",
    fontSize: "0.85rem",
    color: colors.danger,
    fontWeight: 600,
  },
};
