import OpenAI from "openai";

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey });
}

function realgptModel() {
  return (
    String(process.env.OPENAI_REALGPT_MODEL || "").trim() || "gpt-6.1-sol"
  );
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
 * RealGPT OpenAI chat. Same system + history messages as the Groq path.
 * Does not send Groq-specific parameters (including temperature).
 */
export async function completeRealGPTOpenAI(systemPrompt, messages) {
  const completion = await getClient().chat.completions.create({
    model: realgptModel(),
    messages: [{ role: "system", content: systemPrompt }, ...messages],
  });

  return messageContentToString(
    completion.choices?.[0]?.message?.content ?? ""
  ).trim();
}
