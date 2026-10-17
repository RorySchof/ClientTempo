//groq.js

import Groq from "groq-sdk";
import { logGroqUsage } from "../dev/logGroqUsage.js";
import { recordUsage } from "../usage/recordUsage.js";
import { normalizeOpenHouseNote } from "./schema/showingNotes.js";
import { loadPrompt } from "../prompts/loadPrompt.js";

const MODEL = "openai/gpt-oss-120b";

function getClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set");
  }
  return new Groq({ apiKey });
}

function tryParseObject(text) {
  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj;
  } catch {
    /* not valid JSON */
  }
  return null;
}

export function extractJsonObject(text) {
  if (!text || typeof text !== "string") return null;
  const s = text.trim();

  const direct = tryParseObject(s);
  if (direct) return direct;

  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    const fenced = tryParseObject(fence[1].trim());
    if (fenced) return fenced;
  }

  let best = null;
  let bestLen = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== "{") continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let j = i; j < s.length; j++) {
      const ch = s[j];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === "\"") inStr = false;
        continue;
      }
      if (ch === "\"") inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const candidate = tryParseObject(s.slice(i, j + 1));
          if (candidate && j + 1 - i > bestLen) {
            best = candidate;
            bestLen = j + 1 - i;
          }
          break;
        }
      }
    }
  }
  return best;
}

export function messageContentToString(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .join("");
  }
  return "";
}

/**
 * Summarize raw open-house visitor notes into an Open House Notes object.
 * Preserves id / createdAt from extras when provided.
 */
export async function summarizeOpenHouseNotes(rawText, extras = {}, usageCtx = {}) {
  const client = getClient();
  const userContent = JSON.stringify({
    raw_text: String(rawText || "").trim(),
    address_hint: extras.address || "",
    seller_name_hint: extras.sellerName || extras.agentName || "",
    agent_name_hint: extras.agentName || "",
    date_hint: extras.createdAt || "",
    realtorNotes: extras.realtorNotes || "",
  });

  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    reasoning_effort: "low",
    messages: [
      { role: "system", content: loadPrompt("open-house-notes.txt") },
      { role: "user", content: userContent },
    ],
  });
  logGroqUsage({ tool: "open-house-notes", response: completion });
  await recordUsage({
    userId: usageCtx.userId,
    tool: "open-house-notes",
    response: completion,
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

export const summarizeShowingNotes = summarizeOpenHouseNotes;
