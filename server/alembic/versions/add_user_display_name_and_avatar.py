"""Add display_name and avatar_url to users

Revision ID: add_user_profile
Revises: add_vehicle_model
Create Date: 2025-03-04

If you see "relation users already exists" when upgrading, the DB was already
migrated but alembic_version was out of sync. Stamp then upgrade:
  alembic stamp add_vehicle_model
  alembic upgrade head
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_user_profile"
down_revision: Union[str, Sequence[str], None] = "add_vehicle_model"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotent: add columns only if missing (e.g. when init_db created users before this migration ran)
    op.execute(sa.text("ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(100)"))
    op.execute(sa.text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512)"))


def downgrade() -> None:
    op.drop_column("users", "avatar_url")
    op.drop_column("users", "display_name")
