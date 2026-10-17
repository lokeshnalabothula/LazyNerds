"""complete fixops platform modules c through j

Revision ID: 003_complete_fixops_platform
Revises: 002_add_engagements_table
Create Date: 2026-10-17 18:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "003_complete_fixops_platform"
down_revision: Union[str, None] = "002_add_engagements_table"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Assets Table (Module C)
    op.create_table(
        "assets",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("client_id", sa.String(length=36), nullable=False),
        sa.Column("engagement_id", sa.String(length=36), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("asset_type", sa.String(length=50), nullable=False),
        sa.Column("target", sa.String(length=500), nullable=False),
        sa.Column("environment", sa.String(length=50), nullable=False, server_default="production"),
        sa.Column("criticality", sa.String(length=20), nullable=False, server_default="medium"),
        sa.Column("in_scope", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("authorization_status", sa.String(length=50), nullable=False, server_default="verified"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["client_id"],
            ["clients.id"],
            name="fk_assets_client_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["engagement_id"],
            ["engagements.id"],
            name="fk_assets_engagement_id",
            ondelete="SET NULL",
        ),
        sa.CheckConstraint(
            "asset_type IN ('domain', 'ip_address', 'web_application', 'api', 'cloud_resource', 'network_range')",
            name="check_asset_type",
        ),
        sa.CheckConstraint(
            "environment IN ('production', 'staging', 'development')",
            name="check_asset_environment",
        ),
        sa.CheckConstraint(
            "criticality IN ('critical', 'high', 'medium', 'low')",
            name="check_asset_criticality",
        ),
        sa.CheckConstraint(
            "authorization_status IN ('verified', 'pending', 'unauthorized')",
            name="check_asset_authorization_status",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_assets_client_id", "assets", ["client_id"])
    op.create_index("ix_assets_engagement_id", "assets", ["engagement_id"])
    op.create_index("ix_assets_asset_type", "assets", ["asset_type"])
    op.create_index("idx_assets_client_scope", "assets", ["client_id", "in_scope"])
    op.create_index("idx_assets_criticality", "assets", ["criticality"])

    # 2. Assessments Table (Module D)
    op.create_table(
        "assessments",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("engagement_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("assessment_tool", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="completed"),
        sa.Column("target_asset_ids", sa.Text(), nullable=True),
        sa.Column("findings_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("execution_summary", sa.Text(), nullable=True),
        sa.Column("raw_output", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["engagement_id"],
            ["engagements.id"],
            name="fk_assessments_engagement_id",
            ondelete="RESTRICT",
        ),
        sa.CheckConstraint(
            "status IN ('queued', 'running', 'completed', 'failed')",
            name="check_assessment_status",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_assessments_engagement_id", "assessments", ["engagement_id"])
    op.create_index("idx_assessments_engagement_status", "assessments", ["engagement_id", "status"])
    op.create_index("idx_assessments_created_at", "assessments", ["created_at"])

    # 3. Findings Table (Module D & E)
    op.create_table(
        "findings",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("engagement_id", sa.String(length=36), nullable=False),
        sa.Column("asset_id", sa.String(length=36), nullable=True),
        sa.Column("assessment_id", sa.String(length=36), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("cvss_score", sa.Float(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="open"),
        sa.Column("cve_id", sa.String(length=100), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("impact", sa.Text(), nullable=True),
        sa.Column("remediation_guidance", sa.Text(), nullable=True),
        sa.Column("evidence", sa.Text(), nullable=True),
        sa.Column("references_url", sa.Text(), nullable=True),
        sa.Column("remediation_notes", sa.Text(), nullable=True),
        sa.Column("remediation_deadline", sa.Date(), nullable=True),
        sa.Column("assigned_to", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["engagement_id"],
            ["engagements.id"],
            name="fk_findings_engagement_id",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["asset_id"],
            ["assets.id"],
            name="fk_findings_asset_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["assessment_id"],
            ["assessments.id"],
            name="fk_findings_assessment_id",
            ondelete="SET NULL",
        ),
        sa.CheckConstraint(
            "severity IN ('critical', 'high', 'medium', 'low', 'info')",
            name="check_finding_severity",
        ),
        sa.CheckConstraint(
            "status IN ('open', 'in_remediation', 'verification_pending', 'verified_fixed', 'accepted_risk', 'false_positive')",
            name="check_finding_status",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_findings_engagement_id", "findings", ["engagement_id"])
    op.create_index("ix_findings_asset_id", "findings", ["asset_id"])
    op.create_index("ix_findings_assessment_id", "findings", ["assessment_id"])
    op.create_index("ix_findings_severity", "findings", ["severity"])
    op.create_index("ix_findings_status", "findings", ["status"])
    op.create_index("idx_findings_engagement_severity", "findings", ["engagement_id", "severity"])
    op.create_index("idx_findings_status_severity", "findings", ["status", "severity"])
    op.create_index("idx_findings_created_at", "findings", ["created_at"])

    # 4. Verifications Table (Module E)
    op.create_table(
        "verifications",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("finding_id", sa.String(length=36), nullable=False),
        sa.Column("verified_by", sa.String(length=255), nullable=False),
        sa.Column("result", sa.String(length=50), nullable=False),
        sa.Column("verification_method", sa.String(length=100), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["finding_id"],
            ["findings.id"],
            name="fk_verifications_finding_id",
            ondelete="CASCADE",
        ),
        sa.CheckConstraint(
            "result IN ('passed', 'failed', 'partially_resolved')",
            name="check_verification_result",
        ),
        sa.CheckConstraint(
            "verification_method IN ('automated_rescan', 'manual_verification', 'code_review')",
            name="check_verification_method",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_verifications_finding_id", "verifications", ["finding_id"])
    op.create_index("idx_verifications_finding_date", "verifications", ["finding_id", "verified_at"])

    # 5. Automation Rules Table (Module F)
    op.create_table(
        "automation_rules",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("trigger_event", sa.String(length=100), nullable=False),
        sa.Column("conditions", sa.Text(), nullable=True),
        sa.Column("action_type", sa.String(length=100), nullable=False),
        sa.Column("action_config", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("requires_approval", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "trigger_event IN ('on_finding_created', 'on_engagement_created', 'on_remediation_requested', 'scheduled_check')",
            name="check_rule_trigger_event",
        ),
        sa.CheckConstraint(
            "action_type IN ('send_notification', 'assign_remediation_task', 'require_human_approval', 'generate_summary_report', 'trigger_adapter_scan')",
            name="check_rule_action_type",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_automation_rules_trigger_event", "automation_rules", ["trigger_event"])
    op.create_index("ix_automation_rules_action_type", "automation_rules", ["action_type"])
    op.create_index("idx_rules_trigger_active", "automation_rules", ["trigger_event", "is_active"])

    # 6. Automation Executions Table (Module F)
    op.create_table(
        "automation_executions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("rule_id", sa.String(length=36), nullable=False),
        sa.Column("trigger_source", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="completed"),
        sa.Column("input_payload", sa.Text(), nullable=True),
        sa.Column("output_result", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("approved_by", sa.String(length=255), nullable=True),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["rule_id"],
            ["automation_rules.id"],
            name="fk_executions_rule_id",
            ondelete="CASCADE",
        ),
        sa.CheckConstraint(
            "status IN ('completed', 'failed', 'pending_approval', 'rejected')",
            name="check_execution_status",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_automation_executions_rule_id", "automation_executions", ["rule_id"])
    op.create_index("idx_executions_rule_status", "automation_executions", ["rule_id", "status"])
    op.create_index("idx_executions_executed_at", "automation_executions", ["executed_at"])

    # 7. Reports Table (Module G)
    op.create_table(
        "reports",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("engagement_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("report_type", sa.String(length=50), nullable=False, server_default="full_assessment"),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="generated"),
        sa.Column("summary_content", sa.Text(), nullable=True),
        sa.Column("findings_snapshot", sa.Text(), nullable=True),
        sa.Column("metrics_snapshot", sa.Text(), nullable=True),
        sa.Column("generated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["engagement_id"],
            ["engagements.id"],
            name="fk_reports_engagement_id",
            ondelete="RESTRICT",
        ),
        sa.CheckConstraint(
            "report_type IN ('executive_summary', 'technical_findings', 'full_assessment', 'remediation_audit')",
            name="check_report_type",
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'generated', 'archived')",
            name="check_report_status",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_reports_engagement_id", "reports", ["engagement_id"])
    op.create_index("idx_reports_created_at", "reports", ["created_at"])

    # 8. Notifications Table (Module H)
    op.create_table(
        "notifications",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("recipient_email", sa.String(length=255), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("notification_type", sa.String(length=50), nullable=False, server_default="system"),
        sa.Column("link", sa.String(length=500), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "notification_type IN ('finding_alert', 'engagement_due', 'automation_alert', 'verification_result', 'system')",
            name="check_notification_type",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notifications_recipient_email", "notifications", ["recipient_email"])
    op.create_index("ix_notifications_is_read", "notifications", ["is_read"])
    op.create_index("idx_notifications_user_read", "notifications", ["recipient_email", "is_read"])
    op.create_index("idx_notifications_created_at", "notifications", ["created_at"])

    # 9. Audit Logs Table (Module J)
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_email", sa.String(length=255), nullable=False),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("resource_type", sa.String(length=50), nullable=False),
        sa.Column("resource_id", sa.String(length=36), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_user_email", "audit_logs", ["user_email"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("idx_audit_logs_user_action", "audit_logs", ["user_email", "action"])
    op.create_index("idx_audit_logs_created_at", "audit_logs", ["created_at"])
    op.create_index("idx_audit_logs_resource", "audit_logs", ["resource_type", "resource_id"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("notifications")
    op.drop_table("reports")
    op.drop_table("automation_executions")
    op.drop_table("automation_rules")
    op.drop_table("verifications")
    op.drop_table("findings")
    op.drop_table("assessments")
    op.drop_table("assets")
