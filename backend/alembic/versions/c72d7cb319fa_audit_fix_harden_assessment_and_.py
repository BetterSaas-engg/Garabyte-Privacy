"""audit fix harden assessment and response cascades

Revision ID: c72d7cb319fa
Revises: 7ee86552e32b
Create Date: 2026-04-26 01:21:37.358346

The baseline migration declared assessments.tenant_id and responses.assessment_id
without ondelete=CASCADE. SQLAlchemy ORM cascade rules cover the
db.delete(tenant) path we use today, but: (a) any raw `DELETE FROM tenants`
hits the FK violation; (b) future ORM-core deletes (`db.execute(delete(...))`)
orphan dependent rows. This migration recreates both constraints with
ondelete=CASCADE so the DB itself enforces the cleanup the ORM expects.

Both FKs were unnamed in the baseline migration. SQLite has no ALTER for
FK constraints, and alembic's batch_alter_table can't drop unnamed
constraints reliably — so the SQLite path here does the rebuild manually
(create new table, copy data, swap names). On Postgres we look up the
auto-generated FK name via the inspector and replace it with a named
ondelete=CASCADE constraint.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c72d7cb319fa'
down_revision: Union[str, Sequence[str], None] = '7ee86552e32b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ASSESS_FK = "fk_assessments_tenant_id"
RESP_FK = "fk_responses_assessment_id"


def _rebuild_sqlite_assessments(cascade: bool) -> None:
    on_delete = "ON DELETE CASCADE" if cascade else ""
    op.execute("PRAGMA foreign_keys = OFF")
    # legacy_alter_table=ON suppresses SQLite's modern behavior of rewriting
    # referencing tables' FK names when the renamed table is the target of
    # an FK. Without this, evidence_files.response_id silently rewrites to
    # point at the temporary _responses_old name and stays there after we
    # drop _responses_old, leaving a dangling FK that errors at insert time.
    op.execute("PRAGMA legacy_alter_table = ON")
    op.execute("ALTER TABLE assessments RENAME TO _assessments_old")
    op.execute(f"""
        CREATE TABLE assessments (
            id INTEGER NOT NULL,
            tenant_id INTEGER NOT NULL,
            label VARCHAR(255),
            status VARCHAR(32),
            overall_score FLOAT,
            overall_maturity VARCHAR(32),
            result_json JSON,
            started_at DATETIME,
            completed_at DATETIME,
            PRIMARY KEY (id),
            CONSTRAINT {ASSESS_FK} FOREIGN KEY(tenant_id)
                REFERENCES tenants (id) {on_delete}
        )
    """)
    op.execute(
        "INSERT INTO assessments "
        "SELECT id, tenant_id, label, status, overall_score, overall_maturity, "
        "result_json, started_at, completed_at FROM _assessments_old"
    )
    op.execute("DROP TABLE _assessments_old")
    op.execute("CREATE INDEX ix_assessments_tenant_id ON assessments (tenant_id)")
    op.execute("CREATE INDEX ix_assessments_id ON assessments (id)")
    op.execute("PRAGMA foreign_keys = ON")


def _rebuild_sqlite_responses(cascade: bool) -> None:
    on_delete = "ON DELETE CASCADE" if cascade else ""
    op.execute("PRAGMA foreign_keys = OFF")
    # legacy_alter_table=ON suppresses SQLite's modern behavior of rewriting
    # referencing tables' FK names when the renamed table is the target of
    # an FK. Without this, evidence_files.response_id silently rewrites to
    # point at the temporary _responses_old name and stays there after we
    # drop _responses_old, leaving a dangling FK that errors at insert time.
    op.execute("PRAGMA legacy_alter_table = ON")
    op.execute("ALTER TABLE responses RENAME TO _responses_old")
    op.execute(f"""
        CREATE TABLE responses (
            id INTEGER NOT NULL,
            assessment_id INTEGER NOT NULL,
            question_id VARCHAR(32) NOT NULL,
            value INTEGER,
            evidence_url VARCHAR(512),
            note TEXT,
            answered_at DATETIME,
            skipped BOOLEAN NOT NULL,
            skip_reason VARCHAR(32),
            answered_by_id INTEGER,
            PRIMARY KEY (id),
            CONSTRAINT fk_responses_answered_by_id_users FOREIGN KEY(answered_by_id)
                REFERENCES users (id) ON DELETE SET NULL,
            CONSTRAINT {RESP_FK} FOREIGN KEY(assessment_id)
                REFERENCES assessments (id) {on_delete}
        )
    """)
    op.execute(
        "INSERT INTO responses "
        "SELECT id, assessment_id, question_id, value, evidence_url, note, "
        "answered_at, skipped, skip_reason, answered_by_id FROM _responses_old"
    )
    op.execute("DROP TABLE _responses_old")
    op.execute("CREATE INDEX ix_responses_assessment_id ON responses (assessment_id)")
    op.execute("CREATE INDEX ix_responses_id ON responses (id)")
    op.execute("PRAGMA foreign_keys = ON")


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        _rebuild_sqlite_assessments(cascade=True)
        _rebuild_sqlite_responses(cascade=True)
    else:
        inspector = sa.inspect(bind)
        for table, col, ref_table, name in (
            ("assessments", "tenant_id", "tenants", ASSESS_FK),
            ("responses", "assessment_id", "assessments", RESP_FK),
        ):
            existing = [
                fk["name"]
                for fk in inspector.get_foreign_keys(table)
                if col in fk["constrained_columns"] and fk["referred_table"] == ref_table
            ]
            for fk_name in existing:
                op.drop_constraint(fk_name, table, type_="foreignkey")
            op.create_foreign_key(
                name, table, ref_table, [col], ["id"], ondelete="CASCADE",
            )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        _rebuild_sqlite_responses(cascade=False)
        _rebuild_sqlite_assessments(cascade=False)
    else:
        op.drop_constraint(RESP_FK, "responses", type_="foreignkey")
        op.create_foreign_key(
            None, "responses", "assessments", ["assessment_id"], ["id"],
        )
        op.drop_constraint(ASSESS_FK, "assessments", type_="foreignkey")
        op.create_foreign_key(
            None, "assessments", "tenants", ["tenant_id"], ["id"],
        )
