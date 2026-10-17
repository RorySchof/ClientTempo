import { requireAuth } from "@/lib/requireAuth.js";
import { listNotes, getNoteById, saveNote } from "@/lib/showing-notes/store.js";
import {
  normalizeShowingNote,
  validateShowingNote,
} from "@/lib/showing-notes/schema/showingNotes.js";

export async function GET(request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  try {
    const id = new URL(request.url).searchParams.get("id");
    if (id) {
      const note = await getNoteById(String(id));
      if (!note) return Response.json({ error: "Note not found" }, { status: 404 });
      return Response.json({ note });
    }
    return Response.json({ notes: await listNotes() });
  } catch (err) {
    console.error("notes api error:", err);
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
    const note = normalizeShowingNote(body.note || body);
    if (!validateShowingNote(note)) {
      return Response.json({ error: "Invalid showing note" }, { status: 400 });
    }
    const saved = await saveNote(note);
    return Response.json({ note: saved });
  } catch (err) {
    console.error("notes api error:", err);
    return Response.json(
      { error: err.message || "Notes API failed" },
      { status: 500 }
    );
  }
}
