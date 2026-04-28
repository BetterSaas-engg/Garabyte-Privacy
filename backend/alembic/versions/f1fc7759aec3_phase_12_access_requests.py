"""phase 12 access requests

Revision ID: f1fc7759aec3
Revises: c30fc25dcb6f
Create Date: 2026-04-27 22:32:17.389151

Adds access_requests table for the public landing-page "Request access"
form. Inbound submissions land here; Garabyte ops triages from the admin
queue.

Autogen also tried to recreate FKs that c72d7cb319fa already hardened;
those edits are stripped from this revision.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f1fc7759aec3'
down_revision: Union[str, Sequence[str], None] = 'c30fc25dcb6f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'access_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('org_name', sa.String(length=255), nullable=False),
        sa.Column('sector', sa.String(length=64), nullable=True),
        sa.Column('employee_count', sa.Integer(), nullable=True),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('source_ip', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=32), nullable=False),
        sa.Column('triage_notes', sa.Text(), nullable=True),
        sa.Column('triaged_by_id', sa.Integer(), nullable=True),
        sa.Column('triaged_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ['triaged_by_id'], ['users.id'],
            name='fk_access_requests_triaged_by_id_users',
            ondelete='SET NULL',
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('access_requests', schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f('ix_access_requests_email'), ['email'], unique=False,
        )
        batch_op.create_index(
            batch_op.f('ix_access_requests_id'), ['id'], unique=False,
        )


def downgrade() -> None:
    with op.batch_alter_table('access_requests', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_access_requests_id'))
        batch_op.drop_index(batch_op.f('ix_access_requests_email'))
    op.drop_table('access_requests')
