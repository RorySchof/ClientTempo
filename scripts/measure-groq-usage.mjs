/**
 * Local Groq usage measurement. Calls helpers directly.
 * Does not hit app routes, credits, Redis notes, or Stripe.
 *
 * Run: node --experimental-default-type=module scripts/measure-groq-usage.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");

function loadEnv() {
  const env = {};
  const text = readFileSync(resolve(ROOT, ".env.local"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw || raw.startsWith("#") || !raw.includes("=")) continue;
    const i = raw.indexOf("=");
    env[raw.slice(0, i).trim()] = raw.slice(i + 1).trim();
  }
  return env;
}

const env = loadEnv();
for (const [key, value] of Object.entries(env)) {
  if (process.env[key] == null) process.env[key] = value;
}
process.env.GROQ_USAGE_LOG = "1";
delete process.env.VERCEL;

if (!process.env.GROQ_API_KEY) {
  throw new Error("GROQ_API_KEY is required for local usage measurement");
}

function extractForwardedMessage(body) {
  if (!body || typeof body !== "string") return "";
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const separatorPattern = /^-{2,}\s*Forwarded message\s*-{2,}\s*$/i;
  const forwardedMarkerPattern = /forwarded message/i;
  const headerLinePattern = /^(From|Date|Subject|To):\s*/i;
  const separatorIndex = lines.findIndex(
    (line) =>
      separatorPattern.test(line.trim()) ||
      forwardedMarkerPattern.test(line.trim())
  );
  if (separatorIndex === -1) return body.trim();
  let index = separatorIndex + 1;
  while (index < lines.length && headerLinePattern.test(lines[index].trim())) {
    index += 1;
  }
  const blankIndex = lines.findIndex((line, i) => i >= index && line.trim() === "");
  if (blankIndex === -1) return lines.slice(index).join("\n").trim();
  return lines.slice(blankIndex + 1).join("\n").trim();
}

function messageContentToString(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .join("");
  }
  return "";
}

const {
  completeManualInputChat,
} = await import("../lib/manual-input/completeChat.js");
const { summarizeShowingNotes } = await import("../lib/showing-notes/groq.js");
const { summarizeOpenHouseNotes } = await import(
  "../lib/open-house-notes/groq.js"
);
const { generateListingDescription } = await import(
  "../lib/listing-generator/groq.js"
);
const { logGroqUsage } = await import("../lib/dev/logGroqUsage.js");
const { loadSystemPrompt } = await import("../lib/realgpt/systemPrompt.js");
const { loadPrompt } = await import("../lib/prompts/loadPrompt.js");
const REALGPT_SYSTEM = loadSystemPrompt();
const REALTOR_REPLY_PROMPT = loadPrompt("client-reply.txt");

let attempted = 0;
let succeeded = 0;
let failed = 0;

async function run(name, fn) {
  attempted += 1;
  try {
    await fn();
    succeeded += 1;
    console.log(`${name} complete`);
  } catch (err) {
    failed += 1;
    const reason = err instanceof Error ? err.message : "error";
    console.log(`${name} failed`);
    if (reason.startsWith("realgpt groq request failed")) {
      console.log(reason);
    }
  }
}

async function realtorReply(text) {
  const cleanMessage = extractForwardedMessage(text);
  await completeManualInputChat([
    { role: "system", content: REALTOR_REPLY_PROMPT },
    { role: "user", content: JSON.stringify({ raw_email: cleanMessage }) },
  ]);
}

const realtorReplyFixtures = {
  short:
    "Hi, is 12 Maple still available and what is the list price? We can see it this week.",
  medium: `---------- Forwarded message ---------
From: Sample Client <sample.client@example.test>
Date: Mon, Sep 1, 2026
Subject: Showing request
To: Sample Agent <sample.agent@example.test>

We toured 88 Cedar Avenue yesterday. We liked the kitchen and the backyard, but the basement felt unfinished. Can we see it again Saturday morning and get the tax amount?`,
  long: `Hi, thank you for sending the offer paperwork for 410 Pine Street. We are still interested but want to understand a few items before we write.

The list price is $612,000. We were thinking $595,000 with a 21-day close if the seller will leave the washer, dryer, and patio furniture. We also need a home inspection and are unsure whether the roof replacement in 2019 was a full tear-off.

Our lender pre-approved us at $620,000. We have a lease ending October 31. If they will not move on price, would a faster close or a slightly larger earnest deposit help? Please tell us what you recommend and draft a reply we can send tonight.`,
  "multi-property": `We saw three homes Saturday.

14 Oak: bright living room, small yard, listed $489,000. Felt overpriced.
22 Birch: finished basement, busy street, $505,000. Kids liked the rec room.
9 Willow: dated kitchen, huge lot, $472,000. We would renovate.

Which one should we pursue first and what offer range makes sense on 9 Willow?`,
  sparse: "Thanks, we will think about it.",
};

const showingFixtures = {
  short: {
    rawText: "14 Oak: clients liked the light. Wanted a bigger yard. Follow up tomorrow.",
    extras: { address: "14 Oak Street" },
  },
  rich: {
    rawText: `88 Cedar Avenue:
Clients arrived 10 minutes early. They spent a long time in the kitchen and asked about the age of the appliances. They liked the pantry and the backyard deck. They were concerned about the slope in the backyard and whether the basement ever gets damp. They asked if the seller would include the freezer. They compared it to a house they saw on Birch last week and said this one felt more move-in ready. They want to come back with their parents on Sunday.`,
    extras: { address: "88 Cedar Avenue", realtorNotes: "Second showing likely." },
  },
  "multiple-properties": {
    rawText: `14 Oak Street:
Liked the porch. Kitchen is small. Price feels high.

22 Birch Road:
Finished basement. Street noise. Kids liked it.

9 Willow Lane:
Huge lot. Kitchen needs work. Best value if they will renovate.`,
    extras: { address: "" },
  },
  "mixed-sentiment": {
    rawText: `410 Pine Street: They loved the primary suite and the walk-in closet. They did not like the dated bathrooms or the low ceilings upstairs. They said they could see making an offer if the seller credits $8,000 for bath updates. They are also looking at a townhouse and might walk if we cannot get a straight answer on the roof.`,
    extras: { address: "410 Pine Street" },
  },
  messy: {
    rawText: `okay so um we walked in and they immediately said the smell was fine not like the last one then they went upstairs kinda fast talking about the closet space and then downstairs they kept saying I don't know I don't know about that carpet and then in the car they said maybe we sleep on it but also can you ask about the fence`,
    extras: { address: "Sample Lane" },
  },
};

const openHouseFixtures = {
  "light-turnout": {
    rawText: "Open house 1-3. Four groups. One couple asked about the HOA. Quiet otherwise. No callbacks requested.",
    extras: { address: "200 Sample Court" },
  },
  "busy-turnout": {
    rawText: `Sunday open house 1-4. About 28 visitors. 6 stayed more than 15 minutes. 3 asked detailed questions about the roof and taxes. 2 requested follow-up. 4 were neighbors. 2 came with another agent. Several people mentioned the backyard. A few said the list price felt ambitious compared with the sale two streets over.`,
    extras: { address: "55 Example Parkway" },
  },
  "visitor-comments": {
    rawText: `Visitor comments:
"Kitchen is beautiful but the bedrooms are small."
"We would want to paint before moving in."
"Is the seller flexible on price?"
"Love the street. Not sure about the school commute."
One buyer asked if an offer this week would be reviewed before Monday.`,
    extras: { address: "12 Demo Drive" },
  },
  "pricing-staging": {
    rawText: `Feedback was consistent: price too high by about $15-20k, front rooms feel dark, backyard is the winning feature. Staging in the dining room helped. One agent said buyers will wait unless there is a price improvement. Host thinks a small credit for lighting would be easier than a full price cut.`,
    extras: { address: "77 Fixture Road" },
  },
  sparse: {
    rawText: "Two people came. No comments.",
    extras: { address: "3 Brief Place" },
  },
};

const listingShort = "2 bed 2 bath condo, 980 sq ft, balcony, in-unit laundry, one garage space, updated kitchen, third floor.";
const listingTypical =
  "4 bed 2.5 bath single family, 2,140 sq ft, 0.28 acre, 2004 build, new roof 2022, quartz kitchen counters, fenced yard, two-car garage, walk to the park. Quiet street.";
const listingRich =
  "5 bed 4 bath, 3,600 sq ft, 0.6 acre, 2016 custom build, chef kitchen with gas range and walk-in pantry, primary suite with fireplace, covered patio, irrigation, three-car garage, hardwood on the main, finished basement rec room, office, mudroom. South-facing backyard. Community trail access.";
const listingSparse = "3 bedroom house, needs work.";

const realgptShort = ["Should I drop a listing $10k after 12 days with little traffic?"];
const realgptMedium = [
  "I am listing a 3 bed ranch in a mid-priced suburb. How should I think about pricing?",
  "What staging is worth doing on a tight budget?",
  "Who is the most likely buyer for this type of home right now?",
  "Give me a short plan for the first two weeks on market.",
];
const realgptLong = [
  "I just got licensed and have almost no budget. What should I do first?",
  "How do I get my first listing conversation without sounding desperate?",
  "A seller wants me to list $40k over the comps. How do I handle that?",
  "If they insist on the high price, what is a fair trial period?",
  "I also have a buyer who wants to offer 8 percent under list. Is that crazy?",
  "How do I write that offer so it is not insulting?",
  "The listing is now 21 days old with one showing. What changes first?",
  "Should I recommend a price cut or better photos?",
  "How do I talk to the seller about the lack of showings?",
  "What should my weekly update email include?",
];
const realgptCache = [
  "Summarize the pricing advice in two sentences.",
  "What is the single next step for the seller conversation?",
  "What should I avoid saying this week?",
];

async function realGptTurn(history, userText, label, turn) {
  await new Promise((resolve) => setTimeout(resolve, 2500));
  const messages = [...history, { role: "user", content: userText }];
  const model = process.env.MODEL_NAME ?? "openai/gpt-oss-120b";
  const groqResponse = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: REALGPT_SYSTEM }, ...messages],
      }),
    }
  );
  const groqData = await groqResponse.json();
  if (!groqResponse.ok) {
    throw new Error(`realgpt groq request failed ${groqResponse.status}`);
  }
  logGroqUsage({
    tool: "realgpt",
    response: groqData,
    extra: { label, turn },
  });
  const reply = messageContentToString(
    groqData.choices?.[0]?.message?.content ?? ""
  ).trim();
  if (!reply) throw new Error("realgpt empty reply");
  return [...messages, { role: "assistant", content: reply }];
}

async function realGptThread(label, turns, startHistory = [], startTurn = 1) {
  let history = startHistory;
  for (let i = 0; i < turns.length; i += 1) {
    history = await realGptTurn(history, turns[i], label, startTurn + i);
  }
  return history;
}

const only = process.env.MEASURE_ONLY || "";

if (!only || only === "helpers") {
for (const [name, text] of Object.entries(realtorReplyFixtures)) {
  await run(`realtor-reply ${name}`, () => realtorReply(text));
}

for (const [name, fixture] of Object.entries(showingFixtures)) {
  await run(`showing-notes ${name}`, () =>
    summarizeShowingNotes(fixture.rawText, fixture.extras)
  );
}

for (const [name, fixture] of Object.entries(openHouseFixtures)) {
  await run(`open-house-notes ${name}`, () =>
    summarizeOpenHouseNotes(fixture.rawText, fixture.extras)
  );
}

await run("listing-generator short", () =>
  generateListingDescription(listingShort)
);
await run("listing-generator short limit", () =>
  generateListingDescription(listingShort, 400)
);
await run("listing-generator typical", () =>
  generateListingDescription(listingTypical)
);
await run("listing-generator typical limit", () =>
  generateListingDescription(listingTypical, 400)
);
await run("listing-generator rich", () =>
  generateListingDescription(listingRich)
);
await run("listing-generator rich limit", () =>
  generateListingDescription(listingRich, 400)
);
await run("listing-generator sparse", () =>
  generateListingDescription(listingSparse)
);
}

if (!only || only === "realgpt") {
await run("realgpt short", () => realGptThread("rg-short", realgptShort));
await run("realgpt medium", () => realGptThread("rg-medium", realgptMedium));
}

let longHistory = [];
if (!only || only === "realgpt" || only === "realgpt-long") {
await run("realgpt long", async () => {
  for (let i = 0; i < realgptLong.length; i += 1) {
    longHistory = await realGptTurn(
      longHistory,
      realgptLong[i],
      "rg-long",
      i + 1
    );
  }
});
for (let i = 0; i < realgptCache.length; i += 1) {
  await run(`realgpt cache follow-up ${i + 1}`, async () => {
    longHistory = await realGptTurn(
      longHistory,
      realgptCache[i],
      "rg-long",
      realgptLong.length + i + 1
    );
  });
}
}

console.log(
  `measurement finished attempted=${attempted} succeeded=${succeeded} failed=${failed}`
);
if (failed) process.exit(1);
