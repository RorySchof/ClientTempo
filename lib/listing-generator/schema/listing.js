/**
 * Listing schema for MLS description generation.
 *
 * {
 *   id: string,
 *   createdAt: number,
 *   address: string,
 *   title: string,
 *   rawDescription: string,
 *   generatedDescription: string,
 *   clientNames: string[],
 *   clientEmails: string[]
 * }
 */

/** Coerce API/Redis/model values to a plain string (never "[object Object]"). */
export function asListingText(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .join("")
      .trim();
  }
  if (typeof value === "object") {
    for (const key of [
      "generatedDescription",
      "description",
      "text",
      "content",
      "rawDescription",
      "address",
      "title",
    ]) {
      if (typeof value[key] === "string") return value[key];
    }
  }
  return "";
}

function toClientList(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
  }
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function createEmptyListing() {
  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    address: "",
    title: "",
    rawDescription: "",
    generatedDescription: "",
    clientNames: [],
    clientEmails: [],
  };
}

export function normalizeListing(input = {}) {
  const address = asListingText(input.address).trim();
  const rawDescription = asListingText(input.rawDescription);
  const generatedDescription = asListingText(input.generatedDescription);

  // Title is the address whenever address is present. Never derive from description.
  const title = address
    ? address
    : asListingText(input.title).trim();

  return {
    id: typeof input.id === "string" && input.id ? input.id : crypto.randomUUID(),
    createdAt:
      typeof input.createdAt === "number" && Number.isFinite(input.createdAt)
        ? input.createdAt
        : Date.now(),
    address,
    title,
    rawDescription,
    generatedDescription,
    clientNames: toClientList(input.clientNames),
    clientEmails: toClientList(input.clientEmails),
  };
}

export function validateListing(listing) {
  if (!listing || typeof listing !== "object") return false;
  if (typeof listing.id !== "string" || !listing.id) return false;
  if (typeof listing.createdAt !== "number" || !Number.isFinite(listing.createdAt))
    return false;
  if (typeof listing.address !== "string") return false;
  if (typeof listing.title !== "string") return false;
  if (typeof listing.rawDescription !== "string") return false;
  if (typeof listing.generatedDescription !== "string") return false;
  if (!Array.isArray(listing.clientNames)) return false;
  if (!Array.isArray(listing.clientEmails)) return false;
  return true;
}

/** List label: listing.title only (set from address on save). */
export function listingListLabel(listing) {
  const title = asListingText(listing?.title).trim();
  return title || "Untitled listing";
}
