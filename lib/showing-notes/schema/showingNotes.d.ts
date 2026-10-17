/**
 * Showing Notes — TypeScript types matching the authoritative schema.
 */

export type ClientSnapshotStat = {
  label: string;
  value: string;
};

export type ClientSnapshotSection = {
  heading: string;
  body: string;
};

export type ClientSnapshot = {
  title: string;
  stats: ClientSnapshotStat[];
  sections: ClientSnapshotSection[];
};

export type ShowingNote = {
  id: string;
  createdAt: string;
  client_names: string[];
  client_emails: string[];
  raw_notes: string;
  client_summary: string;
  email_subject_client: string;
  client_sentiment: string;
  property_highlights: string[];
  property_concerns: string[];
  property_comparison: string;
  realtor_action_items: string[];
  follow_ups: string[];
  coaching_insights: string;
  realtor_reply: string;
  email_subject_realtor: string;
  client_snapshot: ClientSnapshot;
};

/** Model-generated fields only (no id / createdAt / client contact metadata). */
export type ShowingNotePayload = Omit<
  ShowingNote,
  "id" | "createdAt" | "client_names" | "client_emails" | "raw_notes"
>;

export type Note = ShowingNote;
