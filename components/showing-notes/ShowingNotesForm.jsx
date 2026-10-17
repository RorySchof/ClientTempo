"use client";

//ShowingNotesForm.jsx

import { useEffect, useState } from "react";
import { colors, type, sectionHeaderBar, calloutBox } from "./theme";

const emptyShowing = () => ({
  id: crypto.randomUUID(),
  address: "",
  notes: "",
});

/** Split a comma-separated input into trimmed non-empty strings. */
function parseListInput(value) {
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function hydrateShowings(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [emptyShowing()];
  return rows.map((row) => ({
    id: typeof row?.id === "string" && row.id ? row.id : crypto.randomUUID(),
    address: typeof row?.address === "string" ? row.address : "",
    notes: typeof row?.notes === "string" ? row.notes : "",
  }));
}

export default function ShowingNotesForm({ onCreated }) {
  const [showingSessionId, setShowingSessionId] = useState(null);
  const [clientNames, setClientNames] = useState("");
  const [clientEmails, setClientEmails] = useState("");
  const [showings, setShowings] = useState([emptyShowing()]);
  const [realtorNotes, setRealtorNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [discardingDraft, setDiscardingDraft] = useState(false);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [submitHovered, setSubmitHovered] = useState(false);
  const [addHovered, setAddHovered] = useState(false);
  const [saveHovered, setSaveHovered] = useState(false);
  const [discardHovered, setDiscardHovered] = useState(false);
  const [deleteHovered, setDeleteHovered] = useState(null);
  const busy = loading || savingDraft || discardingDraft;

  useEffect(() => {
    let cancelled = false;

    async function loadDraft() {
      try {
        const res = await fetch("/api/showing-notes/drafts");
        const data = await res.json();
        if (!res.ok || cancelled || !data.draft) return;
        const draft = data.draft;
        setShowingSessionId(draft.showingSessionId || null);
        setClientNames(
          Array.isArray(draft.client_names) ? draft.client_names.join(", ") : ""
        );
        setClientEmails(
          Array.isArray(draft.client_emails) ? draft.client_emails.join(", ") : ""
        );
        setShowings(hydrateShowings(draft.showings));
        setRealtorNotes(
          typeof draft.realtorNotes === "string" ? draft.realtorNotes : ""
        );
        setStatusMessage("Draft restored");
      } catch {
        // Leave the form empty if the draft cannot be loaded.
      }
    }

    loadDraft();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateShowing(index, field, value) {
    setShowings((prev) =>
      prev.map((showing, i) =>
        i === index ? { ...showing, [field]: value } : showing
      )
    );
  }

  function addShowing() {
    setShowings((prev) => [...prev, emptyShowing()]);
  }

  function deleteShowing(index) {
    setShowings((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }

  function resetForm() {
    setShowingSessionId(null);
    setClientNames("");
    setClientEmails("");
    setShowings([emptyShowing()]);
    setRealtorNotes("");
    setStatusMessage(null);
  }

  async function handleSaveProgress() {
    setError(null);
    const sessionId = showingSessionId || crypto.randomUUID();
    if (!showingSessionId) setShowingSessionId(sessionId);

    setSavingDraft(true);
    try {
      const res = await fetch("/api/showing-notes/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showingSessionId: sessionId,
          client_names: parseListInput(clientNames),
          client_emails: parseListInput(clientEmails),
          showings,
          realtorNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save progress");
      }
      if (data.draft?.showingSessionId) {
        setShowingSessionId(data.draft.showingSessionId);
      }
      setStatusMessage("Progress saved");
    } catch (err) {
      setError(err.message || "Failed to save progress");
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleDiscardDraft() {
    setError(null);
    setDiscardingDraft(true);
    try {
      const url = showingSessionId
        ? `/api/showing-notes/drafts?sessionId=${encodeURIComponent(showingSessionId)}`
        : "/api/showing-notes/drafts";
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to discard draft");
      }
      resetForm();
    } catch (err) {
      setError(err.message || "Failed to discard draft");
    } finally {
      setDiscardingDraft(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    const hasNotes = showings.some((s) => s.notes.trim());
    if (!hasNotes && !showingSessionId) {
      setError("Showing notes text is required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/showing-notes/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(60000),
        body: JSON.stringify({
          showingSessionId,
          showings,
          client_names: parseListInput(clientNames),
          client_emails: parseListInput(clientEmails),
          realtorNotes: realtorNotes || "",
          store: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate summary");
      }

      resetForm();
      onCreated?.(data.note);
    } catch (err) {
      const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
      setError(timedOut ? "Timed out — try again." : err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>New showing note</div>
      <form onSubmit={handleSubmit} style={styles.form}>
        <section style={styles.clientCard}>
          <div style={styles.clientHeader}>
            <h3 style={styles.clientTitle}>Client Details</h3>
          </div>
          <div style={styles.clientBody}>
            <div style={styles.clientField}>
              <label style={styles.clientLabel}>Client name(s)</label>
              <input
                type="text"
                style={styles.clientInput}
                value={clientNames}
                onChange={(e) => setClientNames(e.target.value)}
                placeholder="e.g., Sarah Thompson, Michael Lee"
              />
            </div>
            <div style={styles.clientField}>
              <label style={styles.clientLabel}>Client email(s)</label>
              <input
                type="text"
                style={styles.clientInput}
                value={clientEmails}
                onChange={(e) => setClientEmails(e.target.value)}
                placeholder="e.g., sarah@example.com, michael@example.com"
              />
            </div>
          </div>
        </section>

        {showings.map((showing, index) => (
          <div key={showing.id} style={styles.showingBlock}>
            <div style={styles.field}>
              <label
                htmlFor={`showing-address-${showing.id}`}
                style={styles.fieldCaption}
              >
                Property Address
              </label>
              <input
                id={`showing-address-${showing.id}`}
                style={{ ...styles.input, marginTop: 0 }}
                value={showing.address}
                onChange={(e) => updateShowing(index, "address", e.target.value)}
                placeholder="123 Oak St"
              />
            </div>

            <div style={styles.field}>
              <label
                htmlFor={`showing-feedback-${showing.id}`}
                style={styles.fieldCaption}
              >
                Showing Feedback
              </label>
              <textarea
                id={`showing-feedback-${showing.id}`}
                style={{ ...styles.textarea, marginTop: 0 }}
                value={showing.notes}
                onChange={(e) => updateShowing(index, "notes", e.target.value)}
                rows={8}
                placeholder="Paste showing feedback from today's showings..."
              />
            </div>

            {showings.length > 1 ? (
              <button
                type="button"
                style={{
                  ...styles.dangerButton,
                  ...(deleteHovered === index ? styles.dangerButtonHover : {}),
                }}
                onMouseEnter={() => setDeleteHovered(index)}
                onMouseLeave={() => setDeleteHovered(null)}
                onClick={() => deleteShowing(index)}
              >
                Delete showing
              </button>
            ) : null}
          </div>
        ))}

        <div style={styles.buttonRow}>
          <button
            type="button"
            style={{
              ...styles.secondaryButton,
              ...(addHovered && !busy ? styles.secondaryButtonHover : {}),
              ...(busy ? styles.primaryButtonDisabled : {}),
            }}
            disabled={busy}
            onMouseEnter={() => setAddHovered(true)}
            onMouseLeave={() => setAddHovered(false)}
            onClick={addShowing}
          >
            + Add showing
          </button>
          <button
            type="button"
            style={{
              ...styles.secondaryButton,
              ...(saveHovered && !busy ? styles.secondaryButtonHover : {}),
              ...(busy ? styles.primaryButtonDisabled : {}),
            }}
            disabled={busy}
            onMouseEnter={() => setSaveHovered(true)}
            onMouseLeave={() => setSaveHovered(false)}
            onClick={handleSaveProgress}
          >
            {savingDraft ? "Saving…" : "Save progress"}
          </button>
          {showingSessionId ? (
            <button
              type="button"
              style={{
                ...styles.dangerButton,
                ...(discardHovered && !busy ? styles.dangerButtonHover : {}),
                ...(busy ? styles.primaryButtonDisabled : {}),
              }}
              disabled={busy}
              onMouseEnter={() => setDiscardHovered(true)}
              onMouseLeave={() => setDiscardHovered(false)}
              onClick={handleDiscardDraft}
            >
              {discardingDraft ? "Discarding…" : "Discard draft"}
            </button>
          ) : null}
        </div>

        <section style={styles.realtorNotesCard}>
          <label style={styles.label}>
            Realtor Notes (optional)
            <textarea
              style={styles.realtorNotesTextarea}
              value={realtorNotes}
              onChange={(e) => setRealtorNotes(e.target.value)}
              rows={4}
              placeholder="Add any personal notes, observations, or context you want included in the report..."
            />
          </label>
        </section>

        {statusMessage ? <p style={styles.status}>{statusMessage}</p> : null}
        {error ? <p style={styles.error}>{error}</p> : null}

        <button
          type="submit"
          style={{
            ...styles.primaryButton,
            ...(submitHovered && !busy ? styles.primaryButtonHover : {}),
            ...(busy ? styles.primaryButtonDisabled : {}),
          }}
          disabled={busy}
          onMouseEnter={() => setSubmitHovered(true)}
          onMouseLeave={() => setSubmitHovered(false)}
        >
          {loading ? "Generating summary…" : "Generate report"}
        </button>
      </form>
    </div>
  );
}

const styles = {
  card: {
    marginBottom: "2rem",
    border: `1px solid ${colors.hairline}`,
    borderRadius: "8px",
    overflow: "hidden",
  },
  cardHeader: {
    ...sectionHeaderBar,
    borderRadius: 0,
  },
  form: {
    padding: "1.5rem",
    background: colors.bg,
  },
  clientCard: {
    ...calloutBox,
    padding: 0,
    marginBottom: "1.25rem",
  },
  clientHeader: {
    ...sectionHeaderBar,
    borderRadius: "6px 6px 0 0",
  },
  clientTitle: {
    margin: 0,
    fontSize: "1rem",
    fontWeight: 650,
  },
  clientBody: {
    padding: "1.25rem 1.5rem",
  },
  clientField: {
    marginBottom: "1rem",
  },
  clientLabel: {
    display: "block",
    fontSize: "0.85rem",
    fontWeight: 600,
    color: colors.slate,
    marginBottom: "0.35rem",
  },
  clientInput: {
    width: "100%",
    padding: "0.55rem 0.75rem",
    borderRadius: "6px",
    border: `1px solid ${colors.hairline}`,
    fontSize: "0.95rem",
    fontFamily: type.fontFamily,
    color: colors.ink,
    background: colors.bg,
    boxSizing: "border-box",
  },
  showingBlock: {
    marginBottom: "1rem",
  },
  field: {
    display: "block",
    marginBottom: "0.85rem",
  },
  fieldCaption: {
    display: "block",
    fontSize: "0.9rem",
    fontWeight: 500,
    marginBottom: "0.35rem",
    color: colors.ink,
  },
  realtorNotesCard: {
    ...calloutBox,
    marginBottom: "1.25rem",
    padding: "1rem 1.15rem",
    borderLeft: `3px solid ${colors.navy}`,
  },
  realtorNotesTextarea: {
    display: "block",
    width: "100%",
    marginTop: "0.35rem",
    padding: "0.75rem",
    fontSize: "0.95rem",
    border: `1px solid ${colors.hairline}`,
    borderRadius: "6px",
    boxSizing: "border-box",
    fontFamily: type.fontFamily,
    color: colors.ink,
    lineHeight: 1.5,
    resize: "vertical",
    background: colors.bg,
  },
  label: {
    display: "block",
    fontSize: "0.9rem",
    fontWeight: 500,
    marginBottom: "0.85rem",
    color: colors.ink,
  },
  input: {
    display: "block",
    width: "100%",
    marginTop: "0.35rem",
    padding: "0.6rem 0.75rem",
    fontSize: "0.95rem",
    border: `1px solid ${colors.hairline}`,
    borderRadius: "6px",
    boxSizing: "border-box",
    fontFamily: type.fontFamily,
    color: colors.ink,
  },
  textarea: {
    display: "block",
    width: "100%",
    marginTop: "0.35rem",
    padding: "0.75rem",
    fontSize: "0.95rem",
    border: `1px solid ${colors.hairline}`,
    borderRadius: "6px",
    boxSizing: "border-box",
    fontFamily: type.fontFamily,
    color: colors.ink,
    lineHeight: 1.5,
    resize: "vertical",
  },
  buttonRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "0.85rem",
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
    marginBottom: 0,
    marginRight: 0,
  },
  secondaryButtonHover: {
    background: colors.navyLight,
    color: colors.navyDark,
  },
  dangerButton: {
    padding: "0.45rem 0.9rem",
    fontSize: "0.85rem",
    fontWeight: 600,
    color: colors.danger,
    background: colors.bg,
    border: `1px solid ${colors.danger}`,
    borderRadius: "6px",
    cursor: "pointer",
    transition: "background 0.12s ease, color 0.12s ease",
    marginBottom: "0.85rem",
  },
  dangerButtonHover: {
    background: colors.dangerLight,
    color: colors.dangerDark,
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
  status: {
    color: colors.slate,
    fontSize: "0.9rem",
    margin: "0 0 0.75rem",
  },
  error: {
    color: colors.danger,
    fontSize: "0.9rem",
    margin: "0 0 0.75rem",
  },
};
