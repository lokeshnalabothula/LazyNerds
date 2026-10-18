"""add roles, client registrations, and password reset tokens

Revision ID: 004_roles_registrations_auth
Revises: 003_complete_fixops_platform
Create Date: 2026-10-18 08:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "004_roles_registrations_auth"
down_revision: Union[str, None] = "003_complete_fixops_platform"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Update users table with client_id
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("client_id", sa.String(length=36), nullable=True))
        batch_op.create_foreign_key(
            "fk_users_client_id_clients",
            "clients",
            ["client_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index("idx_users_client_id", ["client_id"])

    # Map existing admin accounts safely to founder role
    op.execute("UPDATE users SET role = 'founder' WHERE role = 'admin'")

    # 2. Update clients table with assigned_employee_id
    with op.batch_alter_table("clients") as batch_op:
        batch_op.add_column(sa.Column("assigned_employee_id", sa.String(length=36), nullable=True))
        batch_op.create_foreign_key(
            "fk_clients_assigned_employee_id_users",
            "users",
            ["assigned_employee_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index("idx_clients_assigned_employee_id", ["assigned_employee_id"])

    # 3. Create password_reset_tokens table
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("token_hash", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_pwd_reset_user_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_password_reset_tokens"),
    )
    op.create_index("idx_pwd_reset_token_hash", "password_reset_tokens", ["token_hash"])
    op.create_index("idx_pwd_reset_user_expires", "password_reset_tokens", ["user_id", "expires_at"])

    # 4. Create client_registrations table
    op.create_table(
        "client_registrations",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("job_title", sa.String(length=100), nullable=True),
        sa.Column("company_name", sa.String(length=255), nullable=False),
        sa.Column("website", sa.String(length=500), nullable=True),
        sa.Column("industry", sa.String(length=100), nullable=True),
        sa.Column("company_size", sa.String(length=50), nullable=True),
        sa.Column("country", sa.String(length=100), nullable=True),
        sa.Column("requested_services", sa.Text(), nullable=True),
        sa.Column("scope_description", sa.Text(), nullable=True),
        sa.Column("primary_domains", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("reviewed_by", sa.String(length=255), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("client_id", sa.String(length=36), nullable=True),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["client_id"],
            ["clients.id"],
            name="fk_client_reg_client_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_client_reg_user_id",
            ondelete="SET NULL",
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'needs_information', 'approved', 'rejected', 'suspended')",
            name="check_registration_status",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_client_registrations"),
    )
    op.create_index("idx_client_reg_status_created", "client_registrations", ["status", "created_at"])
    op.create_index("idx_client_reg_email_status", "client_registrations", ["email", "status"])


def downgrade() -> None:
    op.drop_table("client_registrations")
    op.drop_table("password_reset_tokens")
    with op.batch_alter_table("clients") as batch_op:
        batch_op.drop_index("idx_clients_assigned_employee_id")
        batch_op.drop_constraint("fk_clients_assigned_employee_id_users", type_="foreignkey")
        batch_op.drop_column("assigned_employee_id")
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_index("idx_users_client_id")
        batch_op.drop_constraint("fk_users_client_id_clients", type_="foreignkey")
        batch_op.drop_column("client_id")
