import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.automation import AutomationRule, AutomationExecution
from app.services.notification_service import create_notification
from app.services.audit_service import log_audit

logger = logging.getLogger("fixops.automation")


def evaluate_conditions(conditions: Optional[Dict[str, Any]], context: Dict[str, Any]) -> bool:
    """Evaluates rule conditions against the triggering context."""
    if not conditions:
        return True

    for key, expected_value in conditions.items():
        actual_value = context.get(key)
        if isinstance(expected_value, list):
            if actual_value not in expected_value:
                return False
        elif isinstance(expected_value, bool):
            if bool(actual_value) != expected_value:
                return False
        else:
            if actual_value != expected_value:
                return False

    return True


def execute_action(
    db: Session,
    rule: AutomationRule,
    context: Dict[str, Any],
    approved: bool = False,
) -> tuple[str, Optional[str], Optional[str]]:
    """Executes an allowlisted action or marks it pending approval."""
    if rule.requires_approval and not approved:
        return (
            "pending_approval",
            json.dumps({"message": "Execution queued pending human approval."}),
            None,
        )

    action_type = rule.action_type
    config: Dict[str, Any] = {}
    if rule.action_config:
        try:
            config = json.loads(rule.action_config)
        except Exception:
            pass

    try:
        # 1. Send Notification Action
        if action_type == "send_notification":
            recipient = config.get("recipient") or context.get("assigned_to") or "founder@lazynerds.com"
            title = config.get("title") or f"Automated Alert: {rule.name}"
            message = config.get("message") or f"Workflow trigger '{rule.trigger_event}' activated for {context.get('title', 'target resource')}."
            link = config.get("link") or context.get("link")
            
            notif = create_notification(
                db=db,
                recipient_email=recipient,
                title=title,
                message=message,
                notification_type="automation_alert",
                link=link,
            )
            return "completed", json.dumps({"notification_id": notif.id, "recipient": recipient}), None

        # 2. Assign Remediation Task Action
        elif action_type == "assign_remediation_task":
            finding_id = context.get("finding_id")
            assign_to = config.get("assignee") or "security-lead@lazynerds.com"
            days_to_remediate = config.get("deadline_days", 14)
            
            if finding_id:
                from app.models.finding import Finding
                finding = db.query(Finding).filter(Finding.id == finding_id).first()
                if finding:
                    finding.assigned_to = assign_to
                    finding.remediation_deadline = (datetime.now(timezone.utc) + timedelta(days=days_to_remediate)).date()
                    if finding.status == "open":
                        finding.status = "in_remediation"
                    db.commit()
                    return "completed", json.dumps({"finding_id": finding_id, "assigned_to": assign_to, "deadline_days": days_to_remediate}), None
            return "completed", json.dumps({"note": "No finding_id provided in context to assign"}), None

        # 3. Generate Summary Report Action
        elif action_type == "generate_summary_report":
            engagement_id = context.get("engagement_id")
            if engagement_id:
                from app.models.report import Report
                from app.models.engagement import Engagement
                eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
                if eng:
                    report = Report(
                        engagement_id=engagement_id,
                        title=f"Automated Security Report - {eng.name}",
                        report_type="executive_summary",
                        status="generated",
                        summary_content=f"Executive security summary generated automatically by workflow rule '{rule.name}'.",
                        generated_by="FixOps Automation Engine",
                    )
                    db.add(report)
                    db.commit()
                    return "completed", json.dumps({"report_id": report.id, "title": report.title}), None
            return "completed", json.dumps({"note": "No engagement_id provided in context for report generation"}), None

        # 4. Trigger Adapter Scan Action
        elif action_type == "trigger_adapter_scan":
            engagement_id = context.get("engagement_id")
            tool = config.get("tool", "nuclei")
            if engagement_id:
                from app.models.finding import Assessment
                assessment = Assessment(
                    engagement_id=engagement_id,
                    name=f"Automated Rescan: {tool.upper()}",
                    assessment_tool=tool,
                    status="completed",
                    findings_count=0,
                    execution_summary="Automated verification scan adapter dispatched by FixOps automation engine.",
                )
                db.add(assessment)
                db.commit()
                return "completed", json.dumps({"assessment_id": assessment.id, "tool": tool}), None
            return "completed", json.dumps({"note": "No engagement_id provided for adapter scan"}), None

        # 5. Require Human Approval Action
        elif action_type == "require_human_approval":
            return "pending_approval", json.dumps({"message": "Approval gate triggered for sensitive operation."}), None

        else:
            return "failed", None, f"Unrecognized action_type: {action_type}"

    except Exception as exc:
        logger.error(f"Error executing automation action '{action_type}': {exc}", exc_info=True)
        return "failed", None, str(exc)


def dispatch_event(
    db: Session,
    event_type: str,
    context: Dict[str, Any],
    trigger_source: str,
) -> List[AutomationExecution]:
    """Finds all active rules matching event_type, checks conditions, and executes action."""
    rules = (
        db.query(AutomationRule)
        .filter(
            AutomationRule.trigger_event == event_type,
            AutomationRule.is_active.is_(True),
        )
        .all()
    )

    executions = []
    for rule in rules:
        conditions = {}
        if rule.conditions:
            try:
                conditions = json.loads(rule.conditions)
            except Exception:
                pass

        if not evaluate_conditions(conditions, context):
            continue

        status, output_result, error_msg = execute_action(
            db=db,
            rule=rule,
            context=context,
            approved=False,
        )

        execution = AutomationExecution(
            rule_id=rule.id,
            trigger_source=trigger_source,
            status=status,
            input_payload=json.dumps(context),
            output_result=output_result,
            error_message=error_msg,
        )
        db.add(execution)
        db.commit()
        db.refresh(execution)
        executions.append(execution)

    return executions


def approve_execution(db: Session, execution_id: str, approver_email: str) -> AutomationExecution:
    """Approves and executes a pending automation action."""
    execution = db.query(AutomationExecution).filter(AutomationExecution.id == execution_id).first()
    if not execution:
        raise ValueError("Automation execution record not found.")

    if execution.status != "pending_approval":
        raise ValueError(f"Execution cannot be approved: current status is '{execution.status}'.")

    rule = db.query(AutomationRule).filter(AutomationRule.id == execution.rule_id).first()
    if not rule:
        raise ValueError("Associated automation rule not found.")

    context = {}
    if execution.input_payload:
        try:
            context = json.loads(execution.input_payload)
        except Exception:
            pass

    status, output_result, error_msg = execute_action(
        db=db,
        rule=rule,
        context=context,
        approved=True,
    )

    execution.status = status
    execution.output_result = output_result
    execution.error_message = error_msg
    execution.approved_by = approver_email
    db.commit()
    db.refresh(execution)

    log_audit(
        db=db,
        user_email=approver_email,
        action="APPROVE_AUTOMATION",
        resource_type="automation_execution",
        resource_id=execution.id,
        details=f"Approved execution for rule '{rule.name}'. Status: {status}",
    )
    return execution


def reject_execution(db: Session, execution_id: str, approver_email: str, reason: Optional[str] = None) -> AutomationExecution:
    """Rejects a pending automation execution."""
    execution = db.query(AutomationExecution).filter(AutomationExecution.id == execution_id).first()
    if not execution:
        raise ValueError("Automation execution record not found.")

    if execution.status != "pending_approval":
        raise ValueError(f"Execution cannot be rejected: current status is '{execution.status}'.")

    execution.status = "rejected"
    execution.error_message = reason or "Rejected by administrator."
    execution.approved_by = approver_email
    db.commit()
    db.refresh(execution)

    log_audit(
        db=db,
        user_email=approver_email,
        action="REJECT_AUTOMATION",
        resource_type="automation_execution",
        resource_id=execution.id,
        details=f"Rejected execution: {reason or 'No reason provided'}",
    )
    return execution
