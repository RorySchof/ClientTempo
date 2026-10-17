import { loadSystemPrompt } from "@/lib/realgpt/systemPrompt";
import { completeRealGPTOpenAI } from "@/lib/realgpt/completeOpenAI.js";
import { consumeCredits, refundCredits } from "@/lib/credits";
import { logGroqUsage } from "@/lib/dev/logGroqUsage.js";
import { recordUsage } from "@/lib/usage/recordUsage.js";
import {
  OUT_OF_TOKENS,
  requireAuthWithTokens,
} from "@/lib/requireAuthWithTokens";

export const runtime = "nodejs";
export const maxDuration = 180;

function messageContentToString(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (
          part &&
          typeof part === "object" &&
          typeof (part as { text?: unknown }).text === "string"
        ) {
          return (part as { text: string }).text;
        }
        return "";
      })
      .join("");
  }
  return "";
}

export async function POST(request: Request) {
  const authz = await requireAuthWithTokens();
  if (authz instanceof Response) return authz;

  let spent: Awaited<ReturnType<typeof consumeCredits>> = false;
  try {
    const { messages, provider } = await request.json();
    const useGroq = provider === "groq";

    if (useGroq && !process.env.GROQ_API_KEY) {
      return Response.json(
        { error: "GROQ_API_KEY is not set" },
        { status: 500 }
      );
    }

    if (!Array.isArray(messages)) {
      return Response.json(
        { error: "Expected { messages: [...] }" },
        { status: 400 }
      );
    }

    const systemPrompt = loadSystemPrompt();

    spent = await consumeCredits(authz.userId, 1);
    if (!spent) {
      return Response.json({ error: OUT_OF_TOKENS }, { status: 402 });
    }

    if (!useGroq) {
      const reply = await completeRealGPTOpenAI(systemPrompt, messages);
      if (!reply) {
        await refundCredits(authz.userId, spent.source);
        return Response.json(
          { error: "The model returned an empty reply" },
          { status: 502 }
        );
      }
      return Response.json({ reply });
    }

    const model = process.env.MODEL_NAME ?? "openai/gpt-oss-120b";

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
        }),
      }
    );

    const groqData = await groqResponse.json();

    if (!groqResponse.ok) {
      await refundCredits(authz.userId, spent.source);
      return Response.json(
        { error: groqData.error?.message ?? "Groq request failed" },
        { status: groqResponse.status }
      );
    }

    logGroqUsage({ tool: "realgpt", response: groqData });
    await recordUsage({
      userId: authz.userId,
      tool: "realgpt",
      response: groqData,
    });

    const reply = messageContentToString(
      groqData.choices?.[0]?.message?.content ?? ""
    ).trim();
    if (!reply) {
      await refundCredits(authz.userId, spent.source);
      return Response.json(
        { error: "The model returned an empty reply" },
        { status: 502 }
      );
    }
    return Response.json({ reply });
  } catch {
    if (spent) {
      await refundCredits(authz.userId, spent.source);
    }
    return Response.json({ error: "Failed to process request" }, { status: 500 });
  }
}
