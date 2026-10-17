/**
 * Showing Notes draft (in-progress tour). Not a finished ShowingNote.
 *
 * {
 *   showingSessionId: string,
 *   createdAt: string,
 *   updatedAt: string,
 *   client_names: string[],
 *   client_emails: string[],
 *   showings: [{ id, address, notes, savedAt }]
 * }
 */

function asString(value) {
  return typeof value === "string" ? value : "";
}

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string");
}

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `showing_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeDraftShowing(input = {}) {
  const id = typeof input.id === "string" && input.id ? input.id : newId();
  return {
    id,
    address: asString(input.address),
    notes: asString(input.notes),
    savedAt:
      typeof input.savedAt === "string" && input.savedAt
        ? input.savedAt
        : new Date().toISOString(),
  };
}

export function normalizeShowingDraft(input = {}) {
  const now = new Date().toISOString();
  const showings = Array.isArray(input.showings)
    ? input.showings.map(normalizeDraftShowing)
    : [];
  return {
    showingSessionId:
      typeof input.showingSessionId === "string" && input.showingSessionId
        ? input.showingSessionId
        : newId(),
    createdAt:
      typeof input.createdAt === "string" && input.createdAt
        ? input.createdAt
        : now,
    updatedAt:
      typeof input.updatedAt === "string" && input.updatedAt ? input.updatedAt : now,
    client_names: toStringArray(input.client_names),
    client_emails: toStringArray(input.client_emails),
    realtorNotes: asString(input.realtorNotes),
    showings,
  };
}

/** Update existing houses by id; append rows whose id is new. */
export function mergeShowingsById(existing, incoming) {
  const current = Array.isArray(existing)
    ? existing.map(normalizeDraftShowing)
    : [];
  const next = Array.isArray(incoming) ? incoming.map(normalizeDraftShowing) : [];
  const byId = new Map(current.map((showing) => [showing.id, showing]));
  const order = current.map((showing) => showing.id);

  for (const showing of next) {
    if (byId.has(showing.id)) {
      byId.set(showing.id, showing);
    } else {
      byId.set(showing.id, showing);
      order.push(showing.id);
    }
  }

  return order.map((id) => byId.get(id)).filter(Boolean);
}

export function mergeClientFields(existing, incoming) {
  const next = { ...existing };
  if (Array.isArray(incoming?.client_names)) {
    next.client_names = toStringArray(incoming.client_names);
  }
  if (Array.isArray(incoming?.client_emails)) {
    next.client_emails = toStringArray(incoming.client_emails);
  }
  if (typeof incoming?.realtorNotes === "string") {
    next.realtorNotes = incoming.realtorNotes;
  }
  return next;
}
