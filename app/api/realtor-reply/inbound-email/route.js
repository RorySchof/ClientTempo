import {
  claimInboundMessage,
  consumeCredits,
  refundCredits,
  releaseInboundMessage,
} from "@/lib/credits";
import {
  INBOUND_MAILGUN_DOMAIN,
  resolveUserIdFromRecipient,
} from "@/lib/inboundToken";
import { loadCreditContext } from "@/lib/requireAuthWithTokens";
import {
  generateReply,
  realtorReplyProvider,
} from "@/lib/manual-input/generateReply.js";
import { saveNote } from "@/lib/manual-input/store.js";
import {
  createEmptyReply,
  normalizeReply,
} from "@/lib/manual-input/schema/reply.js";

export const runtime = "nodejs";
export const maxDuration = 60;

const OUTBOUND_SUBJECT = "Your Realtor Reply";

/**
 * POST /api/realtor-reply/inbound-email
 * Mailgun inbound webhook: forward a client email, generate a Realtor Reply,
 * and email coaching notes + draft back to the realtor (Mailgun sender).
 * Does not persist, authenticate with Clerk, or touch other tools.
 */
export async function POST(request) {
  const expected = process.env.INBOUND_EMAIL_SECRET || "";
  const provided = new URL(request.url).searchParams.get("secret") || "";
  if (!expected || provided !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let spent = false;
  let userId = null;
  let messageId = "";
  try {
    const rawBody = await request.text();
    const data = Object.fromEntries(new URLSearchParams(rawBody));

    const sender = data.sender || data.from || "";
    const recipient = data.recipient || "";
    const subject = data.subject || "";
    const bodyPlain = data["body-plain"] || data["stripped-text"] || "";
    const cleanMessage = extractForwardedMessage(bodyPlain) || String(bodyPlain).trim();
    messageId = parseInboundMessageId(data);

    if (!cleanMessage) {
      console.log("[realtor-reply inbound] skipped: empty body");
      return Response.json({ ok: true, skipped: true, reason: "empty body" });
    }

    if (!sender) {
      console.log("[realtor-reply inbound] skipped: missing sender");
      return Response.json({ ok: true, skipped: true, reason: "missing sender" });
    }

    userId = await resolveUserIdFromRecipient(recipient);
    if (!userId) {
      console.log("[realtor-reply inbound] skipped: unknown recipient");
      return Response.json({
        ok: true,
        skipped: true,
        reason: "unknown recipient",
      });
    }

    if (messageId) {
      const claimed = await claimInboundMessage(messageId);
      if (!claimed) {
        return Response.json({ ok: true, duplicate: true });
      }
    }

    const ctx = await loadCreditContext(userId);
    if (!ctx.pro && ctx.credits === 0) {
      if (messageId) await releaseInboundMessage(messageId);
      return Response.json({ error: "Out of credits" }, { status: 402 });
    }
    spent = await consumeCredits(userId, 1);
    if (!spent) {
      if (messageId) await releaseInboundMessage(messageId);
      return Response.json({ error: "Out of credits" }, { status: 402 });
    }

    const agent = await generateReply(
      cleanMessage,
      { userId },
      realtorReplyProvider()
    );
    const clientEmail = extractClientEmail(bodyPlain);
    const draft = createEmptyReply();
    const note = normalizeReply({
      ...draft,
      client_emails: clientEmail ? [clientEmail] : [],
      email_subject: subject,
      source_text: cleanMessage,
      agent,
    });
    await saveNote(note, userId);

    const html = buildOutboundHtml(agent, subject, clientEmail);
    const text = buildOutboundPlainText(agent, subject, clientEmail);
    await sendRealtorReplyEmail({ to: sender, text, html });

    return Response.json({ ok: true });
  } catch (err) {
    if (spent && userId) {
      await refundCredits(userId, spent.source);
    }
    if (messageId) {
      await releaseInboundMessage(messageId);
    }
    console.error("realtor-reply inbound-email error:", err);
    return Response.json(
      { ok: false, error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}

function normalizeInboundMessageId(value) {
  return String(value || "")
    .trim()
    .replace(/^<|>$/g, "")
    .trim();
}

function parseInboundMessageId(data) {
  const direct = normalizeInboundMessageId(
    data["Message-Id"] || data["message-id"] || ""
  );
  if (direct) return direct;

  const rawHeaders = data["message-headers"];
  if (!rawHeaders) return "";
  try {
    const headers = JSON.parse(rawHeaders);
    if (!Array.isArray(headers)) return "";
    for (const entry of headers) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      if (String(entry[0] || "").toLowerCase() === "message-id") {
        const id = normalizeInboundMessageId(entry[1]);
        if (id) return id;
      }
    }
  } catch {
    return "";
  }
  return "";
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

function extractClientEmail(body) {
  const fromLine = String(body || "")
    .split(/\r?\n/)
    .find((line) => /^From:\s*/i.test(line.trim()));
  if (!fromLine) return "";
  const angled = fromLine.match(/<([^>]+)>/);
  if (angled?.[1]) return angled[1].trim();
  const bare = fromLine.match(/From:\s*(\S+@\S+)/i);
  return (bare?.[1] || "").replace(/[>,]$/g, "").trim();
}

function buildMailtoHref(clientEmail, inboundSubject, reply) {
  return (
    `mailto:${clientEmail || ""}` +
    `?subject=${encodeURIComponent("Re: " + (inboundSubject || ""))}` +
    `&body=${encodeURIComponent(reply || "")}`
  );
}

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function snapshotField(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "—";
}

function draftReplyText(agent) {
  return (
    (typeof agent?.draft_reply === "string" && agent.draft_reply.trim()) ||
    (typeof agent?.reply === "string" && agent.reply.trim()) ||
    ""
  );
}

function agentSections(agent) {
  const snapshot =
    agent?.client_snapshot && typeof agent.client_snapshot === "object"
      ? agent.client_snapshot
      : {};
  return {
    snapshot,
    actionItems: asList(agent?.action_items),
    followUps: asList(
      agent?.followups?.length ? agent.followups : agent?.followup_items
    ),
    coachNotes: asList(agent?.coach_notes),
    reply: draftReplyText(agent),
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlListBlock(items) {
  const list = asList(items);
  if (list.length === 0) {
    return `<p style="margin:0;font-style:italic;color:#8592A3;font-size:15px;line-height:1.6;">None</p>`;
  }
  return `<ul style="margin:0;padding-left:18px;">${list
    .map(
      (item) =>
        `<li style="margin:0 0 5px;color:#4B5768;font-size:15px;line-height:1.6;">${escapeHtml(item)}</li>`
    )
    .join("")}</ul>`;
}

function bullets(items) {
  const list = asList(items);
  if (list.length === 0) return "- None";
  return list.map((item) => `- ${String(item)}`).join("\n");
}

function buildOutboundPlainText(agent, inboundSubject, clientEmail = "") {
  const { snapshot, actionItems, followUps, coachNotes, reply } =
    agentSections(agent);
  const mailto = buildMailtoHref(clientEmail, inboundSubject, reply);

  return `Your Realtor Reply
${inboundSubject ? `\nForwarded subject: ${inboundSubject}` : ""}

Internal Summary (Not Sent to Client)

Client Summary
- Client Status: ${snapshotField(snapshot.client_status)}
- Decision Factors: ${snapshotField(snapshot.decision_factors)}
- Momentum Signal: ${snapshotField(snapshot.momentum_signal)}

Coach's Insight
${bullets(coachNotes)}

Action Items
${bullets(actionItems)}

Follow-ups
${bullets(followUps)}

Draft Reply
Sent to client

${reply || "—"}

Send to Client: ${mailto}
Copy Reply: Copy the Draft Reply section above and paste it into your email client.
`;
}

function buildOutboundHtml(agent, inboundSubject, clientEmail = "") {
  const { snapshot, actionItems, followUps, coachNotes, reply } =
    agentSections(agent);
  const replyHtml = escapeHtml(reply || "—").replace(/\n/g, "<br>");
  const forwarded = inboundSubject
    ? `<p style="margin:8px 0 0;font-size:14px;color:#4B5768;">Forwarded subject: ${escapeHtml(inboundSubject)}</p>`
    : "";
  const mailtoHref = escapeHtml(
    buildMailtoHref(clientEmail, inboundSubject, reply)
  );
  const summaryRow = (label, value, last = false) => `
            <p style="margin:0 0 ${last ? "0" : "9px"};font-size:15px;line-height:1.6;color:#4B5768;">
              <span style="display:inline-block;min-width:140px;font-weight:600;color:#4B5768;">${label}</span>
              <span>${escapeHtml(snapshotField(value))}</span>
            </p>`;

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F7F9FA;">
  <div style="background:#F7F9FA;padding:24px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:640px;margin:0 auto;">
      <h1 style="margin:0 0 16px;font-size:18px;font-weight:600;color:#1A2331;letter-spacing:0.01em;">Your Realtor Reply</h1>
      ${forwarded}

      <div style="margin-top:16px;border:1px solid #DCE3E8;border-radius:8px;overflow:hidden;background:#FFFFFF;">
        <div style="background:#1B3A4B;color:#FFFFFF;padding:10px 20px;font-size:15px;font-weight:600;letter-spacing:0.01em;">Internal Summary (Not Sent to Client)</div>
        <div style="padding:20px 24px 8px;background:#FFFFFF;color:#1A2331;">
          <div style="margin:0 0 22px;">
            <h3 style="margin:0 0 8px;font-size:16px;font-weight:650;color:#1B3A4B;">Client Summary</h3>
            ${summaryRow("Client Status", snapshot.client_status)}
            ${summaryRow("Decision Factors", snapshot.decision_factors)}
            ${summaryRow("Momentum Signal", snapshot.momentum_signal, true)}
          </div>

          <div style="background:#E7EEF0;border:1px solid #DCE3E8;border-radius:6px;padding:14px 16px;margin:0 0 22px;">
            <h3 style="margin:0 0 8px;font-size:16px;font-weight:650;color:#1B3A4B;">Coach’s Insight</h3>
            ${htmlListBlock(coachNotes)}
          </div>

          <div style="margin:0 0 22px;">
            <h3 style="margin:0 0 8px;font-size:16px;font-weight:650;color:#1B3A4B;">Action Items</h3>
            ${htmlListBlock(actionItems)}
          </div>

          <div style="margin:0 0 16px;">
            <h3 style="margin:0 0 8px;font-size:16px;font-weight:650;color:#1B3A4B;">Follow-ups</h3>
            ${htmlListBlock(followUps)}
          </div>
        </div>
      </div>

      <div style="margin-top:28px;border:1px solid #DCE3E8;border-radius:8px;overflow:hidden;background:#FFFFFF;">
        <div style="background:#1B3A4B;color:#FFFFFF;padding:10px 20px;font-size:15px;font-weight:600;letter-spacing:0.01em;">
          Draft Reply
          <span style="float:right;font-size:12px;font-weight:500;letter-spacing:0.04em;text-transform:uppercase;color:#C9D8DF;">Sent to client</span>
        </div>
        <div style="padding:20px 24px 24px;background:#FFFFFF;">
          <p style="margin:0;white-space:pre-wrap;font-size:15px;line-height:1.6;color:#4B5768;">${replyHtml}</p>
          <div style="margin-top:16px;">
            <a href="${mailtoHref}" style="display:inline-block;background:#1B3A4B;color:#ffffff;font-size:14px;font-weight:600;padding:10px 18px;border-radius:6px;text-decoration:none;">Send to Client</a>
          </div>
          <p style="margin:12px 0 0;font-size:13px;color:#8592A3;">Copy Reply: select the draft above and paste it into your email client.</p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function sendRealtorReplyEmail({ to, text, html }) {
  const apiKey = process.env.MAILGUN_API_KEY;
  if (!apiKey) {
    throw new Error("MAILGUN_API_KEY is not set");
  }

  const response = await fetch(
    `https://api.mailgun.net/v3/${INBOUND_MAILGUN_DOMAIN}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        from: `Realtor Reply <assistant@${INBOUND_MAILGUN_DOMAIN}>`,
        to,
        subject: OUTBOUND_SUBJECT,
        text: text || "",
        html: html || "",
      }).toString(),
    }
  );

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Mailgun send failed (${response.status}): ${body}`);
  }
}
