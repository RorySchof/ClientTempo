import { clerkClient } from "@clerk/nextjs/server";
import { consumeCredits, refundCredits } from "@/lib/credits";
import { loadCreditContext } from "@/lib/requireAuthWithTokens";
import { summarizeShowingNotes } from "@/lib/showing-notes/groq.js";
import { saveNote } from "@/lib/showing-notes/store.js";
import { sendMailgunMessage, getInboundAddress, getMailgunDomain } from "@/lib/showing-notes/mailgun.js";
import { INBOUND_WEBHOOK_URL } from "@/lib/showing-notes/config.js";
import {
  createEmptyNote,
  normalizeShowingNote,
} from "@/lib/showing-notes/schema/showingNotes.js";

/**
 * POST /api/showing-notes/inbound-email
 * Mailgun inbound webhook for forwarded showing notes.
 */
export const runtime = "nodejs";

function parseSenderEmail(from) {
  const raw = String(from || "").trim();
  if (!raw) return "";
  const angle = raw.match(/<([^>]+)>/);
  return (angle ? angle[1] : raw).trim().toLowerCase();
}

async function resolveInboundUserId(from) {
  const email = parseSenderEmail(from);
  if (!email || !email.includes("@")) return null;

  const clerk = await clerkClient();
  const result = await clerk.users.getUserList({
    emailAddress: [email],
    limit: 2,
  });
  const users = Array.isArray(result?.data)
    ? result.data
    : Array.isArray(result)
      ? result
      : [];
  if (users.length !== 1) return null;
  const userId = users[0]?.id;
  return typeof userId === "string" && userId ? userId : null;
}

export async function POST(request) {
  const expected = process.env.INBOUND_EMAIL_SECRET || "";
  const provided = new URL(request.url).searchParams.get("secret") || "";
  if (!expected || provided !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let spent = false;
  let userId = null;
  try {
    const rawBody = await request.text();
    const data = Object.fromEntries(new URLSearchParams(rawBody));

    const subject = data.subject || "";
    const sender = data.sender || data.from || "";
    const bodyPlain = data["body-plain"] || data["stripped-text"] || "";
    const rawText = extractForwardedMessage(bodyPlain) || bodyPlain;

    if (!rawText.trim()) {
      return Response.json({ ok: true, skipped: true, reason: "empty body" });
    }

    userId = await resolveInboundUserId(sender);
    if (!userId) {
      return Response.json({
        ok: true,
        skipped: true,
        reason: "unknown sender",
      });
    }

    const ctx = await loadCreditContext(userId);
    if (!ctx.pro && ctx.credits === 0) {
      return Response.json({ error: "Out of credits" }, { status: 402 });
    }
    spent = await consumeCredits(userId, 1);
    if (!spent) {
      return Response.json({ error: "Out of credits" }, { status: 402 });
    }

    const draft = createEmptyNote();
    const addressHint = guessAddress(subject, rawText);

    const summarized = await summarizeShowingNotes(
      rawText,
      {
        id: draft.id,
        createdAt: draft.createdAt,
        address: addressHint,
        agentName: "",
      },
      { userId }
    );

    const note = normalizeShowingNote({
      ...summarized,
      raw_notes: rawText,
    });

    await saveNote(note, userId);

    if (sender) {
      try {
        const { text, html } = buildNoteEmail(note);
        await sendMailgunMessage({
          to: sender,
          subject:
            note.email_subject_realtor ||
            (addressHint
              ? `Showing notes — ${addressHint}`
              : `Showing notes — ${subject || note.id}`),
          text,
          html,
        });
      } catch (mailErr) {
        console.error("Confirmation email failed:", mailErr.message);
      }
    }

    return Response.json({
      ok: true,
      noteId: note.id,
      inbound: getInboundAddress(),
      domain: getMailgunDomain(),
      webhook: INBOUND_WEBHOOK_URL,
    });
  } catch (err) {
    if (spent && userId) {
      await refundCredits(userId, spent.source);
    }
    console.error("inbound-email error:", err);
    return Response.json(
      { ok: false, error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}

function buildNoteEmail(note) {
  const list = (items) =>
    items?.length ? items.map((i) => `- ${i}`).join("\n") : "- None";

  const text = `Showing notes

Sentiment: ${note.client_sentiment || "—"}

Client email subject: ${note.email_subject_client || "—"}

Client summary:
${note.client_summary || "—"}

Property highlights:
${list(note.property_highlights)}

Property concerns:
${list(note.property_concerns)}

Property comparison:
${note.property_comparison || "—"}

Realtor action items:
${list(note.realtor_action_items)}

Follow-ups:
${list(note.follow_ups)}

Coaching insights (internal):
${note.coaching_insights || "—"}

Realtor reply subject: ${note.email_subject_realtor || "—"}

Realtor reply:
${note.realtor_reply || "—"}
`;

  const html = `
  <div style="font-family:Arial,sans-serif;background:#f7f7f7;padding:24px;">
    <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:24px;">
      <h1 style="font-size:18px;margin:0 0 16px;">Showing notes</h1>
      <p style="margin:0 0 16px;"><strong>Sentiment:</strong> ${escapeHtml(note.client_sentiment || "—")}</p>

      <h2 style="font-size:15px;margin:0 0 8px;">Client summary</h2>
      <p style="font-size:13px;color:#6b7280;margin:0 0 4px;">Subject: ${escapeHtml(note.email_subject_client || "—")}</p>
      <p style="white-space:pre-wrap;line-height:1.5;margin:0 0 16px;">${escapeHtml(note.client_summary || "—")}</p>

      <h2 style="font-size:15px;margin:0 0 8px;">Property highlights</h2>
      <ul>${(note.property_highlights || []).map((i) => `<li>${escapeHtml(i)}</li>`).join("") || "<li>None</li>"}</ul>

      <h2 style="font-size:15px;margin:16px 0 8px;">Property concerns</h2>
      <ul>${(note.property_concerns || []).map((i) => `<li>${escapeHtml(i)}</li>`).join("") || "<li>None</li>"}</ul>

      <h2 style="font-size:15px;margin:16px 0 8px;">Property comparison</h2>
      <p style="white-space:pre-wrap;line-height:1.5;margin:0 0 16px;">${escapeHtml(note.property_comparison || "—")}</p>

      <h2 style="font-size:15px;margin:0 0 8px;">Realtor action items</h2>
      <ul>${(note.realtor_action_items || []).map((i) => `<li>${escapeHtml(i)}</li>`).join("") || "<li>None</li>"}</ul>

      <h2 style="font-size:15px;margin:16px 0 8px;">Follow-ups</h2>
      <ul>${(note.follow_ups || []).map((i) => `<li>${escapeHtml(i)}</li>`).join("") || "<li>None</li>"}</ul>

      <h2 style="font-size:15px;margin:16px 0 8px;">Coaching insights (internal)</h2>
      <p style="white-space:pre-wrap;line-height:1.5;margin:0 0 16px;background:#f9fafb;padding:12px;border-radius:6px;">${escapeHtml(note.coaching_insights || "—")}</p>

      <h2 style="font-size:15px;margin:0 0 8px;">Realtor reply</h2>
      <p style="font-size:13px;color:#6b7280;margin:0 0 4px;">Subject: ${escapeHtml(note.email_subject_realtor || "—")}</p>
      <pre style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:14px;line-height:1.5;margin:0;">${escapeHtml(note.realtor_reply || "—")}</pre>
    </div>
  </div>`;

  return { text, html };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function guessAddress(subject, text) {
  const combined = `${subject}\n${text}`;
  const match = combined.match(
    /\b\d{1,5}\s+[A-Za-z0-9.'\-]+\s+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Boulevard|Blvd|Way|Place|Pl)\b/i
  );
  return match ? match[0] : "";
}

function extractForwardedMessage(body) {
  if (!body || typeof body !== "string") return "";

  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const separatorPattern = /^-{2,}\s*Forwarded message\s*-{2,}\s*$/i;
  const forwardedMarkerPattern = /forwarded message/i;
  const headerLinePattern = /^(From|Date|Subject|To):\s*/i;

  const separatorIndex = lines.findIndex(
    (line) =>
      separatorPattern.test(line.trim()) || forwardedMarkerPattern.test(line.trim())
  );

  if (separatorIndex === -1) return body.trim();

  let index = separatorIndex + 1;
  while (index < lines.length && headerLinePattern.test(lines[index].trim())) {
    index++;
  }

  const blankIndex = lines.findIndex((line, i) => i >= index && line.trim() === "");
  if (blankIndex === -1) return lines.slice(index).join("\n").trim();
  return lines.slice(blankIndex + 1).join("\n").trim();
}

