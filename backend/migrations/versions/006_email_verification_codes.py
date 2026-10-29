"""add email verification codes table

Revision ID: 006_email_verification_codes
Revises: 005_worker_ownership_leases
Create Date: 2026-10-29 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "006_email_verification_codes"
down_revision: Union[str, None] = "005_worker_ownership_leases"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "email_verification_codes",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("code_hash", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resend_available_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    with op.batch_alter_table("email_verification_codes") as batch_op:
        batch_op.create_index("idx_email_verif_email", ["email"])
        batch_op.create_index("idx_email_verif_email_expires", ["email", "expires_at"])
        batch_op.create_index("idx_email_verif_email_used", ["email", "used_at"])


def downgrade() -> None:
    with op.batch_alter_table("email_verification_codes") as batch_op:
        batch_op.drop_index("idx_email_verif_email_used")
        batch_op.drop_index("idx_email_verif_email_expires")
        batch_op.drop_index("idx_email_verif_email")
    op.drop_table("email_verification_codes")
