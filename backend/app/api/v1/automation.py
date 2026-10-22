import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.api.deps import get_current_user, require_admin, require_employee_or_founder
from app.db.session import get_db
from app.models.user import User
from app.models.automation import AutomationRule, AutomationExecution
from app.schemas.automation import (
    AutomationRuleCreate,
    AutomationRuleOut,
    AutomationRuleUpdate,
    AutomationRuleListResponse,
    AutomationExecutionOut,
    AutomationExecutionListResponse,
    WorkflowDispatchInput,
    WorkflowApprovalInput,
)
from app.services import automation_engine, audit_service

router = APIRouter()


@router.get("/rules", response_model=AutomationRuleListResponse)
def list_rules(
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_employee_or_founder),
):
    query = db.query(AutomationRule)
    if is_active is not None:
        query = query.filter(AutomationRule.is_active == is_active)

    total = query.count()
    items = query.order_by(desc(AutomationRule.created_at)).all()
    return {"items": items, "total": total}


@router.post("/rules", response_model=AutomationRuleOut, status_code=status.HTTP_201_CREATED)
def create_rule(
    rule_in: AutomationRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_employee_or_founder),
):
    rule = AutomationRule(
        name=rule_in.name,
        description=rule_in.description,
        trigger_event=rule_in.trigger_event,
        conditions=json.dumps(rule_in.conditions) if rule_in.conditions else None,
        action_type=rule_in.action_type,
        action_config=json.dumps(rule_in.action_config) if rule_in.action_config else None,
        is_active=rule_in.is_active,
        requires_approval=rule_in.requires_approval,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)

    audit_service.log_audit(
        db=db,
        user_email=current_user.email,
        action="CREATE_AUTOMATION_RULE",
        resource_type="automation_rule",
        resource_id=rule.id,
        details=f"Created automation rule '{rule.name}' for trigger '{rule.trigger_event}'",
    )
    return rule


@router.get("/rules/{rule_id}", response_model=AutomationRuleOut)
def get_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_employee_or_founder),
):
    rule = db.query(AutomationRule).filter(AutomationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found.")
    return rule


@router.patch("/rules/{rule_id}", response_model=AutomationRuleOut)
def update_rule(
    rule_id: str,
    rule_in: AutomationRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_employee_or_founder),
):
    rule = db.query(AutomationRule).filter(AutomationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found.")

    update_data = rule_in.model_dump(exclude_unset=True)
    if "conditions" in update_data:
        rule.conditions = json.dumps(update_data["conditions"]) if update_data["conditions"] else None
    if "action_config" in update_data:
        rule.action_config = json.dumps(update_data["action_config"]) if update_data["action_config"] else None

    for field in ("name", "description", "trigger_event", "action_type", "is_active", "requires_approval"):
        if field in update_data:
            setattr(rule, field, update_data[field])

    db.commit()
    db.refresh(rule)

    audit_service.log_audit(
        db=db,
        user_email=current_user.email,
        action="UPDATE_AUTOMATION_RULE",
        resource_type="automation_rule",
        resource_id=rule.id,
        details=f"Updated rule '{rule.name}'",
    )
    return rule


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    rule = db.query(AutomationRule).filter(AutomationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found.")

    rule_name = rule.name
    db.delete(rule)
    db.commit()

    audit_service.log_audit(
        db=db,
        user_email=current_user.email,
        action="DELETE_AUTOMATION_RULE",
        resource_type="automation_rule",
        resource_id=rule_id,
        details=f"Deleted rule '{rule_name}'",
    )


@router.get("/executions", response_model=AutomationExecutionListResponse)
def list_executions(
    rule_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_employee_or_founder),
):
    query = db.query(AutomationExecution)
    if rule_id:
        query = query.filter(AutomationExecution.rule_id == rule_id)
    if status_filter:
        query = query.filter(AutomationExecution.status == status_filter)

    total = query.count()
    items = query.order_by(desc(AutomationExecution.executed_at)).limit(limit).all()
    return {"items": items, "total": total}


@router.post("/dispatch", response_model=AutomationExecutionOut, status_code=status.HTTP_201_CREATED)
def dispatch_workflow(
    dispatch_in: WorkflowDispatchInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_employee_or_founder),
):
    rule = db.query(AutomationRule).filter(AutomationRule.id == dispatch_in.rule_id).first()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found.")

    payload = dispatch_in.payload or {}
    status_res, output_res, error_msg = automation_engine.execute_action(
        db=db,
        rule=rule,
        context=payload,
        approved=not rule.requires_approval,
    )

    execution = AutomationExecution(
        rule_id=rule.id,
        trigger_source=f"manual_dispatch:{current_user.email}",
        status=status_res,
        input_payload=json.dumps(payload),
        output_result=output_res,
        error_message=error_msg,
    )
    db.add(execution)
    db.commit()
    db.refresh(execution)

    audit_service.log_audit(
        db=db,
        user_email=current_user.email,
        action="DISPATCH_AUTOMATION",
        resource_type="automation_execution",
        resource_id=execution.id,
        details=f"Manual dispatch of rule '{rule.name}'. Status: {status_res}",
    )
    return execution


@router.post("/executions/{execution_id}/approve", response_model=AutomationExecutionOut)
def approve_execution(
    execution_id: str,
    approval_in: WorkflowApprovalInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
        if approval_in.action == "approve":
            return automation_engine.approve_execution(db, execution_id, current_user.email)
        else:
            return automation_engine.reject_execution(db, execution_id, current_user.email, approval_in.notes)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/remediation-reminders/run")
def run_remediation_reminders(
    reminder_window_days: int = Query(3, ge=1, le=30),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_employee_or_founder),
):
    """
    Executes the verified Remediation Follow-up Reminder automation.
    Scans in-scope findings, identifies approaching/overdue deadlines, avoids 24h duplicates,
    and dispatches authenticated in-app notifications.
    """
    return automation_engine.run_remediation_followup_reminders(
        db=db,
        reminder_window_days=reminder_window_days,
        operator_email=current_user.email,
    )


@router.get("/remediation-reminders/status")
def get_remediation_reminders_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_employee_or_founder),
):
    """Returns telemetry and active finding counts for the remediation reminder automation."""
    return automation_engine.get_remediation_reminders_status(db=db)
