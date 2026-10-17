export type SeverityType = "critical" | "high" | "medium" | "low" | "info";

export type FindingStatusType =
  | "open"
  | "in_remediation"
  | "verification_pending"
  | "verified_fixed"
  | "accepted_risk"
  | "false_positive";

export type VerificationResultType = "passed" | "failed" | "partially_resolved";
export type VerificationMethodType = "automated_rescan" | "manual_verification" | "code_review";

export interface Verification {
  id: string;
  finding_id: string;
  verified_by: string;
  result: VerificationResultType;
  verification_method: VerificationMethodType;
  notes?: string | null;
  verified_at: string;
}

export interface Finding {
  id: string;
  engagement_id: string;
  asset_id?: string | null;
  assessment_id?: string | null;
  title: string;
  severity: SeverityType;
  cvss_score?: number | null;
  status: FindingStatusType;
  cve_id?: string | null;
  description?: string | null;
  impact?: string | null;
  remediation_guidance?: string | null;
  evidence?: string | null;
  references_url?: string | null;
  remediation_notes?: string | null;
  remediation_deadline?: string | null;
  assigned_to?: string | null;
  engagement_name?: string | null;
  asset_name?: string | null;
  verifications: Verification[];
  created_at: string;
  updated_at: string;
}

export interface FindingCreateInput {
  engagement_id: string;
  asset_id?: string | null;
  assessment_id?: string | null;
  title: string;
  severity: SeverityType;
  cvss_score?: number | null;
  status?: FindingStatusType;
  cve_id?: string | null;
  description?: string | null;
  impact?: string | null;
  remediation_guidance?: string | null;
  evidence?: string | null;
  references_url?: string | null;
  remediation_notes?: string | null;
  remediation_deadline?: string | null;
  assigned_to?: string | null;
}

export interface FindingUpdateInput {
  title?: string;
  severity?: SeverityType;
  cvss_score?: number | null;
  status?: FindingStatusType;
  cve_id?: string | null;
  description?: string | null;
  impact?: string | null;
  remediation_guidance?: string | null;
  evidence?: string | null;
  references_url?: string | null;
  remediation_notes?: string | null;
  remediation_deadline?: string | null;
  assigned_to?: string | null;
  asset_id?: string | null;
}

export interface FindingListResponse {
  items: Finding[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface Assessment {
  id: string;
  engagement_id: string;
  name: string;
  assessment_tool: string;
  status: string;
  target_asset_ids?: string | null;
  findings_count: number;
  execution_summary?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssessmentListResponse {
  items: Assessment[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface VerificationCreateInput {
  result: VerificationResultType;
  verification_method: VerificationMethodType;
  notes?: string | null;
}

export interface ScanImportInput {
  engagement_id: string;
  tool_name: string;
  target_asset_id?: string | null;
  scan_data: any;
  auto_create_findings?: boolean;
}
