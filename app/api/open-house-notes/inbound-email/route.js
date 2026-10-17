import { clerkClient } from "@clerk/nextjs/server";
import { consumeCredits, refundCredits } from "@/lib/credits";
import { loadCreditContext } from "@/lib/requireAuthWithTokens";
import { summarizeOpenHouseNotes } from "@/lib/open-house-notes/groq.js";
import { saveNote } from "@/lib/open-house-notes/store.js";
import { sendMailgunMessage, getInboundAddress, getMailgunDomain } from "@/lib/open-house-notes/mailgun.js";
import { INBOUND_WEBHOOK_URL } from "@/lib/open-house-notes/config.js";
import {
  createEmptyNote,
  composeSellerEmailBody,
  normalizeOpenHouseNote,
} from "@/lib/open-house-notes/schema/showingNotes.js";

/**
 * POST /api/open-house-notes/inbound-email
 * Mailgun inbound webhook for forwarded open-house notes.
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

    const summarized = await summarizeOpenHouseNotes(
      rawText,
      {
        id: draft.id,
        createdAt: draft.createdAt,
        address: addressHint,
        agentName: "",
      },
      { userId }
    );

    const note = normalizeOpenHouseNote({
      ...summarized,
      raw_notes: rawText,
      ...(addressHint ? { property_address: addressHint } : {}),
    });

    await saveNote(note, userId);

    if (sender) {
      try {
        const { text, html } = buildNoteEmail(note);
        await sendMailgunMessage({
          to: sender,
          subject:
            note.email_subject_agent ||
            (addressHint
              ? `Open House Notes — ${addressHint}`
              : `Open House Notes — ${subject || note.id}`),
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

function countLines(title, rows) {
  return `${title}:\n${rows.map(([label, value]) => `- ${label}: ${value}`).join("\n")}`;
}

function visitorFeedbackText(groups) {
  if (!groups?.length) return "- None";
  return groups
    .map((group) => {
      const likes = group.likes?.length ? group.likes.map((i) => `  - ${i}`).join("\n") : "  - None";
      const concerns = group.concerns?.length
        ? group.concerns.map((i) => `  - ${i}`).join("\n")
        : "  - None";
      const questions = group.questions?.length
        ? group.questions.map((i) => `  - ${i}`).join("\n")
        : "  - None";
      return `${group.visitor_type || "Visitor"}
Interest: ${group.interest_level || "—"}
Likes:
${likes}
Concerns:
${concerns}
Questions:
${questions}`;
    })
    .join("\n\n");
}

function listHtml(items) {
  if (!items?.length) return "<li>None</li>";
  return items.map((i) => `<li>${escapeHtml(i)}</li>`).join("");
}

function buildNoteEmail(note) {
  const list = (items) =>
    items?.length ? items.map((i) => `- ${i}`).join("\n") : "- None";
  const headcount = note.visitor_headcount || {};
  const interest = note.interest_level || {};
  const sellerEmail = composeSellerEmailBody(note);

  const text = `Open House Notes

Listed property: ${note.property_address || "—"}

Interest level: ${note.interest_level_summary || "—"}

${countLines("Visitor headcount", [
  ["Total visitors", headcount.total_visitors ?? 0],
  ["Serious buyers", headcount.serious_buyers ?? 0],
  ["Casual neighbors", headcount.casual_neighbors ?? 0],
  ["Agent-accompanied buyers", headcount.agent_accompanied_buyers ?? 0],
])}

${countLines("Interest signals", [
  ["Lingered", interest.lingered ?? 0],
  ["Asked detailed questions", interest.asked_detailed_questions ?? 0],
  ["Requested follow-up", interest.requested_follow_up ?? 0],
  ["Asked about offer timing", interest.asked_about_offer_timing ?? 0],
])}

Seller email subject: ${note.email_subject_seller || "—"}

Host summary:
${note.host_summary || "—"}

Property strengths:
${list(note.property_strengths)}

Property concerns:
${list(note.property_concerns)}

Visitor feedback:
${visitorFeedbackText(note.visitor_feedback)}

Host action items:
${list(note.host_action_items)}

Coaching insights (internal):
${note.coaching_insights || "—"}

Seller report subject: ${note.email_subject_seller || "—"}

Seller report email:
${sellerEmail || "—"}
`;

  const html = `
  <div style="font-family:Arial,sans-serif;background:#f7f7f7;padding:24px;">
    <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:24px;">
      <h1 style="font-size:18px;margin:0 0 16px;">Open House Notes</h1>
      <p style="margin:0 0 8px;"><strong>Listed property:</strong> ${escapeHtml(note.property_address || "—")}</p>
      <p style="margin:0 0 16px;"><strong>Interest level:</strong> ${escapeHtml(note.interest_level_summary || "—")}</p>

      <h2 style="font-size:15px;margin:0 0 8px;">Visitor headcount</h2>
      <ul>
        <li>Total visitors: ${escapeHtml(headcount.total_visitors ?? 0)}</li>
        <li>Serious buyers: ${escapeHtml(headcount.serious_buyers ?? 0)}</li>
        <li>Casual neighbors: ${escapeHtml(headcount.casual_neighbors ?? 0)}</li>
        <li>Agent-accompanied buyers: ${escapeHtml(headcount.agent_accompanied_buyers ?? 0)}</li>
      </ul>

      <h2 style="font-size:15px;margin:16px 0 8px;">Interest signals</h2>
      <ul>
        <li>Lingered: ${escapeHtml(interest.lingered ?? 0)}</li>
        <li>Asked detailed questions: ${escapeHtml(interest.asked_detailed_questions ?? 0)}</li>
        <li>Requested follow-up: ${escapeHtml(interest.requested_follow_up ?? 0)}</li>
        <li>Asked about offer timing: ${escapeHtml(interest.asked_about_offer_timing ?? 0)}</li>
      </ul>

      <h2 style="font-size:15px;margin:16px 0 8px;">Host summary</h2>
      <p style="font-size:13px;color:#6b7280;margin:0 0 4px;">Subject: ${escapeHtml(note.email_subject_seller || "—")}</p>
      <p style="white-space:pre-wrap;line-height:1.5;margin:0 0 16px;">${escapeHtml(note.host_summary || "—")}</p>

      <h2 style="font-size:15px;margin:0 0 8px;">Property strengths</h2>
      <ul>${listHtml(note.property_strengths)}</ul>

      <h2 style="font-size:15px;margin:16px 0 8px;">Property concerns</h2>
      <ul>${listHtml(note.property_concerns)}</ul>

      <h2 style="font-size:15px;margin:16px 0 8px;">Visitor feedback</h2>
      ${(note.visitor_feedback || [])
        .map(
          (group) => `
        <h3 style="font-size:14px;margin:12px 0 6px;">${escapeHtml(group.visitor_type || "Visitor")}</h3>
        <p style="margin:0 0 8px;"><strong>Interest:</strong> ${escapeHtml(group.interest_level || "—")}</p>
        <p style="margin:0 0 4px;"><strong>Likes</strong></p>
        <ul>${listHtml(group.likes)}</ul>
        <p style="margin:8px 0 4px;"><strong>Concerns</strong></p>
        <ul>${listHtml(group.concerns)}</ul>
        <p style="margin:8px 0 4px;"><strong>Questions</strong></p>
        <ul>${listHtml(group.questions)}</ul>
      `
        )
        .join("") || "<p>None</p>"}

      <h2 style="font-size:15px;margin:16px 0 8px;">Host action items</h2>
      <ul>${listHtml(note.host_action_items)}</ul>

      <h2 style="font-size:15px;margin:16px 0 8px;">Agent coaching insights (internal)</h2>
      <p style="white-space:pre-wrap;line-height:1.5;margin:0 0 16px;background:#f9fafb;padding:12px;border-radius:6px;">${escapeHtml(note.coaching_insights || "—")}</p>

      <h2 style="font-size:15px;margin:0 0 8px;">Seller report email</h2>
      <p style="font-size:13px;color:#6b7280;margin:0 0 4px;">Subject: ${escapeHtml(note.email_subject_seller || "—")}</p>
      <pre style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:14px;line-height:1.5;margin:0;">${escapeHtml(sellerEmail || "—")}</pre>
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

