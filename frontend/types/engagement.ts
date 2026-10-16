export type AssessmentType =
  | "Web App Pen Test"
  | "External Network Pen Test"
  | "Internal Network Pen Test"
  | "API Security Assessment"
  | "Cloud Security Assessment"
  | "Vulnerability Assessment"
  | "Mobile App Security Assessment"
  | "Security Audit"
  | "Configuration Review"
  | "Red Team Assessment"
  | "Other";

export type EngagementStatus =
  | "draft"
  | "planned"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "cancelled";

export type AuthorizationStatus =
  | "not_confirmed"
  | "pending"
  | "confirmed";

export interface Engagement {
  id: string;
  client_id: string;
  client_company_name?: string | null;
  client_status?: string | null;
  name: string;
  assessment_type: AssessmentType | string;
  status: EngagementStatus | string;
  start_date?: string | null;
  due_date?: string | null;
  description?: string | null;
  scope_summary?: string | null;
  authorization_status: AuthorizationStatus | string;
  assigned_to?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EngagementCreateInput {
  client_id: string;
  name: string;
  assessment_type: AssessmentType | string;
  status?: EngagementStatus | string;
  start_date?: string | null;
  due_date?: string | null;
  description?: string | null;
  scope_summary?: string | null;
  authorization_status?: AuthorizationStatus | string;
  assigned_to?: string | null;
  created_at?: string | null;
}

export interface EngagementUpdateInput {
  name?: string;
  assessment_type?: AssessmentType | string;
  status?: EngagementStatus | string;
  start_date?: string | null;
  due_date?: string | null;
  description?: string | null;
  scope_summary?: string | null;
  authorization_status?: AuthorizationStatus | string;
  assigned_to?: string | null;
}

export interface EngagementListResponse {
  items: Engagement[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export const ASSESSMENT_TYPE_OPTIONS: { value: AssessmentType; label: string }[] = [
  { value: "Web App Pen Test", label: "Web Application Penetration Test" },
  { value: "External Network Pen Test", label: "External Network Penetration Test" },
  { value: "Internal Network Pen Test", label: "Internal Network Penetration Test" },
  { value: "API Security Assessment", label: "API Security Assessment" },
  { value: "Cloud Security Assessment", label: "Cloud Security Assessment" },
  { value: "Vulnerability Assessment", label: "Vulnerability Assessment" },
  { value: "Mobile App Security Assessment", label: "Mobile Application Security Assessment" },
  { value: "Security Audit", label: "Security Audit" },
  { value: "Configuration Review", label: "Configuration Review" },
  { value: "Red Team Assessment", label: "Red Team Assessment" },
  { value: "Other", label: "Other" },
];

export const ENGAGEMENT_STATUS_CONFIG: Record<
  EngagementStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  draft: {
    label: "Draft",
    badgeClass: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    dotClass: "bg-slate-400",
  },
  planned: {
    label: "Planned",
    badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    dotClass: "bg-blue-400",
  },
  in_progress: {
    label: "In Progress",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    dotClass: "bg-amber-400 animate-pulse",
  },
  on_hold: {
    label: "On Hold",
    badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    dotClass: "bg-purple-400",
  },
  completed: {
    label: "Completed",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    dotClass: "bg-emerald-400",
  },
  cancelled: {
    label: "Cancelled",
    badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    dotClass: "bg-rose-400",
  },
};

export const AUTHORIZATION_STATUS_CONFIG: Record<
  AuthorizationStatus,
  { label: string; badgeClass: string }
> = {
  not_confirmed: {
    label: "Not Confirmed",
    badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  },
  pending: {
    label: "Pending Written Auth",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  confirmed: {
    label: "Confirmed (ROA Signed)",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
};
