import { consumeCredits, refundCredits } from "@/lib/credits";
import {
  OUT_OF_TOKENS,
  requireAuthWithTokens,
} from "@/lib/requireAuthWithTokens";
import {
  generateListingDescription,
  listingProvider,
} from "@/lib/listing-generator/generate.js";
import { saveListing } from "@/lib/listing-generator/store.js";
import {
  createEmptyListing,
  normalizeListing,
} from "@/lib/listing-generator/schema/listing.js";

export const maxDuration = 60;

export async function POST(request) {
  const authz = await requireAuthWithTokens();
  if (authz instanceof Response) return authz;

  let spent = false;
  try {
    const body = await request.json();
    const description =
      (typeof body.description === "string" && body.description) ||
      (typeof body.rawDescription === "string" && body.rawDescription) ||
      "";

    if (!description.trim()) {
      return Response.json({ error: "description is required" }, { status: 400 });
    }

    spent = await consumeCredits(authz.userId, 1);
    if (!spent) {
      return Response.json({ error: OUT_OF_TOKENS }, { status: 402 });
    }

    const draft = createEmptyListing();
    const parsedLimit = Number(body.char_limit);
    const charLimit =
      body.char_limit != null &&
      body.char_limit !== "" &&
      Number.isFinite(parsedLimit) &&
      parsedLimit > 0
        ? Math.floor(parsedLimit)
        : undefined;
    const generatedDescription = await generateListingDescription(
      description,
      charLimit,
      { userId: authz.userId },
      listingProvider(body.provider)
    );
    if (!String(generatedDescription || "").trim()) {
      await refundCredits(authz.userId, spent.source);
      return Response.json(
        { error: "Could not generate description — try again." },
        { status: 502 }
      );
    }

    const listing = normalizeListing({
      ...draft,
      address: typeof body.address === "string" ? body.address : "",
      rawDescription: description.trim(),
      generatedDescription,
      clientNames: body.clientNames,
      clientEmails: body.clientEmails,
    });

    if (body.store !== false) {
      await saveListing(listing);
    }

    return Response.json({ listing });
  } catch (err) {
    if (spent) {
      await refundCredits(authz.userId, spent.source);
    }
    console.error("generate-listing error:", err);
    const emptyOutput =
      err?.message === "Could not generate description — try again.";
    return Response.json(
      { error: err.message || "Generate listing failed" },
      { status: emptyOutput ? 502 : 500 }
    );
  }
}
