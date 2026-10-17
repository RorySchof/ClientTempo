//store.js

import { auth } from "@clerk/nextjs/server";
import { Redis } from "@upstash/redis";
import {
  normalizeListing,
  validateListing,
} from "./schema/listing.js";

const STORAGE_ERROR = "Storage is not configured.";

async function currentUserId() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}

async function storageKey() {
  const userId = await currentUserId();
  return `listings:${userId}`;
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

export async function getListings() {
  const listings = (await redis().get(await storageKey())) || [];

  return (Array.isArray(listings) ? listings : [])
    .map(normalizeListing)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function getListingById(id) {
  const listings = await getListings();
  return listings.find((l) => l.id === id) || null;
}

export async function saveListing(input) {
  const listing = normalizeListing(input);
  if (!validateListing(listing)) throw new Error("Invalid listing");

  const key = await storageKey();
  const r = redis();
  const listings = (await r.get(key)) || [];
  const list = Array.isArray(listings) ? listings : [];
  const i = list.findIndex((l) => l.id === listing.id);
  if (i >= 0) list[i] = listing;
  else list.push(listing);
  await r.set(key, list);
  return listing;
}
