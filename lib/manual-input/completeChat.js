import Groq from "groq-sdk";
import { logGroqUsage } from "../dev/logGroqUsage.js";
import { recordUsage } from "../usage/recordUsage.js";

function getGroq() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set");
  }
  return new Groq({ apiKey });
}

function messageContentToString(content) {
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
 * Call Groq with the Manual Input message list and extract the model JSON.
 */
export async function completeManualInputChat(messages, usageCtx = {}) {
  const normalizedMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const groq = getGroq();
  const promise = groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: normalizedMessages,
    temperature: 0.2,
  });

  const rawResponse = await promise.asResponse();
  const rawText = await rawResponse.clone().text();

  let rawJson;
  try {
    rawJson = JSON.parse(rawText);
  } catch (e) {
    console.error("GROQ RAW JSON PARSE ERROR:", e.message);
    throw new Error("Failed to parse raw Groq JSON");
  }

  logGroqUsage({ tool: "realtor-reply", response: rawJson });
  await recordUsage({
    userId: usageCtx.userId,
    tool: "realtor-reply",
    response: rawJson,
  });

  const choice = rawJson?.choices?.[0];
  const content = messageContentToString(choice?.message?.content ?? "");
  if (!content.trim()) {
    throw new Error("Reply generation returned no usable fields");
  }

  let parsed;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("Reply generation returned no usable fields");
    } else {
      const jsonString = jsonMatch[0];

      try {
        parsed = JSON.parse(jsonString);
      } catch {
        throw new Error("Reply generation returned unparseable JSON");
      }
    }
  } catch (err) {
    console.error("Reply JSON extraction error:", err?.message || err);
    throw err instanceof Error
      ? err
      : new Error("Reply generation returned unparseable JSON");
  }

  const completion = await promise;

  return { parsed, completion };
}
