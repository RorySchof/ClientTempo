/**
 * Showing Notes JSON schema
 *
 * Stored note = metadata (id, createdAt) + optional client contact fields
 * + model fields below:
 * {
 *   id: string,
 *   createdAt: string,
 *   client_names: string[],
 *   client_emails: string[],
 *   raw_notes: string,
 *   client_summary: string,
 *   email_subject_client: string,
 *   client_sentiment: string,
 *   property_highlights: string[],
 *   property_concerns: string[],
 *   property_comparison: string,
 *   realtor_action_items: string[],
 *   follow_ups: string[],
 *   coaching_insights: string,
 *   realtor_reply: string,
 *   email_subject_realtor: string,
 *   client_snapshot: {
 *     title: string,
 *     stats: [{ label: string, value: string }],
 *     sections: [{ heading: string, body: string }]
 *   }
 * }
 */

export const SHOWING_NOTES_FIELDS = [
  "id",
  "createdAt",
  "client_names",
  "client_emails",
  "raw_notes",
  "client_summary",
  "email_subject_client",
  "client_sentiment",
  "property_highlights",
  "property_concerns",
  "property_comparison",
  "realtor_action_items",
  "follow_ups",
  "coaching_insights",
  "realtor_reply",
  "email_subject_realtor",
  "client_snapshot",
];

export function createEmptyNote(overrides = {}) {
  return normalizeShowingNote({
    id: cryptoRandomId(),
    createdAt: new Date().toISOString(),
    client_names: [],
    client_emails: [],
    raw_notes: "",
    client_summary: "",
    email_subject_client: "",
    client_sentiment: "",
    property_highlights: [],
    property_concerns: [],
    property_comparison: "",
    realtor_action_items: [],
    follow_ups: [],
    coaching_insights: "",
    realtor_reply: "",
    email_subject_realtor: "",
    client_snapshot: emptyClientSnapshot(),
    ...overrides,
  });
}

export function normalizeShowingNote(input = {}) {
  return {
    id: typeof input.id === "string" && input.id ? input.id : cryptoRandomId(),
    createdAt:
      typeof input.createdAt === "string" && input.createdAt
        ? input.createdAt
        : new Date().toISOString(),
    client_names: toStringArray(input.client_names),
    client_emails: toStringArray(input.client_emails),
    raw_notes: asString(input.raw_notes),
    client_summary: asString(input.client_summary),
    email_subject_client: asString(input.email_subject_client),
    client_sentiment: asString(input.client_sentiment),
    property_highlights: toStringArray(input.property_highlights),
    property_concerns: toStringArray(input.property_concerns),
    property_comparison: asString(input.property_comparison),
    realtor_action_items: toStringArray(input.realtor_action_items),
    follow_ups: toStringArray(input.follow_ups),
    coaching_insights: asString(input.coaching_insights),
    realtor_reply: asString(input.realtor_reply),
    email_subject_realtor: asString(input.email_subject_realtor),
    client_snapshot: normalizeClientSnapshot(input.client_snapshot),
  };
}

export function validateShowingNote(note) {
  if (!note || typeof note !== "object") return false;
  if (typeof note.id !== "string" || !note.id) return false;
  if (typeof note.createdAt !== "string") return false;
  if (!Array.isArray(note.client_names)) return false;
  if (!Array.isArray(note.client_emails)) return false;
  if (typeof note.raw_notes !== "string") return false;
  if (typeof note.client_summary !== "string") return false;
  if (typeof note.email_subject_client !== "string") return false;
  if (typeof note.client_sentiment !== "string") return false;
  if (!Array.isArray(note.property_highlights)) return false;
  if (!Array.isArray(note.property_concerns)) return false;
  if (typeof note.property_comparison !== "string") return false;
  if (!Array.isArray(note.realtor_action_items)) return false;
  if (!Array.isArray(note.follow_ups)) return false;
  if (typeof note.coaching_insights !== "string") return false;
  if (typeof note.realtor_reply !== "string") return false;
  if (typeof note.email_subject_realtor !== "string") return false;
  if (!isClientSnapshot(note.client_snapshot)) return false;
  return true;
}

/** Short label for list UI (no address field in schema). */
export function noteListLabel(note) {
  if (!note) return "Untitled showing";
  if (note.email_subject_realtor?.trim()) return note.email_subject_realtor.trim();
  if (note.email_subject_client?.trim()) return note.email_subject_client.trim();
  const firstHighlight = note.property_highlights?.[0];
  if (typeof firstHighlight === "string" && firstHighlight.trim()) {
    return firstHighlight.trim().slice(0, 80);
  }
  if (note.client_summary?.trim()) return note.client_summary.trim().slice(0, 80);
  return "Untitled showing";
}

export function emptyClientSnapshot() {
  return {
    title: "Showing Snapshot",
    stats: [],
    sections: [],
  };
}

export function clientSnapshotHasContent(snapshot) {
  return Boolean(snapshot?.stats?.length || snapshot?.sections?.length);
}

function propertyNameFromBullet(item) {
  if (typeof item !== "string" || !item.trim()) return null;
  for (const sep of [" — ", " – ", " - "]) {
    const idx = item.indexOf(sep);
    if (idx > 0) return item.slice(0, idx).trim();
  }
  return null;
}

/** Deduped property names from highlights / concerns (the Properties Previewed list). */
export function collectPropertiesPreviewed(note) {
  const seen = new Set();
  const names = [];
  const sources = [
    ...(Array.isArray(note?.property_highlights) ? note.property_highlights : []),
    ...(Array.isArray(note?.property_concerns) ? note.property_concerns : []),
  ];
  for (const item of sources) {
    const name = propertyNameFromBullet(item);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

function detailsForProperty(items, address) {
  const key = String(address || "").toLowerCase();
  const details = [];
  for (const item of items || []) {
    const text = typeof item === "string" ? item.trim() : "";
    if (!text) continue;
    const name = propertyNameFromBullet(text);
    if (!name || name.toLowerCase() !== key) continue;
    const detail = text.slice(name.length).replace(/^\s*[—–-]\s*/, "").trim();
    if (detail) details.push(detail);
  }
  return [...new Set(details)];
}

/** Address plus 1–2 highlights/concerns for the Properties viewed list. */
function formatPropertiesViewed(note) {
  const highlights = Array.isArray(note?.property_highlights)
    ? note.property_highlights
    : [];
  const concerns = Array.isArray(note?.property_concerns)
    ? note.property_concerns
    : [];
  return collectPropertiesPreviewed(note)
    .map((address) => {
      const highs = detailsForProperty(highlights, address).slice(0, 2);
      const lows = detailsForProperty(concerns, address).slice(0, 2);
      const parts = [];
      if (highs.length) parts.push(highs.join(", "));
      if (lows.length) parts.push(lows.join(", "));
      return parts.length ? `**${address}** – ${parts.join(", ")}` : `**${address}**`;
    })
    .join("\n");
}

/** Group property bullets into a short summary line (not a full list). */
function groupedSummaryLine(items) {
  const groups = new Map();
  for (const item of items) {
    const text = typeof item === "string" ? item.trim() : "";
    if (!text) continue;
    const name = propertyNameFromBullet(text);
    if (!name) {
      if (!groups.has("")) groups.set("", []);
      groups.get("").push(text);
      continue;
    }
    const detail = text.slice(name.length).replace(/^\s*[—–-]\s*/, "").trim() || text;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(detail);
  }

  const parts = [];
  for (const [name, details] of groups) {
    const unique = [...new Set(details)].slice(0, 2);
    parts.push(name ? `${name} — ${unique.join("; ")}` : unique.join("; "));
    if (parts.length >= 3) break;
  }
  return parts.join(". ");
}

function findSection(sections, headings) {
  const keys = headings.map((h) => h.toLowerCase());
  return (sections || []).find((s) => keys.includes(String(s.heading || "").toLowerCase()));
}

export const CANONICAL_CLIENT_SIGNOFF = "Warmly,";

export function buildFallbackClientSnapshot(note) {
  const highlights = Array.isArray(note?.property_highlights)
    ? note.property_highlights.filter((item) => typeof item === "string" && item.trim())
    : [];
  const concerns = Array.isArray(note?.property_concerns)
    ? note.property_concerns.filter((item) => typeof item === "string" && item.trim())
    : [];

  return {
    title: "Showing Snapshot",
    stats: [
      {
        label: "Properties viewed",
        value: formatPropertiesViewed(note),
      },
    ],
    sections: [
      { heading: "Top highlights", body: groupedSummaryLine(highlights) },
      { heading: "Key concerns", body: groupedSummaryLine(concerns) },
      { heading: "Decision factors", body: asString(note?.property_comparison).trim() },
      { heading: "Overall", body: "" },
    ],
  };
}

function propertiesViewedStatValue(fromModel, note) {
  const row = (fromModel?.stats || []).find((item) =>
    /^properties viewed$/i.test(String(item.label || ""))
  );
  const modelValue = String(row?.value || "").trim();
  if (modelValue) {
    return modelValue.replace(/<b>([\s\S]*?)<\/b>/gi, "**$1**");
  }
  return formatPropertiesViewed(note);
}

export function resolveClientSnapshot(note) {
  const fromModel = normalizeClientSnapshot(note?.client_snapshot);
  const fallback = buildFallbackClientSnapshot(note);
  const source = clientSnapshotHasContent(fromModel) ? fromModel : fallback;
  const propertiesViewed = propertiesViewedStatValue(fromModel, note);

  const highlights =
    findSection(source.sections, ["top highlights", "what stood out", "highlights"]) ||
    fallback.sections[0];
  const concerns =
    findSection(source.sections, ["key concerns", "worth thinking about", "concerns"]) ||
    fallback.sections[1];
  const decision =
    findSection(source.sections, ["decision factors", "how they compare", "comparison"]) ||
    fallback.sections[2];
  const overall =
    findSection(source.sections, ["overall"]) || fallback.sections[3];

  return {
    title: "Showing Snapshot",
    stats: [
      {
        label: "Properties viewed",
        value: propertiesViewed,
      },
    ],
    sections: [
      { heading: "Top highlights", body: highlights?.body || "" },
      { heading: "Key concerns", body: concerns?.body || "" },
      { heading: "Decision factors", body: decision?.body || "" },
      { heading: "Overall", body: overall?.body || "" },
    ],
  };
}

export function formatClientSnapshotPlaintext(snapshot) {
  const lines = [];
  lines.push("────────────────────────");
  lines.push(snapshot?.title || "Showing Snapshot");
  lines.push("────────────────────────");
  for (const row of snapshot?.stats || []) {
    lines.push(`${row.label}:`);
    lines.push(String(row.value || "").replace(/\*\*([^*]+)\*\*/g, "$1"));
  }
  if (snapshot?.stats?.length && snapshot?.sections?.length) {
    lines.push("");
  }
  for (const section of snapshot?.sections || []) {
    lines.push(`${section.heading}: ${section.body || ""}`.trim());
  }
  lines.push("────────────────────────");
  return lines.join("\n").trim();
}

export function stripStructuredRecapLabels(text) {
  return String(text || "")
    .replace(/\*\*[^*]+\*\*:?\s*/g, "")
    .replace(
      /(?:^|\n)\s*(What stood out|A few things to think about|Where that leaves you|Worth thinking about|What they liked|Highlights|Concerns|Property Highlights|Property Concerns|Property Comparison)\s*[:.—-]*\s*/gi,
      "\n"
    )
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toSingleNarrativeParagraph(text) {
  return stripStructuredRecapLabels(text)
    .replace(/^\s*[-*•–—]\s+/gm, "")
    .replace(/\n+/g, " ")
    .replace(/\s+[-*•]\s+/g, "; ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Keep greeting + intro; collapse any labeled/bulleted recap into one paragraph. */
export function formatWarmClientLead(before) {
  const cleaned = stripStructuredRecapLabels(before);
  const parts = cleaned.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return "";

  const isGreeting = (p) => /^(hi|hello|dear)\b/i.test(p);
  if (!isGreeting(parts[0])) {
    return toSingleNarrativeParagraph(cleaned);
  }

  const greeting = parts[0];
  if (parts.length === 1) return greeting;
  if (parts.length === 2) {
    return [greeting, toSingleNarrativeParagraph(parts[1])].join("\n\n");
  }

  const intro = parts[1];
  const recap = toSingleNarrativeParagraph(parts.slice(2).join(" "));
  return [greeting, intro, recap].filter(Boolean).join("\n\n");
}

export function stripTrailingSignoff(text) {
  return String(text || "")
    .replace(/\n\s*\nTalk soon,[\s\S]*$/i, "")
    .replace(/^Talk soon,[\s\S]*$/i, "")
    .replace(
      /\n\s*\n(?:best regards|best,|warmly|sincerely|regards,|all the best)[\s\S]*$/i,
      ""
    )
    .replace(/\n\s*\n\[Your Name\][\s\S]*$/i, "")
    .replace(/\n\s*\n\[Your Brokerage\]\s*$/i, "")
    .trim();
}

export function splitClientSummary(email) {
  const text = typeof email === "string" ? email.trim() : "";
  if (!text) return { before: "", after: "" };

  const parts = text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return { before: "", after: "" };

  const isGreeting = /^(hi|hello|dear)\b/i.test(parts[0]);
  // Keep greeting + intro + recap in `before`.
  const minBefore = isGreeting ? 3 : 2;

  const isSignoff = (p) =>
    /^(talk soon|best regards|best,|warmly|sincerely|regards,|all the best)\b/i.test(p) ||
    /^\[Your Name\]/i.test(p) ||
    /^\[Your Brokerage\]/i.test(p);
  const isClosing = (p) =>
    /^(thanks|thank you|i['’]ll be in touch|i will be in touch|if you want|let me know|happy to|i['’]ll send|i will send)\b/i.test(
      p
    );

  let cut = -1;
  for (let i = parts.length - 1; i >= minBefore; i--) {
    if (isSignoff(parts[i])) {
      cut = i;
      break;
    }
  }
  if (cut > minBefore && isClosing(parts[cut - 1])) {
    cut -= 1;
  }
  if (cut < minBefore) {
    for (let i = parts.length - 1; i >= minBefore; i--) {
      if (isClosing(parts[i]) || isSignoff(parts[i])) {
        cut = i;
        break;
      }
    }
  }

  if (cut < minBefore) {
    const talkSoonBlock = text.match(/\n\s*\nTalk soon,[\s\S]*$/i);
    if (talkSoonBlock && talkSoonBlock.index > 0) {
      return {
        before: formatWarmClientLead(text.slice(0, talkSoonBlock.index).trim()),
        after: text.slice(talkSoonBlock.index).trim(),
      };
    }
    return { before: formatWarmClientLead(text), after: "" };
  }

  return {
    before: formatWarmClientLead(parts.slice(0, cut).join("\n\n").trim()),
    after: parts.slice(cut).join("\n\n").trim(),
  };
}

export const CLIENT_SNAPSHOT_BRIDGE =
  "Here's a quick breakdown of what stood out at each property and how they compare:";

function firstName(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0];
}

function clientGreeting(note) {
  const names = toStringArray(note?.client_names)
    .map(firstName)
    .filter(Boolean);
  if (!names.length) return "Hi there,";
  if (names.length === 1) return `Hi ${names[0]},`;
  if (names.length === 2) return `Hi ${names[0]} and ${names[1]},`;
  return `Hi ${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]},`;
}

function withClientGreeting(before, greeting) {
  const text = String(before || "").trim();
  if (!text) return greeting;
  if (/^(hi|hello|dear)\b/i.test(text)) {
    const parts = text.split(/\n\s*\n/);
    parts[0] = greeting;
    return parts.filter(Boolean).join("\n\n");
  }
  return `${greeting}\n\n${text}`;
}

export function formatClientEmailLead(note) {
  const { before, after } = splitClientSummary(note?.client_summary || "");
  return {
    lead: withClientGreeting(before, clientGreeting(note)),
    bridge: CLIENT_SNAPSHOT_BRIDGE,
    closing: stripTrailingSignoff(after),
  };
}

export function composeClientEmailBody(note) {
  const snapshot = resolveClientSnapshot(note);
  const snapshotText = formatClientSnapshotPlaintext(snapshot);
  const { lead, bridge, closing } = formatClientEmailLead(note);
  return [lead, bridge, snapshotText, closing, CANONICAL_CLIENT_SIGNOFF]
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function normalizeClientSnapshot(input) {
  const src = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const stats = Array.isArray(src.stats)
    ? src.stats
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          label: asString(item.label).trim(),
          value: asString(item.value).trim(),
        }))
        .filter((row) => row.label && row.value)
    : [];
  const sections = Array.isArray(src.sections)
    ? src.sections
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          heading: asString(item.heading).trim(),
          body: asString(item.body).trim(),
        }))
        .filter((row) => row.heading && row.body)
    : [];
  return {
    title: asString(src.title).trim() || "Showing Snapshot",
    stats,
    sections,
  };
}

function isClientSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (typeof value.title !== "string") return false;
  if (!Array.isArray(value.stats)) return false;
  if (!Array.isArray(value.sections)) return false;
  const statsOk = value.stats.every(
    (row) =>
      row &&
      typeof row === "object" &&
      typeof row.label === "string" &&
      typeof row.value === "string"
  );
  const sectionsOk = value.sections.every(
    (row) =>
      row &&
      typeof row === "object" &&
      typeof row.heading === "string" &&
      typeof row.body === "string"
  );
  return statsOk && sectionsOk;
}

function asString(value) {
  return typeof value === "string" ? value : "";
}

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string");
}

function cryptoRandomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `note_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
