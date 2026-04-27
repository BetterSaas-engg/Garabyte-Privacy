"""phase 11 a7 user soft delete

Revision ID: c30fc25dcb6f
Revises: c72d7cb319fa
Create Date: 2026-04-27 13:30:45.483174

Adds users.deleted_at for soft-delete (audit A7). Hard-deleting a User
would null out Response.answered_by_id rows across every tenant they
ever worked in, destroying the regulatory chain M23 depends on. With
deleted_at, the row stays put and FK references remain valid; auth +
listing queries filter rows where deleted_at IS NOT NULL.

Autogen also tried to recreate FK constraints that were already
hardened in c72d7cb319fa. Those edits are dropped from this migration
— this revision is only the column add.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c30fc25dcb6f'
down_revision: Union[str, Sequence[str], None] = 'c72d7cb319fa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('deleted_at', sa.DateTime(), nullable=True))
        batch_op.create_index(batch_op.f('ix_users_deleted_at'), ['deleted_at'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_users_deleted_at'))
        batch_op.drop_column('deleted_at')
