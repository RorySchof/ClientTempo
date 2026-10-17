import { appendFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import {
  costMicrosForUsage,
  extractGroqUsage,
} from "../usage/fromGroqResponse.js";

function enabled() {
  return process.env.GROQ_USAGE_LOG === "1" && !process.env.VERCEL;
}

/**
 * Temporary local Groq usage measurement. Do not persist content or PII.
 * Cost uses the shared shadow-ledger formula (integer micro-USD / 1e6).
 */
export function logGroqUsage({ tool, response, extra } = {}) {
  if (!enabled()) return;

  const extracted = extractGroqUsage(response);
  if (!extracted) return;

  const cost_micros = costMicrosForUsage(extracted);
  const record = {
    at: new Date().toISOString(),
    tool: typeof tool === "string" ? tool : "",
    model: extracted.model,
    groq_id: extracted.groq_id,
    groq_request_id: extracted.groq_request_id || null,
    prompt_tokens: extracted.prompt_tokens,
    cached_tokens: extracted.cached_tokens,
    completion_tokens: extracted.completion_tokens,
    reasoning_tokens: extracted.reasoning_tokens,
    total_tokens: extracted.total_tokens,
    uncached_input_tokens: extracted.uncached_input_tokens,
  };
  if (cost_micros != null) {
    record.cost_usd = cost_micros / 1e6;
  }

  if (extra && typeof extra === "object") {
    if (typeof extra.char_limit === "boolean") {
      record.char_limit = extra.char_limit;
    }
    if (typeof extra.label === "string" && extra.label) {
      record.label = extra.label;
    }
    if (extra.turn != null && Number.isFinite(Number(extra.turn))) {
      record.turn = Math.floor(Number(extra.turn));
    }
  }

  const filePath = join(process.cwd(), "tmp", "groq-usage.jsonl");
  mkdirSync(dirname(filePath), { recursive: true });
  appendFileSync(filePath, `${JSON.stringify(record)}\n`, "utf8");
}
