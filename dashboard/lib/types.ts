export type LeadStatus =
  | "new"
  | "diagnosing"
  | "diagnosed"
  | "schema_ready"
  | "message_ready"
  | "sent"
  | "replied"
  | "won"
  | "lost"
  | "quarantine";

export type Lead = {
  id: string;
  business_name: string;
  business_url: string;
  business_sector: string | null;
  instagram_handle: string | null;
  contact_email: string | null;
  contact_name: string | null;
  source: string | null;
  status: LeadStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  last_contact_at: string | null;
};

export type Diagnostic = {
  id: string;
  lead_id: string;
  agent_version: string;
  raw_response: {
    tasks: Array<{
      rank: number;
      name: string;
      current_manual_process?: string;
      frequency_per_week?: number;
      hours_lost_weekly: number;
      annual_cost_eur: number;
      automation_solution: string;
      concrete_result?: string;
      time_to_roi_months?: number;
      urgency: "high" | "medium" | "low";
    }>;
    pitch_hook: string;
    schema_accent_color?: string;
    [k: string]: unknown;
  } | null;
  total_hours_lost_weekly: number | null;
  total_cost_annual: number | null;
  pitch_hook: string | null;
  confidence: number | null;
  inferred_sector: string | null;
  inferred_subsector: string | null;
  what_they_sell: string | null;
  target_customer: string | null;
  contact_channels: string[] | null;
  team_size_estimate: string | null;
  schema_accent_color: string | null;
  created_at: string;
};

export type Schema = {
  id: string;
  lead_id: string;
  diagnostic_id: string;
  html_content: string;
  public_url: string | null;
  created_at: string;
};

export type Message = {
  id: string;
  lead_id: string;
  diagnostic_id: string;
  schema_id: string | null;
  channel: "email" | "instagram" | "linkedin" | "other";
  body: string;
  word_count: number | null;
  checker_passed: boolean | null;
  checker_report: {
    checks?: Record<string, boolean>;
    failed_rules?: string[];
    word_count?: number;
  } | null;
  is_approved: boolean | null;
  sent_at: string | null;
  reply_at: string | null;
  agent_version: string;
  created_at: string;
};

export type LeadDashboardRow = {
  lead_id: string;
  business_name: string;
  business_sector: string | null;
  business_url: string;
  status: LeadStatus;
  lead_created_at: string;
  last_contact_at: string | null;
  latest_diagnostic_id: string | null;
  total_hours_lost_weekly: number | null;
  total_cost_annual: number | null;
  diag_confidence: number | null;
  latest_schema_id: string | null;
  schema_url: string | null;
  messages_sent_count: number;
  messages_pending_review: number;
};
