import { summarizeOpenHouseNotes as summarizeOpenHouseNotesGroq } from "./groq.js";
import { summarizeOpenHouseNotes as summarizeOpenHouseNotesOpenAI } from "./openai.js";

export function openHouseNotesProvider(value) {
  return value === "groq" ? "groq" : "openai";
}

export async function summarizeOpenHouseNotes(
  rawText,
  extras = {},
  usageCtx = {},
  provider = "openai"
) {
  if (openHouseNotesProvider(provider) === "groq") {
    return summarizeOpenHouseNotesGroq(rawText, extras, usageCtx);
  }
  return summarizeOpenHouseNotesOpenAI(rawText, extras);
}
