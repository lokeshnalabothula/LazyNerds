"""add domains table for DNS TXT ownership verification

Revision ID: 007_domain_verification
Revises: 006_email_verification_codes
Create Date: 2026-10-30 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "007_domain_verification"
down_revision: Union[str, None] = "006_email_verification_codes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "domains",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column(
            "client_id",
            sa.String(length=36),
            sa.ForeignKey("clients.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("domain", sa.String(length=255), nullable=False),
        sa.Column("normalized_domain", sa.String(length=255), nullable=False),
        sa.Column("verification_status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column("verification_token_hash", sa.String(length=64), nullable=False),
        sa.Column("challenge_created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("challenge_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_verification_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verification_attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failure_reason", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    with op.batch_alter_table("domains") as batch_op:
        batch_op.create_index("idx_domains_client_id", ["client_id"])
        batch_op.create_index("idx_domains_normalized_domain", ["normalized_domain"])
        batch_op.create_index("idx_domains_status", ["verification_status"])
        batch_op.create_index("idx_domains_client_status", ["client_id", "verification_status"])
        batch_op.create_unique_constraint("uq_client_normalized_domain", ["client_id", "normalized_domain"])


def downgrade() -> None:
    with op.batch_alter_table("domains") as batch_op:
        batch_op.drop_constraint("uq_client_normalized_domain", type_="unique")
        batch_op.drop_index("idx_domains_client_status")
        batch_op.drop_index("idx_domains_status")
        batch_op.drop_index("idx_domains_normalized_domain")
        batch_op.drop_index("idx_domains_client_id")
    op.drop_table("domains")
