import { summarizeShowingNotes as summarizeShowingNotesGroq } from "./groq.js";
import { summarizeShowingNotes as summarizeShowingNotesOpenAI } from "./openai.js";

export function showingNotesProvider(value) {
  return value === "groq" ? "groq" : "openai";
}

export async function summarizeShowingNotes(
  rawText,
  extras = {},
  usageCtx = {},
  provider = "openai"
) {
  if (showingNotesProvider(provider) === "groq") {
    return summarizeShowingNotesGroq(rawText, extras, usageCtx);
  }
  return summarizeShowingNotesOpenAI(rawText, extras);
}
