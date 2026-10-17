//store.js

import { auth } from "@clerk/nextjs/server";
import { Redis } from "@upstash/redis";
import {
  normalizeShowingNote,
  validateShowingNote,
} from "./schema/showingNotes.js";
import { normalizeShowingDraft } from "./schema/showingDraft.js";

const STORAGE_ERROR = "Storage is not configured.";
const DRAFT_TTL_SECONDS = 14 * 24 * 60 * 60;

function hasRedisConfig() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

function redis() {
  if (!hasRedisConfig()) {
    throw new Error(STORAGE_ERROR);
  }
  try {
    return Redis.fromEnv();
  } catch {
    throw new Error(STORAGE_ERROR);
  }
}

async function currentUserId() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}

async function storageKey(explicitUserId) {
  const userId = explicitUserId || (await currentUserId());
  return `showing-notes:${userId}`;
}

function draftDocumentKey(userId, sessionId) {
  return `showing-notes:${userId}:draft:${sessionId}`;
}

function draftCurrentKey(userId) {
  return `showing-notes:${userId}:draft:current`;
}

export async function listNotes() {
  const key = await storageKey();
  const notes = (await redis().get(key)) || [];
  const list = Array.isArray(notes) ? notes : [];
  return list
    .map(normalizeShowingNote)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function getNoteById(id) {
  const notes = await listNotes();
  return notes.find((n) => n.id === id) || null;
}

export async function saveNote(input, userId) {
  const note = normalizeShowingNote(input);
  if (!validateShowingNote(note)) throw new Error("Invalid showing note");

  const key = await storageKey(userId);
  const r = redis();
  const notes = (await r.get(key)) || [];
  const list = Array.isArray(notes) ? notes : [];
  const i = list.findIndex((n) => n.id === note.id);
  if (i >= 0) list[i] = note;
  else list.push(note);

  await r.set(key, list);
  return note;
}

export async function clearNotes() {
  const key = await storageKey();
  await redis().set(key, []);
}

export async function getDraft(sessionId) {
  const userId = await currentUserId();
  const r = redis();
  const id =
    (typeof sessionId === "string" && sessionId.trim()) ||
    (await r.get(draftCurrentKey(userId))) ||
    "";
  if (!id) return null;
  const draft = await r.get(draftDocumentKey(userId, id));
  if (!draft) return null;
  return normalizeShowingDraft(draft);
}

export async function saveDraft(draft) {
  const userId = await currentUserId();
  const r = redis();
  const currentId = await r.get(draftCurrentKey(userId));
  const existingSessionId =
    typeof currentId === "string" && currentId.trim() ? currentId.trim() : "";
  const incomingSessionId =
    typeof draft?.showingSessionId === "string" && draft.showingSessionId.trim()
      ? draft.showingSessionId.trim()
      : "";
  const showingSessionId = existingSessionId || incomingSessionId;

  const normalized = normalizeShowingDraft({
    ...draft,
    showingSessionId,
  });

  await r.set(
    draftDocumentKey(userId, normalized.showingSessionId),
    normalized,
    { ex: DRAFT_TTL_SECONDS }
  );
  await r.set(draftCurrentKey(userId), normalized.showingSessionId, {
    ex: DRAFT_TTL_SECONDS,
  });
  return normalized;
}

export async function deleteDraft(sessionId) {
  const userId = await currentUserId();
  const r = redis();
  const currentId = await r.get(draftCurrentKey(userId));
  const id =
    (typeof sessionId === "string" && sessionId.trim()) || currentId || "";
  if (id) {
    await r.del(draftDocumentKey(userId, id));
  }
  await r.del(draftCurrentKey(userId));
  return { ok: true };
}
