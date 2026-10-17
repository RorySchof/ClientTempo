/**
 * Open House Notes JSON schema
 *
 * Answers: “What did buyers think of your home today, and what should we do next?”
 *
 * Stored note = metadata (id, createdAt, seller contact, listed address)
 * + model fields:
 * {
 *   id: string,
 *   createdAt: string,
 *   seller_names: string[],
 *   seller_emails: string[],
 *   property_address: string,
 *   raw_notes: string,
 *   host_summary: string,
 *   email_subject_seller: string,
 *   interest_level_summary: string,
 *   visitor_headcount: {
 *     total_visitors: number,
 *     serious_buyers: number,
 *     casual_neighbors: number,
 *     agent_accompanied_buyers: number
 *   },
 *   interest_level: {
 *     lingered: number,
 *     asked_detailed_questions: number,
 *     requested_follow_up: number,
 *     asked_about_offer_timing: number
 *   },
 *   property_strengths: string[],
 *   property_concerns: string[],
 *   visitor_feedback: [{
 *     visitor_type: string,
 *     likes: string[],
 *     concerns: string[],
 *     questions: string[],
 *     interest_level: string
 *   }],
 *   host_action_items: string[],
 *   coaching_insights: string,
 *   seller_report_email: string,
 *   seller_snapshot: {
 *     title: string,
 *     stats: [{ label: string, value: string }],
 *     sections: [{ heading: string, body: string }]
 *   },
 *   email_subject_agent: string
 * }
 */

export const HEADCOUNT_FIELDS = [
  "total_visitors",
  "serious_buyers",
  "casual_neighbors",
  "agent_accompanied_buyers",
];

export const INTEREST_LEVEL_FIELDS = [
  "lingered",
  "asked_detailed_questions",
  "requested_follow_up",
  "asked_about_offer_timing",
];

export const OPEN_HOUSE_NOTES_FIELDS = [
  "id",
  "createdAt",
  "seller_names",
  "seller_emails",
  "property_address",
  "raw_notes",
  "host_summary",
  "email_subject_seller",
  "interest_level_summary",
  "visitor_headcount",
  "interest_level",
  "property_strengths",
  "property_concerns",
  "visitor_feedback",
  "host_action_items",
  "coaching_insights",
  "seller_report_email",
  "seller_snapshot",
  "email_subject_agent",
];

export const SHOWING_NOTES_FIELDS = OPEN_HOUSE_NOTES_FIELDS;

export function createEmptyNote(overrides = {}) {
  return normalizeOpenHouseNote({
    id: cryptoRandomId(),
    createdAt: new Date().toISOString(),
    seller_names: [],
    seller_emails: [],
    property_address: "",
    raw_notes: "",
    host_summary: "",
    email_subject_seller: "",
    interest_level_summary: "",
    visitor_headcount: emptyHeadcount(),
    interest_level: emptyInterestLevel(),
    property_strengths: [],
    property_concerns: [],
    visitor_feedback: [],
    host_action_items: [],
    coaching_insights: "",
    seller_report_email: "",
    seller_snapshot: emptySellerSnapshot(),
    email_subject_agent: "",
    ...overrides,
  });
}

export function normalizeOpenHouseNote(input = {}) {
  return {
    id: typeof input.id === "string" && input.id ? input.id : cryptoRandomId(),
    createdAt:
      typeof input.createdAt === "string" && input.createdAt
        ? input.createdAt
        : new Date().toISOString(),
    seller_names: toStringArray(input.seller_names ?? input.client_names),
    seller_emails: toStringArray(input.seller_emails ?? input.client_emails),
    property_address: asString(input.property_address),
    raw_notes: asString(input.raw_notes),
    host_summary: asString(input.host_summary || input.client_summary),
    email_subject_seller: asString(
      input.email_subject_seller || input.email_subject_client
    ),
    interest_level_summary: asString(
      input.interest_level_summary || input.client_sentiment
    ),
    visitor_headcount: normalizeHeadcount(input.visitor_headcount),
    interest_level: normalizeInterestLevel(input.interest_level),
    property_strengths: toStringArray(
      input.property_strengths ?? input.property_highlights
    ),
    property_concerns: toStringArray(input.property_concerns),
    visitor_feedback: normalizeVisitorFeedback(input.visitor_feedback),
    host_action_items: toStringArray(
      input.host_action_items ?? input.realtor_action_items
    ),
    coaching_insights: asString(input.coaching_insights),
    seller_report_email: asString(
      input.seller_report_email || input.realtor_reply
    ),
    seller_snapshot: normalizeSellerSnapshot(input.seller_snapshot),
    email_subject_agent: asString(
      input.email_subject_agent || input.email_subject_realtor
    ),
  };
}

export const normalizeShowingNote = normalizeOpenHouseNote;

export function validateOpenHouseNote(note) {
  if (!note || typeof note !== "object") return false;
  if (typeof note.id !== "string" || !note.id) return false;
  if (typeof note.createdAt !== "string") return false;
  if (!Array.isArray(note.seller_names)) return false;
  if (!Array.isArray(note.seller_emails)) return false;
  if (typeof note.property_address !== "string") return false;
  if (typeof note.raw_notes !== "string") return false;
  if (typeof note.host_summary !== "string") return false;
  if (typeof note.email_subject_seller !== "string") return false;
  if (typeof note.interest_level_summary !== "string") return false;
  if (!isCountMap(note.visitor_headcount, HEADCOUNT_FIELDS)) return false;
  if (!isCountMap(note.interest_level, INTEREST_LEVEL_FIELDS)) return false;
  if (!Array.isArray(note.property_strengths)) return false;
  if (!Array.isArray(note.property_concerns)) return false;
  if (!Array.isArray(note.visitor_feedback)) return false;
  if (!Array.isArray(note.host_action_items)) return false;
  if (typeof note.coaching_insights !== "string") return false;
  if (typeof note.seller_report_email !== "string") return false;
  if (!isSellerSnapshot(note.seller_snapshot)) return false;
  if (typeof note.email_subject_agent !== "string") return false;
  return true;
}

export const validateShowingNote = validateOpenHouseNote;

/** Short label for list UI. */
export function noteListLabel(note) {
  if (!note) return "Untitled open house";
  if (note.property_address?.trim()) return note.property_address.trim();
  if (note.email_subject_seller?.trim()) return note.email_subject_seller.trim();
  if (note.email_subject_agent?.trim()) return note.email_subject_agent.trim();
  const firstStrength = note.property_strengths?.[0];
  if (typeof firstStrength === "string" && firstStrength.trim()) {
    return firstStrength.trim().slice(0, 80);
  }
  if (note.host_summary?.trim()) return note.host_summary.trim().slice(0, 80);
  return "Untitled open house";
}

export function collectVisitorQuestions(note) {
  const groups = Array.isArray(note?.visitor_feedback) ? note.visitor_feedback : [];
  const items = [];
  for (const group of groups) {
    const type = typeof group?.visitor_type === "string" ? group.visitor_type.trim() : "";
    const questions = Array.isArray(group?.questions) ? group.questions : [];
    for (const question of questions) {
      if (typeof question !== "string" || !question.trim()) continue;
      items.push(type ? `${type} — ${question.trim()}` : question.trim());
    }
  }
  return items;
}

export const SELLER_SNAPSHOT_MARKER = "{{SNAPSHOT}}";

const SNAPSHOT_MARKER_RE = /\{\{\s*SNAPSHOT\s*\}\}/gi;

export function emptySellerSnapshot() {
  return {
    title: "Open House Snapshot",
    stats: [],
    sections: [],
  };
}

export function sellerSnapshotHasContent(snapshot) {
  return Boolean(snapshot?.stats?.length || snapshot?.sections?.length);
}

function countLabel(n, singular, plural) {
  const count = typeof n === "number" && Number.isFinite(n) ? n : 0;
  if (count <= 0) return null;
  return `${count} ${count === 1 ? singular : plural}`;
}

/** If the model left seller_snapshot empty, build a document from stored note fields. */
export function buildFallbackSellerSnapshot(note) {
  const stats = [];
  const headcount = note?.visitor_headcount || {};
  const interest = note?.interest_level || {};

  const turnout = countLabel(headcount.total_visitors, "visitor", "visitors");
  if (turnout) stats.push({ label: "Turnout", value: turnout });
  const serious = countLabel(headcount.serious_buyers, "serious buyer", "serious buyers");
  if (serious) stats.push({ label: "Serious buyers", value: serious });
  const agents = countLabel(
    headcount.agent_accompanied_buyers,
    "agent-accompanied buyer",
    "agent-accompanied buyers"
  );
  if (agents) stats.push({ label: "Agent-accompanied", value: agents });
  const lingered = countLabel(interest.lingered, "group that lingered", "groups that lingered");
  if (lingered) stats.push({ label: "Lingered", value: lingered });
  const questionsCount = countLabel(
    interest.asked_detailed_questions,
    "group asking detailed questions",
    "groups asking detailed questions"
  );
  if (questionsCount) stats.push({ label: "Detailed questions", value: questionsCount });
  const followUp = countLabel(
    interest.requested_follow_up,
    "group requesting follow-up",
    "groups requesting follow-up"
  );
  if (followUp) stats.push({ label: "Follow-up requests", value: followUp });
  const offerTiming = countLabel(
    interest.asked_about_offer_timing,
    "group asking about offer timing",
    "groups asking about offer timing"
  );
  if (offerTiming) stats.push({ label: "Offer timing", value: offerTiming });

  const sections = [];
  const strengths = Array.isArray(note?.property_strengths)
    ? note.property_strengths.filter((item) => typeof item === "string" && item.trim())
    : [];
  if (strengths.length) {
    sections.push({ heading: "What landed", body: strengths.join("; ") });
  }
  const concerns = Array.isArray(note?.property_concerns)
    ? note.property_concerns.filter((item) => typeof item === "string" && item.trim())
    : [];
  if (concerns.length) {
    sections.push({ heading: "Market feedback", body: concerns.join("; ") });
  }
  const questions = collectVisitorQuestions(note);
  if (questions.length) {
    sections.push({ heading: "Questions", body: questions.join("; ") });
  }

  return {
    title: "Open House Snapshot",
    stats,
    sections,
  };
}

export function resolveSellerSnapshot(note) {
  const fromModel = normalizeSellerSnapshot(note?.seller_snapshot);
  if (sellerSnapshotHasContent(fromModel)) return fromModel;
  return buildFallbackSellerSnapshot(note);
}

export function formatSellerSnapshotPlaintext(snapshot) {
  if (!sellerSnapshotHasContent(snapshot)) return "";
  const lines = [];
  lines.push("────────────────────────");
  lines.push(snapshot.title || "Open House Snapshot");
  lines.push("────────────────────────");
  for (const row of snapshot.stats || []) {
    lines.push(`${row.label}: ${row.value}`);
  }
  if (snapshot.stats?.length && snapshot.sections?.length) {
    lines.push("");
  }
  for (const section of snapshot.sections || []) {
    lines.push(section.heading);
    lines.push(section.body);
    lines.push("");
  }
  lines.push("────────────────────────");
  return lines.join("\n").trim();
}

export function stripSnapshotMarker(email) {
  return String(email || "")
    .replace(SNAPSHOT_MARKER_RE, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function splitSellerEmail(email) {
  const text = stripSnapshotMarker(email);
  if (!text) return { before: "", after: "" };

  const parts = text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return { before: text, after: "" };

  const isGreeting = /^(hi|hello|dear)\b/i.test(parts[0]);
  // Keep greeting + at least one recap paragraph in `before`.
  const minBefore = isGreeting ? 2 : 1;

  const isSignoff = (p) =>
    /^(best regards|best,|warmly|sincerely|talk soon|regards,|all the best)\b/i.test(p);
  const isClosing = (p) =>
    /^(thanks|thank you|i['’]ll be in touch|i will be in touch)\b/i.test(p);

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

  if (cut < minBefore) return { before: text, after: "" };

  return {
    before: parts.slice(0, cut).join("\n\n").trim(),
    after: parts.slice(cut).join("\n\n").trim(),
  };
}

export function composeSellerEmailBody(note) {
  const snapshot = resolveSellerSnapshot(note);
  const snapshotText = formatSellerSnapshotPlaintext(snapshot);
  const { before, after } = splitSellerEmail(note?.seller_report_email || "");
  return [before, snapshotText, after].filter(Boolean).join("\n\n").trim();
}

function emptyHeadcount() {
  return {
    total_visitors: 0,
    serious_buyers: 0,
    casual_neighbors: 0,
    agent_accompanied_buyers: 0,
  };
}

function emptyInterestLevel() {
  return {
    lingered: 0,
    asked_detailed_questions: 0,
    requested_follow_up: 0,
    asked_about_offer_timing: 0,
  };
}

function normalizeHeadcount(input) {
  const src = input && typeof input === "object" ? input : {};
  return {
    total_visitors: toCount(src.total_visitors),
    serious_buyers: toCount(src.serious_buyers),
    casual_neighbors: toCount(src.casual_neighbors),
    agent_accompanied_buyers: toCount(src.agent_accompanied_buyers),
  };
}

function normalizeInterestLevel(input) {
  const src = input && typeof input === "object" ? input : {};
  return {
    lingered: toCount(src.lingered),
    asked_detailed_questions: toCount(src.asked_detailed_questions),
    requested_follow_up: toCount(src.requested_follow_up),
    asked_about_offer_timing: toCount(src.asked_about_offer_timing),
  };
}

function normalizeVisitorFeedback(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      visitor_type: asString(item.visitor_type || item.type),
      likes: toStringArray(item.likes),
      concerns: toStringArray(item.concerns),
      questions: toStringArray(item.questions),
      interest_level: asString(item.interest_level),
    }));
}

function normalizeSellerSnapshot(input) {
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
    title: asString(src.title).trim() || "Open House Snapshot",
    stats,
    sections,
  };
}

function isSellerSnapshot(value) {
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

function isCountMap(value, fields) {
  if (!value || typeof value !== "object") return false;
  return fields.every((field) => typeof value[field] === "number" && Number.isFinite(value[field]));
}

function asString(value) {
  return typeof value === "string" ? value : "";
}

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string");
}

function toCount(value) {
  const n = typeof value === "number" ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function cryptoRandomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `note_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
