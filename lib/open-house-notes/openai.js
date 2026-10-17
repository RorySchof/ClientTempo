import OpenAI from "openai";
import { normalizeOpenHouseNote } from "./schema/showingNotes.js";
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

function openHouseNotesModel() {
  return (
    String(process.env.OPENAI_OPEN_HOUSE_NOTES_MODEL || "").trim() ||
    "gpt-6-luna"
  );
}

export async function summarizeOpenHouseNotes(rawText, extras = {}) {
  const userContent = JSON.stringify({
    raw_text: String(rawText || "").trim(),
    address_hint: extras.address || "",
    seller_name_hint: extras.sellerName || extras.agentName || "",
    agent_name_hint: extras.agentName || "",
    date_hint: extras.createdAt || "",
    realtorNotes: extras.realtorNotes || "",
  });

  const completion = await getClient().chat.completions.create({
    model: openHouseNotesModel(),
    messages: [
      { role: "system", content: loadPrompt("open-house-notes.txt") },
      { role: "user", content: userContent },
    ],
  });

  const choice = completion.choices?.[0];
  const content = messageContentToString(choice?.message?.content ?? "");
  if (!content.trim()) {
    throw new Error("Summarize returned empty model output");
  }

  const parsed = extractJsonObject(content);
  if (!parsed) {
    throw new Error("Summarize returned unparseable JSON");
  }

  const hasSellerEmail =
    typeof parsed.seller_report_email === "string" &&
    parsed.seller_report_email.trim();
  const hasActionItems = Array.isArray(parsed.host_action_items);
  if (!hasSellerEmail || !hasActionItems) {
    throw new Error("Summarize returned no usable open-house-note fields");
  }

  return normalizeOpenHouseNote({
    ...parsed,
    id: extras.id,
    createdAt: extras.createdAt,
    property_address: extras.address || parsed.property_address,
  });
}
