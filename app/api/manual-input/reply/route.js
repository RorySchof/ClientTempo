import { consumeCredits, refundCredits } from "@/lib/credits";
import {
  OUT_OF_TOKENS,
  requireAuthWithTokens,
} from "@/lib/requireAuthWithTokens";
import {
  generateReply,
  realtorReplyProvider,
} from "@/lib/manual-input/generateReply.js";
import { saveNote } from "@/lib/manual-input/store.js";
import {
  createEmptyReply,
  normalizeReply,
  validateReply,
} from "@/lib/manual-input/schema/reply.js";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  const authz = await requireAuthWithTokens();
  if (authz instanceof Response) return authz;

  let spent = false;
  try {
    const body = await request.json();
    const text = typeof body.text === "string" ? body.text : "";

    if (!text.trim()) {
      return Response.json({ error: "Missing text" }, { status: 400 });
    }

    spent = await consumeCredits(authz.userId, 1);
    if (!spent) {
      return Response.json({ error: OUT_OF_TOKENS }, { status: 402 });
    }

    const agent = await generateReply(text, { userId: authz.userId }, realtorReplyProvider(body.provider));
    if (!agent || typeof agent !== "object" || Object.keys(agent).length === 0) {
      await refundCredits(authz.userId, spent.source);
      return Response.json(
        { error: "Reply generation returned no usable fields" },
        { status: 502 }
      );
    }

    const draft = createEmptyReply();
    const note = normalizeReply({
      ...draft,
      client_names: body.client_names ?? body.clientNames,
      client_emails: body.client_emails ?? body.clientEmails,
      email_subject: body.email_subject ?? body.emailSubject,
      source_text: text.trim(),
      agent,
    });

    if (!validateReply(note)) {
      await refundCredits(authz.userId, spent.source);
      return Response.json(
        { error: "Reply generation returned no usable fields" },
        { status: 502 }
      );
    }

    if (body.store !== false) {
      await saveNote(note);
    }

    return Response.json({ note });
  } catch (err) {
    if (spent) {
      await refundCredits(authz.userId, spent.source);
    }
    console.error("Reply generation error:", err);
    const emptyOutput = err?.message === "Reply generation returned no usable fields";
    return Response.json(
      { error: "Failed to generate reply" },
      { status: emptyOutput ? 502 : 500 }
    );
  }
}
