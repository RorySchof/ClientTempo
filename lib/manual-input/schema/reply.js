/**
 * Realtor Reply saved record.
 *
 * {
 *   id: string,
 *   createdAt: number,
 *   client_names: string[],
 *   client_emails: string[],
 *   email_subject: string,
 *   source_text: string,
 *   agent: object
 * }
 */

function toStringArray(value) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === "string" && item.trim())
      .map((item) => item.trim());
  }
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function asText(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function isUsableAgent(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return false;
  }
  if (Object.keys(parsed).length === 0) return false;
  const reply =
    (typeof parsed.reply === "string" && parsed.reply.trim()) ||
    (typeof parsed.draft_reply === "string" && parsed.draft_reply.trim());
  if (!reply) return false;
  if (!parsed.client_snapshot || typeof parsed.client_snapshot !== "object") {
    return false;
  }
  return true;
}

export function createEmptyReply() {
  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    client_names: [],
    client_emails: [],
    email_subject: "",
    source_text: "",
    agent: {},
  };
}

export function normalizeReply(input = {}) {
  const agent =
    input.agent && typeof input.agent === "object" && !Array.isArray(input.agent)
      ? input.agent
      : {};

  return {
    id: typeof input.id === "string" && input.id ? input.id : crypto.randomUUID(),
    createdAt:
      typeof input.createdAt === "number" && Number.isFinite(input.createdAt)
        ? input.createdAt
        : Date.now(),
    client_names: toStringArray(input.client_names ?? input.clientNames),
    client_emails: toStringArray(input.client_emails ?? input.clientEmails),
    email_subject: asText(input.email_subject ?? input.emailSubject).trim(),
    source_text: asText(input.source_text ?? input.text),
    agent,
  };
}

export function validateReply(note) {
  if (!note || typeof note !== "object") return false;
  if (typeof note.id !== "string" || !note.id) return false;
  if (typeof note.createdAt !== "number" || !Number.isFinite(note.createdAt))
    return false;
  if (!Array.isArray(note.client_names)) return false;
  if (!Array.isArray(note.client_emails)) return false;
  if (typeof note.email_subject !== "string") return false;
  if (typeof note.source_text !== "string" || !note.source_text.trim()) return false;
  return isUsableAgent(note.agent);
}
