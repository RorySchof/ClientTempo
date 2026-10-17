import fs from "node:fs";
import path from "node:path";

const LOCAL_DIR = path.join(process.cwd(), "prompts", "local");
const EXAMPLE_DIR = path.join(process.cwd(), "prompts", "examples");

export function loadPrompt(filename) {
  const localPath = path.join(LOCAL_DIR, filename);
  if (fs.existsSync(localPath)) {
    return fs.readFileSync(localPath, "utf8");
  }

  const examplePath = path.join(EXAMPLE_DIR, filename);
  if (fs.existsSync(examplePath)) {
    return fs.readFileSync(examplePath, "utf8");
  }

  throw new Error(
    `Missing prompt prompts/local/${filename}. Copy prompts/examples/${filename} and replace the placeholder.`
  );
}
