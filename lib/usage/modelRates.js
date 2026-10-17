/** Shadow usage ledger only. Not customer-facing credits or RT. */

export const USAGE_RATES_VERSION = "gpt-oss-120b:2026-09";

/** Integer micro-USD charged per 1,000,000 tokens. */
export const MODEL_RATES = {
  "openai/gpt-oss-120b": {
    uncachedInputMicrosPerMillion: 150_000, // $0.15 / 1M
    cachedInputMicrosPerMillion: 75_000, // $0.075 / 1M
    outputMicrosPerMillion: 600_000, // $0.60 / 1M
  },
};

export function getModelRates(model) {
  if (typeof model !== "string" || !model) return null;
  return MODEL_RATES[model] ?? null;
}
