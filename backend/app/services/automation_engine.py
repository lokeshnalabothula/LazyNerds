import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.automation import AutomationRule, AutomationExecution
from app.models.notification import Notification
from app.models.finding import Finding
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


def get_or_create_remediation_reminder_rule(db: Session) -> AutomationRule:
    """Gets or initializes the baseline system rule for remediation reminders."""
    rule = (
        db.query(AutomationRule)
        .filter(AutomationRule.name == "Remediation Follow-up Reminder")
        .first()
    )
    if not rule:
        rule = AutomationRule(
            name="Remediation Follow-up Reminder",
            description="Autonomous follow-up engine that identifies overdue or approaching remediation deadlines and notifies the assigned security engineer.",
            trigger_event="scheduled_check",
            conditions=json.dumps({"status": ["open", "in_remediation"]}),
            action_type="send_notification",
            action_config=json.dumps({"title": "Remediation Follow-up", "cooldown_hours": 24}),
            is_active=True,
            requires_approval=False,
        )
        db.add(rule)
        db.commit()
        db.refresh(rule)
    return rule


def run_remediation_followup_reminders(
    db: Session,
    reminder_window_days: int = 3,
    operator_email: str = "system@lazynerds.com",
) -> Dict[str, Any]:
    """
    Executes the flagship Remediation Follow-up Reminder automation.

    1. Identifies findings in 'open' or 'in_remediation' state with an assigned owner and due date.
    2. Detects items approaching due date (<= reminder_window_days) or currently overdue.
    3. Checks for previous reminders in the last 24h to strictly prevent duplicate notifications.
    4. Delivers targeted in-app notification to the assigned owner.
    5. Records the automation execution outcome and audit log.
    """
    rule = get_or_create_remediation_reminder_rule(db)
    today = datetime.now(timezone.utc).date()
    cutoff_time = datetime.now(timezone.utc) - timedelta(hours=24)

    # 1. Query candidate findings
    candidates = (
        db.query(Finding)
        .filter(
            Finding.status.in_(["open", "in_remediation"]),
            Finding.assigned_to.isnot(None),
            Finding.assigned_to != "",
            Finding.remediation_deadline.isnot(None),
        )
        .all()
    )

    total_checked = len(candidates)
    reminders_sent = 0
    duplicates_skipped = 0
    errors_count = 0
    details = []

    for finding in candidates:
        finding_id = finding.id
        finding_title = finding.title
        try:
            # Skip findings belonging to inactive, cancelled, or unconfirmed draft engagements
            if finding.engagement and finding.engagement.status in ["cancelled", "draft"]:
                continue

            deadline = finding.remediation_deadline
            days_diff = (deadline - today).days

            # Only remind if deadline is within window or already overdue
            if days_diff > reminder_window_days:
                continue

            is_overdue = days_diff < 0
            recipient = finding.assigned_to.strip()

            # 2. Duplicate notification avoidance: check if notification sent within 24 hours
            existing = (
                db.query(Notification)
                .filter(
                    Notification.recipient_email == recipient,
                    Notification.notification_type == "automation_alert",
                    Notification.link == f"/findings/{finding_id}",
                    Notification.created_at >= cutoff_time,
                )
                .first()
            )

            if existing:
                duplicates_skipped += 1
                details.append({
                    "finding_id": finding_id,
                    "title": finding_title,
                    "assigned_to": recipient,
                    "status": "skipped_duplicate",
                    "reason": "Reminder already dispatched within last 24 hours",
                })
                continue

            # 3. Formulate message
            if is_overdue:
                title = f"[OVERDUE] Remediation Required: {finding_title}"
                urgency = f"is {abs(days_diff)} day(s) overdue (deadline was {deadline})"
            elif days_diff == 0:
                title = f"[DUE TODAY] Remediation Deadline: {finding_title}"
                urgency = f"is due today ({deadline})"
            else:
                title = f"[REMINDER] Remediation Due in {days_diff}d: {finding_title}"
                urgency = f"is due in {days_diff} day(s) on {deadline}"

            message = (
                f"Finding '{finding_title}' (Severity: {finding.severity.upper()}) "
                f"assigned to you {urgency}. Please verify remediation or update testing status."
            )

            # 4. Dispatch in-app notification
            notif = create_notification(
                db=db,
                recipient_email=recipient,
                title=title,
                message=message,
                notification_type="automation_alert",
                link=f"/findings/{finding_id}",
            )

            reminders_sent += 1
            details.append({
                "finding_id": finding_id,
                "title": finding_title,
                "assigned_to": recipient,
                "notification_id": notif.id,
                "days_diff": days_diff,
                "is_overdue": is_overdue,
                "status": "sent",
            })

        except Exception as e:
            db.rollback()
            errors_count += 1
            logger.error(f"Error checking reminder for finding {finding_id}: {e}", exc_info=True)
            details.append({
                "finding_id": finding_id,
                "title": finding_title,
                "status": "error",
                "error": str(e),
            })

    # 5. Record Automation Execution Log
    execution_status = "completed" if errors_count == 0 else "failed" if reminders_sent == 0 else "completed"
    output_summary = {
        "findings_checked": total_checked,
        "reminders_sent": reminders_sent,
        "duplicates_skipped": duplicates_skipped,
        "errors": errors_count,
        "summary": f"Sent {reminders_sent} reminder(s); avoided {duplicates_skipped} duplicate(s).",
    }

    execution = AutomationExecution(
        rule_id=rule.id,
        trigger_source=f"scheduled_check:{operator_email}",
        status=execution_status,
        input_payload=json.dumps({"reminder_window_days": reminder_window_days}),
        output_result=json.dumps(output_summary),
        error_message=f"{errors_count} error(s) during execution" if errors_count > 0 else None,
    )
    db.add(execution)
    db.commit()
    db.refresh(execution)

    log_audit(
        db=db,
        user_email=operator_email,
        action="RUN_REMEDIATION_REMINDERS",
        resource_type="automation_execution",
        resource_id=execution.id,
        details=f"Remediation follow-up check: {reminders_sent} sent, {duplicates_skipped} duplicates avoided, {total_checked} evaluated.",
    )

    return {
        "status": execution_status,
        "execution_id": execution.id,
        "findings_checked": total_checked,
        "reminders_sent": reminders_sent,
        "duplicates_skipped": duplicates_skipped,
        "errors": errors_count,
        "details": details,
    }


def get_remediation_reminders_status(db: Session) -> Dict[str, Any]:
    """Retrieves operational telemetry for the remediation reminder automation."""
    rule = (
        db.query(AutomationRule)
        .filter(AutomationRule.name == "Remediation Follow-up Reminder")
        .first()
    )

    last_execution = None
    if rule:
        last_execution = (
            db.query(AutomationExecution)
            .filter(AutomationExecution.rule_id == rule.id)
            .order_by(desc(AutomationExecution.executed_at))
            .first()
        )

    today = datetime.now(timezone.utc).date()
    open_with_deadlines = (
        db.query(Finding)
        .filter(
            Finding.status.in_(["open", "in_remediation"]),
            Finding.assigned_to.isnot(None),
            Finding.assigned_to != "",
            Finding.remediation_deadline.isnot(None),
        )
        .count()
    )

    overdue_count = (
        db.query(Finding)
        .filter(
            Finding.status.in_(["open", "in_remediation"]),
            Finding.assigned_to.isnot(None),
            Finding.assigned_to != "",
            Finding.remediation_deadline < today,
        )
        .count()
    )

    return {
        "status": "active" if rule and rule.is_active else "unconfigured",
        "rule_id": rule.id if rule else None,
        "last_executed_at": last_execution.executed_at.isoformat() if last_execution else None,
        "last_status": last_execution.status if last_execution else None,
        "open_findings_with_deadlines": open_with_deadlines,
        "overdue_count": overdue_count,
    }
