import OpenAI from "openai";

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey });
}

function realtorReplyModel() {
  return (
    String(process.env.OPENAI_REALTOR_REPLY_MODEL || "").trim() || "gpt-6-luna"
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
 * Call OpenAI with the Manual Input message list and extract the model JSON.
 * Does not send Groq-specific parameters (including temperature).
 */
export async function completeManualInputChatOpenAI(messages) {
  const normalizedMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const completion = await getClient().chat.completions.create({
    model: realtorReplyModel(),
    messages: normalizedMessages,
  });

  const content = messageContentToString(
    completion.choices?.[0]?.message?.content ?? ""
  );
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

  return { parsed, completion };
}
