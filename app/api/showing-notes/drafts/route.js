import { requireAuth } from "@/lib/requireAuth.js";
import { getDraft, saveDraft, deleteDraft } from "@/lib/showing-notes/store.js";
import {
  mergeClientFields,
  mergeShowingsById,
  normalizeShowingDraft,
} from "@/lib/showing-notes/schema/showingDraft.js";

export async function GET(request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const sessionId = new URL(request.url).searchParams.get("sessionId");
    const draft = await getDraft(sessionId);
    return Response.json({ draft: draft || null });
  } catch (err) {
    console.error("showing-notes drafts GET error:", err);
    return Response.json(
      { error: err.message || "Failed to load draft" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const sessionId =
      (typeof body.showingSessionId === "string" && body.showingSessionId.trim()) ||
      "";
    const existing = sessionId ? await getDraft(sessionId) : null;
    const now = new Date().toISOString();

    const merged = mergeClientFields(
      existing || {
        showingSessionId: sessionId,
        createdAt: now,
        updatedAt: now,
        client_names: [],
        client_emails: [],
        showings: [],
      },
      body
    );

    const draft = normalizeShowingDraft({
      ...merged,
      showingSessionId: sessionId || existing?.showingSessionId,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      showings: mergeShowingsById(existing?.showings || [], body.showings || []),
    });

    const saved = await saveDraft(draft);
    return Response.json({ draft: saved });
  } catch (err) {
    console.error("showing-notes drafts POST error:", err);
    return Response.json(
      { error: err.message || "Failed to save draft" },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const url = new URL(request.url);
    let sessionId = url.searchParams.get("sessionId") || "";
    if (!sessionId) {
      try {
        const body = await request.json();
        if (typeof body?.showingSessionId === "string") {
          sessionId = body.showingSessionId;
        }
      } catch {
        sessionId = "";
      }
    }
    await deleteDraft(sessionId);
    return Response.json({ draft: null });
  } catch (err) {
    console.error("showing-notes drafts DELETE error:", err);
    return Response.json(
      { error: err.message || "Failed to delete draft" },
      { status: 500 }
    );
  }
}
