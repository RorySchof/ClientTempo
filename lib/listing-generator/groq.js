//groq.js

import Groq from "groq-sdk";
import { logGroqUsage } from "../dev/logGroqUsage.js";
import { recordUsage } from "../usage/recordUsage.js";
import { loadPrompt } from "../prompts/loadPrompt.js";

const MODEL = "openai/gpt-oss-120b";

function getClient() {
  const apiKey =
    process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || "";
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set");
  }
  return new Groq({ apiKey });
}

/**
 * Generate a polished MLS listing description from raw agent notes.
 */
export async function generateListingDescription(rawDescription, charLimit, usageCtx = {}) {
  const client = getClient();
  const trimmed = String(rawDescription || "").trim();
  const limit = Number(charLimit);
  const hasLimit = Number.isFinite(limit) && limit > 0;
  const systemPrompt = hasLimit
    ? loadPrompt("listing.txt").replace(
        "- Target roughly 80–180 words for a typical listing.",
        "- If a character limit is set, ignore the 80–180 word target and write fewer words if needed. Produce one cohesive paragraph without truncating mid-sentence."
      )
    : loadPrompt("listing.txt").replace(
        "- Write exactly one cohesive paragraph. Use two short paragraphs only if the source material is unusually rich and there's a natural split (e.g., interior vs. outdoor/location).\n",
        "- Write exactly one cohesive paragraph. Use two short paragraphs only if the source material is unusually rich and there's a natural split (e.g., interior vs. outdoor/location).\n- For full-length descriptions, use a warm, flowing MLS narrative and feel free to use multiple paragraphs.\n"
      );
  const userContent = hasLimit
    ? `Rewrite the following into a polished MLS listing description. The final description must be at most ${Math.floor(limit)} characters, including spaces. Treat this as a strict ceiling, not a target. Never truncate mid-sentence or mid-word. If a character limit is set, ignore the 80–180 word target and write fewer words if needed. Produce one cohesive paragraph without truncating mid-sentence.\n\n${trimmed}`
    : `Rewrite the following into a polished MLS listing description:\n\n${trimmed}`;

  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.4,
    ...(hasLimit ? { reasoning_effort: "low" } : {}),
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: userContent,
      },
    ],
  });
  logGroqUsage({
    tool: "listing-generator",
    response: completion,
    extra: { char_limit: hasLimit },
  });
  await recordUsage({
    userId: usageCtx.userId,
    tool: "listing-generator",
    response: completion,
  });

  const content = completion.choices?.[0]?.message?.content ?? "";
  let text = "";
  if (typeof content === "string") {
    text = content.trim();
  } else if (Array.isArray(content)) {
    text = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .join("")
      .trim();
  }

  if (!text) {
    throw new Error("Could not generate description — try again.");
  }
  return text;
}
