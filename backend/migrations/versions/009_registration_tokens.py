"""add registration tokens and full name to email verification codes

Revision ID: 009_registration_tokens
Revises: 008_password_reset_codes
Create Date: 2026-10-31 13:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "009_registration_tokens"
down_revision: Union[str, None] = "008_password_reset_codes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("email_verification_codes") as batch_op:
        batch_op.add_column(sa.Column("full_name", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("registration_token_hash", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("registration_token_expires_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("registration_token_used_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.create_index("idx_email_verif_token_hash", ["registration_token_hash"])


def downgrade() -> None:
    with op.batch_alter_table("email_verification_codes") as batch_op:
        batch_op.drop_index("idx_email_verif_token_hash")
        batch_op.drop_column("registration_token_used_at")
        batch_op.drop_column("registration_token_expires_at")
        batch_op.drop_column("registration_token_hash")
        batch_op.drop_column("full_name")
