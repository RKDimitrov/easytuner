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
    op.add_column("users", sa.Column("display_name", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("avatar_url", sa.String(length=512), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "avatar_url")
    op.drop_column("users", "display_name")
