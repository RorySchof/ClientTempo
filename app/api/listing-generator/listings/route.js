import { requireAuth } from "@/lib/requireAuth.js";
import { getListings, getListingById, saveListing } from "@/lib/listing-generator/store.js";
import {
  normalizeListing,
  validateListing,
} from "@/lib/listing-generator/schema/listing.js";

export async function GET(request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const id = new URL(request.url).searchParams.get("id");
    if (id) {
      const listing = await getListingById(String(id));
      if (!listing) {
        return Response.json({ error: "Listing not found" }, { status: 404 });
      }
      return Response.json({ listing });
    }
    return Response.json({ listings: await getListings() });
  } catch (err) {
    console.error("listings api error:", err);
    return Response.json(
      { error: err.message || "Listings API failed" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const listing = normalizeListing(body.listing || body);
    if (!validateListing(listing)) {
      return Response.json({ error: "Invalid listing" }, { status: 400 });
    }
    const saved = await saveListing(listing);
    return Response.json({ listing: saved });
  } catch (err) {
    console.error("listings api error:", err);
    return Response.json(
      { error: err.message || "Listings API failed" },
      { status: 500 }
    );
  }
}
