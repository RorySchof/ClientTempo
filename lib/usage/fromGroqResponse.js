import { USAGE_RATES_VERSION, getModelRates } from "./modelRates.js";

function asCount(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

/**
 * Token/id fields from a Groq chat.completions payload. No content or PII.
 */
export function extractGroqUsage(response) {
  if (!response || typeof response !== "object") return null;
  const usage = response.usage;
  if (!usage || typeof usage !== "object") return null;

  const prompt_tokens = asCount(usage.prompt_tokens);
  const cached_tokens = asCount(usage.prompt_tokens_details?.cached_tokens);
  const completion_tokens = asCount(usage.completion_tokens);
  const reasoning_tokens = asCount(
    usage.completion_tokens_details?.reasoning_tokens
  );
  const total_tokens = asCount(usage.total_tokens);

  return {
    model: typeof response.model === "string" ? response.model : "",
    groq_id: typeof response.id === "string" ? response.id : "",
    groq_request_id:
      response.x_groq && typeof response.x_groq.id === "string"
        ? response.x_groq.id
        : "",
    prompt_tokens,
    cached_tokens,
    completion_tokens,
    reasoning_tokens,
    total_tokens,
    uncached_input_tokens: Math.max(prompt_tokens - cached_tokens, 0),
  };
}

/**
 * Integer micro-USD. Unknown models return null (fail closed).
 * Reasoning tokens are already inside completion_tokens and are not added.
 */
export function costMicrosForUsage(usage) {
  if (!usage || typeof usage !== "object") return null;
  const rates = getModelRates(usage.model);
  if (!rates) return null;

  const uncached = asCount(usage.uncached_input_tokens);
  const cached = asCount(usage.cached_tokens);
  const completion = asCount(usage.completion_tokens);
  const rawMicros =
    uncached * rates.uncachedInputMicrosPerMillion +
    cached * rates.cachedInputMicrosPerMillion +
    completion * rates.outputMicrosPerMillion;
  return Math.round(rawMicros / 1_000_000);
}

/**
 * Accounting event, or null if usage/model cannot be priced.
 */
export function fromGroqResponse(response, { userId, tool } = {}) {
  const extracted = extractGroqUsage(response);
  if (!extracted) return null;
  const cost_micros = costMicrosForUsage(extracted);
  if (cost_micros == null) return null;

  return {
    timestamp: new Date().toISOString(),
    userId: typeof userId === "string" ? userId : "",
    tool: typeof tool === "string" ? tool : "",
    model: extracted.model,
    groq_id: extracted.groq_id,
    groq_request_id: extracted.groq_request_id,
    prompt_tokens: extracted.prompt_tokens,
    cached_tokens: extracted.cached_tokens,
    completion_tokens: extracted.completion_tokens,
    reasoning_tokens: extracted.reasoning_tokens,
    total_tokens: extracted.total_tokens,
    uncached_input_tokens: extracted.uncached_input_tokens,
    cost_micros,
    rates_version: USAGE_RATES_VERSION,
  };
}
