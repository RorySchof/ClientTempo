import { requireAuth } from "@/lib/requireAuth.js";
import { listNotes, getNoteById, saveNote } from "@/lib/manual-input/store.js";
import { normalizeReply, validateReply } from "@/lib/manual-input/schema/reply.js";

export async function GET(request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const id = new URL(request.url).searchParams.get("id");
    if (id) {
      const note = await getNoteById(String(id));
      if (!note) return Response.json({ error: "Reply not found" }, { status: 404 });
      return Response.json({ note });
    }
    return Response.json({ notes: await listNotes() });
  } catch (err) {
    console.error("manual-input notes api error:", err);
    return Response.json(
      { error: err.message || "Notes API failed" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const note = normalizeReply(body.note || body);
    if (!validateReply(note)) {
      return Response.json({ error: "Invalid reply" }, { status: 400 });
    }
    const saved = await saveNote(note);
    return Response.json({ note: saved });
  } catch (err) {
    console.error("manual-input notes api error:", err);
    return Response.json(
      { error: err.message || "Notes API failed" },
      { status: 500 }
    );
  }
}
