"""add password reset codes table

Revision ID: 008_password_reset_codes
Revises: 007_domain_verification
Create Date: 2026-10-31 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "008_password_reset_codes"
down_revision: Union[str, None] = "007_domain_verification"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "password_reset_codes",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("code_hash", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resend_available_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reset_token_hash", sa.String(length=255), nullable=True),
        sa.Column("reset_token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    with op.batch_alter_table("password_reset_codes") as batch_op:
        batch_op.create_index("idx_pwd_reset_code_email", ["email"])
        batch_op.create_index("idx_pwd_reset_code_user_id", ["user_id"])
        batch_op.create_index("idx_pwd_reset_code_token_hash", ["reset_token_hash"])
        batch_op.create_index("idx_pwd_reset_code_email_expires", ["email", "expires_at"])
        batch_op.create_index("idx_pwd_reset_code_email_used", ["email", "used_at"])


def downgrade() -> None:
    with op.batch_alter_table("password_reset_codes") as batch_op:
        batch_op.drop_index("idx_pwd_reset_code_email_used")
        batch_op.drop_index("idx_pwd_reset_code_email_expires")
        batch_op.drop_index("idx_pwd_reset_code_token_hash")
        batch_op.drop_index("idx_pwd_reset_code_user_id")
        batch_op.drop_index("idx_pwd_reset_code_email")
    op.drop_table("password_reset_codes")
