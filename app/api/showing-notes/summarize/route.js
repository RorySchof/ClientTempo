import { consumeCredits, refundCredits } from "@/lib/credits";
import {
  OUT_OF_TOKENS,
  requireAuthWithTokens,
} from "@/lib/requireAuthWithTokens";
import {
  showingNotesProvider,
  summarizeShowingNotes,
} from "@/lib/showing-notes/generate.js";
import { saveNote, getDraft, deleteDraft } from "@/lib/showing-notes/store.js";
import {
  createEmptyNote,
  normalizeShowingNote,
} from "@/lib/showing-notes/schema/showingNotes.js";

export const maxDuration = 60;

function mergeShowings(showings) {
  if (!Array.isArray(showings) || showings.length === 0) return "";
  return showings
    .map((s) => {
      const address = typeof s?.address === "string" ? s.address.trim() : "";
      const notes = typeof s?.notes === "string" ? s.notes.trim() : "";
      if (!address && !notes) return "";
      return `${address}:\n${notes}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

function asOptionalStringArray(value) {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item) => typeof item === "string");
}

export async function POST(request) {
  const authz = await requireAuthWithTokens();
  if (authz instanceof Response) return authz;

  let spent = false;
  try {
    const body = await request.json();
    const showingSessionId =
      typeof body.showingSessionId === "string" ? body.showingSessionId.trim() : "";

    let showings = Array.isArray(body.showings) ? body.showings : [];
    let client_names = asOptionalStringArray(body.client_names);
    let client_emails = asOptionalStringArray(body.client_emails);
    let realtorNotes =
      typeof body.realtorNotes === "string" ? body.realtorNotes : "";

    if (showingSessionId) {
      const savedDraft = await getDraft(showingSessionId);
      if (savedDraft) {
        if (client_names === undefined) {
          client_names = savedDraft.client_names;
        }
        if (client_emails === undefined) {
          client_emails = savedDraft.client_emails;
        }
        if (!realtorNotes.trim() && typeof savedDraft.realtorNotes === "string") {
          realtorNotes = savedDraft.realtorNotes;
        }
      }
    }

    const raw_notes = mergeShowings(showings);
    const rawText =
      raw_notes ||
      body.rawText ||
      body.raw_text ||
      body.text ||
      "";

    if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
      return Response.json({ error: "rawText is required" }, { status: 400 });
    }

    spent = await consumeCredits(authz.userId, 1);
    if (!spent) {
      return Response.json({ error: OUT_OF_TOKENS }, { status: 402 });
    }

    const noteDraft = createEmptyNote();
    const summarized = await summarizeShowingNotes(
      rawText,
      {
        id: noteDraft.id,
        createdAt: noteDraft.createdAt,
        realtorNotes: realtorNotes.trim(),
      },
      { userId: authz.userId },
      showingNotesProvider(body.provider)
    );

    const note = normalizeShowingNote({
      ...summarized,
      raw_notes,
      ...(client_names !== undefined ? { client_names } : {}),
      ...(client_emails !== undefined ? { client_emails } : {}),
    });

    if (body.store !== false) {
      await saveNote(note);
    }

    if (showingSessionId) {
      await deleteDraft(showingSessionId);
    }

    return Response.json({ note });
  } catch (err) {
    if (spent) {
      await refundCredits(authz.userId, spent.source);
    }
    console.error("summarize error:", err);
    return Response.json(
      { error: err.message || "Summarize failed" },
      { status: 500 }
    );
  }
}
