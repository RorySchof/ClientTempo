import { loadPrompt } from "../prompts/loadPrompt.js";

export function loadSystemPrompt() {
  return loadPrompt("realgpt.txt");
}
