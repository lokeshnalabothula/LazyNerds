export interface AuditLog {
  id: string;
  user_email: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details?: string | null;
  ip_address?: string | null;
  created_at: string;
}

export interface OverviewMetrics {
  clients_total: number;
  clients_active: number;
  engagements_total: number;
  engagements_active: number;
  assets_total: number;
  assets_in_scope: number;
  findings_total: number;
  findings_open: number;
  findings_in_remediation: number;
  findings_verified_fixed: number;
  critical_findings_open: number;
  high_findings_open: number;
  severity_distribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  automation_rules_active: number;
  automation_executions_total: number;
  pending_approvals_total: number;
  recent_failures_total: number;
  pending_registrations_total: number;
  active_assessments_total: number;
  user_role: string;
  recent_activity: AuditLog[];
}
