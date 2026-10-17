//store.js

import { auth } from "@clerk/nextjs/server";
import { Redis } from "@upstash/redis";
import {
  normalizeOpenHouseNote,
  validateOpenHouseNote,
} from "./schema/showingNotes.js";

const STORAGE_ERROR = "Storage is not configured.";

async function currentUserId() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}

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

async function storageKey(explicitUserId) {
  const userId = explicitUserId || (await currentUserId());
  return `open-house-notes:${userId}`;
}

async function readAll(userId) {
  const notes = (await redis().get(await storageKey(userId))) || [];
  return Array.isArray(notes) ? notes : [];
}

async function writeAll(notes, userId) {
  await redis().set(await storageKey(userId), notes);
}

export async function listNotes() {
  const notes = await readAll();
  return notes
    .map(normalizeOpenHouseNote)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function getNoteById(id) {
  const notes = await listNotes();
  return notes.find((n) => n.id === id) || null;
}

export async function saveNote(input, userId) {
  const note = normalizeOpenHouseNote(input);
  if (!validateOpenHouseNote(note)) throw new Error("Invalid open house note");

  const notes = [...(await readAll(userId))];
  const i = notes.findIndex((n) => n.id === note.id);
  if (i >= 0) notes[i] = note;
  else notes.push(note);

  await writeAll(notes, userId);
  return note;
}

export async function clearNotes() {
  await writeAll([]);
}
