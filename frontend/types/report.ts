export type ReportType =
  | "executive_summary"
  | "technical_findings"
  | "full_assessment"
  | "remediation_audit";

export type ReportStatus = "draft" | "generated" | "archived";

export interface Report {
  id: string;
  engagement_id: string;
  engagement_name?: string | null;
  title: string;
  report_type: ReportType;
  status: ReportStatus;
  summary_content?: string | null;
  findings_snapshot?: string | null;
  metrics_snapshot?: string | null;
  generated_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportCreateInput {
  engagement_id: string;
  title: string;
  report_type?: ReportType;
  summary_content?: string | null;
}

export interface ReportListResponse {
  items: Report[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
