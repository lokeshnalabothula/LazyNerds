export type TriggerEventType =
  | "on_finding_created"
  | "on_engagement_created"
  | "on_remediation_requested"
  | "scheduled_check";

export type ActionType =
  | "send_notification"
  | "assign_remediation_task"
  | "require_human_approval"
  | "generate_summary_report"
  | "trigger_adapter_scan";

export type ExecutionStatusType =
  | "completed"
  | "failed"
  | "pending_approval"
  | "rejected";

export interface AutomationRule {
  id: string;
  name: string;
  description?: string | null;
  trigger_event: TriggerEventType;
  conditions?: string | null;
  action_type: ActionType;
  action_config?: string | null;
  is_active: boolean;
  requires_approval: boolean;
  created_at: string;
  updated_at: string;
}

export interface AutomationRuleCreateInput {
  name: string;
  description?: string | null;
  trigger_event: TriggerEventType;
  conditions?: Record<string, any> | null;
  action_type: ActionType;
  action_config?: Record<string, any> | null;
  is_active?: boolean;
  requires_approval?: boolean;
}

export interface AutomationExecution {
  id: string;
  rule_id: string;
  rule_name?: string | null;
  trigger_source: string;
  status: ExecutionStatusType;
  input_payload?: string | null;
  output_result?: string | null;
  error_message?: string | null;
  approved_by?: string | null;
  executed_at: string;
}

export interface AutomationRuleListResponse {
  items: AutomationRule[];
  total: number;
}

export interface AutomationExecutionListResponse {
  items: AutomationExecution[];
  total: number;
}
