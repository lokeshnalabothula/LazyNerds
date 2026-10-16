"""add engagements table

Revision ID: 002_add_engagements_table
Revises: 001_initial_schema
Create Date: 2026-10-16 10:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002_add_engagements_table"
down_revision: Union[str, None] = "001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Engagements Table
    op.create_table(
        "engagements",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("client_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("assessment_type", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="draft"),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("scope_summary", sa.Text(), nullable=True),
        sa.Column("authorization_status", sa.String(length=50), nullable=False, server_default="not_confirmed"),
        sa.Column("assigned_to", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["client_id"],
            ["clients.id"],
            name="fk_engagements_client_id",
            ondelete="RESTRICT",
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'planned', 'in_progress', 'on_hold', 'completed', 'cancelled')",
            name="check_engagement_status",
        ),
        sa.CheckConstraint(
            "authorization_status IN ('not_confirmed', 'pending', 'confirmed')",
            name="check_engagement_auth_status",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_engagements_client_id", "engagements", ["client_id"])
    op.create_index("ix_engagements_status", "engagements", ["status"])
    op.create_index("ix_engagements_assessment_type", "engagements", ["assessment_type"])
    op.create_index("idx_engagements_client_status", "engagements", ["client_id", "status"])
    op.create_index("idx_engagements_created_at", "engagements", ["created_at"])


def downgrade() -> None:
    op.drop_index("idx_engagements_created_at", table_name="engagements")
    op.drop_index("idx_engagements_client_status", table_name="engagements")
    op.drop_index("ix_engagements_assessment_type", table_name="engagements")
    op.drop_index("ix_engagements_status", table_name="engagements")
    op.drop_index("ix_engagements_client_id", table_name="engagements")
    op.drop_table("engagements")
