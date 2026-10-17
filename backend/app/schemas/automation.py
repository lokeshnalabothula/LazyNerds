from datetime import datetime
from typing import Optional, List, Literal, Any, Dict
from pydantic import BaseModel, Field


TriggerEventType = Literal[
    "on_finding_created",
    "on_engagement_created",
    "on_remediation_requested",
    "scheduled_check",
]
ActionType = Literal[
    "send_notification",
    "assign_remediation_task",
    "require_human_approval",
    "generate_summary_report",
    "trigger_adapter_scan",
]
ExecutionStatusType = Literal["completed", "failed", "pending_approval", "rejected"]


class AutomationRuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    trigger_event: TriggerEventType
    conditions: Optional[Dict[str, Any]] = None
    action_type: ActionType
    action_config: Optional[Dict[str, Any]] = None
    is_active: bool = True
    requires_approval: bool = False


class AutomationRuleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    trigger_event: Optional[TriggerEventType] = None
    conditions: Optional[Dict[str, Any]] = None
    action_type: Optional[ActionType] = None
    action_config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None
    requires_approval: Optional[bool] = None


class AutomationRuleOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    trigger_event: str
    conditions: Optional[str] = None
    action_type: str
    action_config: Optional[str] = None
    is_active: bool
    requires_approval: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AutomationExecutionOut(BaseModel):
    id: str
    rule_id: str
    rule_name: Optional[str] = None
    trigger_source: str
    status: str
    input_payload: Optional[str] = None
    output_result: Optional[str] = None
    error_message: Optional[str] = None
    approved_by: Optional[str] = None
    executed_at: datetime

    model_config = {"from_attributes": True}


class AutomationRuleListResponse(BaseModel):
    items: List[AutomationRuleOut]
    total: int


class AutomationExecutionListResponse(BaseModel):
    items: List[AutomationExecutionOut]
    total: int


class WorkflowDispatchInput(BaseModel):
    rule_id: str = Field(..., min_length=36, max_length=36)
    payload: Optional[Dict[str, Any]] = None


class WorkflowApprovalInput(BaseModel):
    action: Literal["approve", "reject"]
    notes: Optional[str] = None
