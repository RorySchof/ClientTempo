import { generateListingDescription as generateListingDescriptionGroq } from "./groq.js";
import { generateListingDescription as generateListingDescriptionOpenAI } from "./openai.js";

export function listingProvider(value) {
  return value === "groq" ? "groq" : "openai";
}

export async function generateListingDescription(
  rawDescription,
  charLimit,
  usageCtx = {},
  provider = "openai"
) {
  if (listingProvider(provider) === "openai") {
    return generateListingDescriptionOpenAI(rawDescription, charLimit);
  }
  return generateListingDescriptionGroq(rawDescription, charLimit, usageCtx);
}
