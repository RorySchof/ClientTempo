import { consumeCredits, refundCredits } from "@/lib/credits";
import {
  OUT_OF_TOKENS,
  requireAuthWithTokens,
} from "@/lib/requireAuthWithTokens";
import {
  openHouseNotesProvider,
  summarizeOpenHouseNotes,
} from "@/lib/open-house-notes/generate.js";
import { saveNote } from "@/lib/open-house-notes/store.js";
import {
  createEmptyNote,
  normalizeOpenHouseNote,
} from "@/lib/open-house-notes/schema/showingNotes.js";

export const maxDuration = 60;

function mergeOpenHouses(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return "";
  return entries
    .map((s) => {
      const address = typeof s?.address === "string" ? s.address.trim() : "";
      const notes = typeof s?.notes === "string" ? s.notes.trim() : "";
      if (!address && !notes) return "";
      return `${address}:\n${notes}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

function firstAddress(entries) {
  if (!Array.isArray(entries)) return "";
  for (const entry of entries) {
    const address = typeof entry?.address === "string" ? entry.address.trim() : "";
    if (address) return address;
  }
  return "";
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
    const entries = body.open_houses || body.showings;
    const raw_notes =
      mergeOpenHouses(entries) ||
      (typeof body.rawText === "string" ? body.rawText : "") ||
      (typeof body.raw_text === "string" ? body.raw_text : "") ||
      (typeof body.text === "string" ? body.text : "");
    const rawText = raw_notes;

    if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
      return Response.json({ error: "rawText is required" }, { status: 400 });
    }

    spent = await consumeCredits(authz.userId, 1);
    if (!spent) {
      return Response.json({ error: OUT_OF_TOKENS }, { status: 402 });
    }

    const draft = createEmptyNote();
    const propertyAddress = firstAddress(entries);
    const summarized = await summarizeOpenHouseNotes(
      rawText,
      {
        id: draft.id,
        createdAt: draft.createdAt,
        address: propertyAddress,
        sellerName:
          asOptionalStringArray(body.seller_names || body.client_names)?.[0] ||
          "",
        realtorNotes:
          typeof body.realtorNotes === "string" ? body.realtorNotes.trim() : "",
      },
      { userId: authz.userId },
      openHouseNotesProvider(body.provider)
    );

    const seller_names = asOptionalStringArray(
      body.seller_names ?? body.client_names
    );
    const seller_emails = asOptionalStringArray(
      body.seller_emails ?? body.client_emails
    );
    const note = normalizeOpenHouseNote({
      ...summarized,
      raw_notes,
      ...(seller_names !== undefined ? { seller_names } : {}),
      ...(seller_emails !== undefined ? { seller_emails } : {}),
      ...(propertyAddress ? { property_address: propertyAddress } : {}),
    });

    if (body.store !== false) {
      await saveNote(note);
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
