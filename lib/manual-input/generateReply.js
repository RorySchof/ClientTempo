// server/reply.js

import { loadPrompt } from "@/lib/prompts/loadPrompt.js";
import { completeManualInputChat } from "@/lib/manual-input/completeChat.js";
import { completeManualInputChatOpenAI } from "@/lib/manual-input/completeChatOpenAI.js";
import { isUsableAgent } from "@/lib/manual-input/schema/reply.js";

export function realtorReplyProvider(value) {
  return value === "groq" ? "groq" : "openai";
}

/**
 * Same reply-generation pipeline as the Mailgun inbound workflow:
 * preprocess → Groq PASS 2 → draft_reply / reply
 */
export async function generateReply(text, usageCtx = {}, provider = "groq") {
  const cleanMessage = extractForwardedMessage(text);

  // PASS 1 DISABLED — send raw email directly to PASS 2 (identical to inbound-email)
  const preprocessed = { raw_email: cleanMessage };

  const pass2Messages = [
    { role: "system", content: loadPrompt("client-reply.txt") },
    { role: "user", content: JSON.stringify(preprocessed) },
  ];

  const pass2Completion =
    realtorReplyProvider(provider) === "openai"
      ? await completeManualInputChatOpenAI(pass2Messages)
      : await completeManualInputChat(pass2Messages, usageCtx);
  const parsed = pass2Completion.parsed;
  if (!isUsableAgent(parsed)) {
    throw new Error("Reply generation returned no usable fields");
  }
  return parsed;
}

function extractForwardedMessage(body) {
  if (!body || typeof body !== "string") {
    return "";
  }

  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const separatorPattern = /^-{2,}\s*Forwarded message\s*-{2,}\s*$/i;
  const forwardedMarkerPattern = /forwarded message/i;
  const headerLinePattern = /^(From|Date|Subject|To):\s*/i;

  const separatorIndex = lines.findIndex(
    (line) =>
      separatorPattern.test(line.trim()) ||
      forwardedMarkerPattern.test(line.trim())
  );

  if (separatorIndex === -1) {
    return body.trim();
  }

  let index = separatorIndex + 1;

  while (index < lines.length && headerLinePattern.test(lines[index].trim())) {
    index++;
  }

  const blankIndex = lines.findIndex(
    (line, i) => i >= index && line.trim() === ""
  );
  if (blankIndex === -1) {
    return lines.slice(index).join("\n").trim();
  }

  return lines.slice(blankIndex + 1).join("\n").trim();
}
