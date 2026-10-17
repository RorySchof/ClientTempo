/**
 * Open House Notes — TypeScript types matching the authoritative schema.
 */

export type VisitorHeadcount = {
  total_visitors: number;
  serious_buyers: number;
  casual_neighbors: number;
  agent_accompanied_buyers: number;
};

export type InterestLevel = {
  lingered: number;
  asked_detailed_questions: number;
  requested_follow_up: number;
  asked_about_offer_timing: number;
};

export type VisitorFeedbackGroup = {
  visitor_type: string;
  likes: string[];
  concerns: string[];
  questions: string[];
  interest_level: string;
};

export type SellerSnapshotStat = {
  label: string;
  value: string;
};

export type SellerSnapshotSection = {
  heading: string;
  body: string;
};

export type SellerSnapshot = {
  title: string;
  stats: SellerSnapshotStat[];
  sections: SellerSnapshotSection[];
};

export type OpenHouseNote = {
  id: string;
  createdAt: string;
  seller_names: string[];
  seller_emails: string[];
  property_address: string;
  raw_notes: string;
  host_summary: string;
  email_subject_seller: string;
  interest_level_summary: string;
  visitor_headcount: VisitorHeadcount;
  interest_level: InterestLevel;
  property_strengths: string[];
  property_concerns: string[];
  visitor_feedback: VisitorFeedbackGroup[];
  host_action_items: string[];
  coaching_insights: string;
  seller_report_email: string;
  seller_snapshot: SellerSnapshot;
  email_subject_agent: string;
};

/** Model-generated fields only (no id / createdAt / seller contact / address metadata). */
export type OpenHouseNotePayload = Omit<
  OpenHouseNote,
  "id" | "createdAt" | "seller_names" | "seller_emails" | "property_address" | "raw_notes"
>;

export type ShowingNote = OpenHouseNote;
export type ShowingNotePayload = OpenHouseNotePayload;
export type Note = OpenHouseNote;
