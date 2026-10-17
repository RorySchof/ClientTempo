import OpenAI from "openai";
import { normalizeShowingNote } from "./schema/showingNotes.js";
import { loadPrompt } from "../prompts/loadPrompt.js";
import {
  extractJsonObject,
  messageContentToString,
} from "./groq.js";

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey });
}

function showingNotesModel() {
  return (
    String(process.env.OPENAI_SHOWING_NOTES_MODEL || "").trim() || "gpt-6-luna"
  );
}

export async function summarizeShowingNotes(rawText, extras = {}) {
  const userContent = JSON.stringify({
    raw_text: String(rawText || "").trim(),
    address_hint: extras.address || "",
    agent_name_hint: extras.agentName || "",
    realtorNotes: extras.realtorNotes || "",
  });

  const completion = await getClient().chat.completions.create({
    model: showingNotesModel(),
    messages: [
      { role: "system", content: loadPrompt("showing-notes.txt") },
      { role: "user", content: userContent },
    ],
  });

  const choice = completion.choices?.[0];
  const content = messageContentToString(choice?.message?.content ?? "");
  if (!content.trim()) {
    throw new Error("Summarize returned empty model output");
  }

  const parsed = extractJsonObject(content);
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    Object.keys(parsed).length === 0
  ) {
    const preview = String(content).replace(/\s+/g, " ").slice(0, 240);
    const finish = choice?.finish_reason
      ? ` (finish_reason=${choice.finish_reason})`
      : "";
    throw new Error(
      preview
        ? `Summarize returned unparseable JSON${finish}: ${preview}`
        : "Summarize returned empty model output"
    );
  }

  const hasSummary =
    typeof parsed.client_summary === "string" && parsed.client_summary.trim();
  const hasReply =
    typeof parsed.realtor_reply === "string" && parsed.realtor_reply.trim();
  if (!hasSummary && !hasReply) {
    throw new Error("Summarize returned no usable showing-note fields");
  }

  return normalizeShowingNote({
    ...parsed,
    id: extras.id,
    createdAt: extras.createdAt,
  });
}
