"""
End-to-end smoke test.

Runs a comprehensive set of checks against the entire backend stack:
rules library -> scoring engine -> database -> seeded data.

Prints [OK] or [FAIL] for each check. Exits 0 if all pass, 1 if any fail.

Precondition: the database must be seeded. Run `python -m app.seed` first
if you've never seeded, or if you've cleared the db since last seed.

Run from the backend/ directory with the venv active:
    python test_end_to_end.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.database import SessionLocal
from app.models import Tenant, Assessment
from app.services.rules_loader import load_rules_library
from app.services.scoring import score_assessment


# -----------------------------------------------------------------------------
# Test infrastructure
# -----------------------------------------------------------------------------

_results: list[tuple[str, bool, str]] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    """Record a check result. Prints immediately so partial runs are useful."""
    status = "[OK]  " if condition else "[FAIL]"
    line = f"  {status} {name}"
    if detail:
        line += f"  --  {detail}"
    print(line)
    _results.append((name, condition, detail))


def summary_and_exit() -> None:
    passed = sum(1 for _, ok, _ in _results if ok)
    failed = sum(1 for _, ok, _ in _results if not ok)
    total = len(_results)
    print()
    print("=" * 72)
    if failed == 0:
        print(f"ALL CHECKS PASSED  ({passed}/{total})")
        sys.exit(0)
    else:
        print(f"FAILURES: {failed}/{total}")
        print()
        for name, ok, detail in _results:
            if not ok:
                print(f"  - {name}  {detail}")
        sys.exit(1)


# -----------------------------------------------------------------------------
# Section 1: Rules library
# -----------------------------------------------------------------------------

def section_rules_library():
    print("\n-- Rules library --")
    rules_dir = Path(__file__).parent.parent / "rules"
    rules = load_rules_library(rules_dir)

    check(
        "Rules library loads",
        len(rules.dimensions) == 8,
        f"expected 8 dimensions, got {len(rules.dimensions)}",
    )

    total_weight = sum(d.weight for d in rules.dimensions)
    check(
        "Dimension weights sum to 1.0",
        abs(total_weight - 1.0) < 0.001,
        f"got {total_weight:.4f}",
    )

    total_questions = sum(len(d.questions) for d in rules.dimensions)
    check(
        "Total of 40 questions across all dimensions",
        total_questions == 40,
        f"got {total_questions}",
    )

    all_q_weights_ok = True
    for d in rules.dimensions:
        q_sum = sum(q.weight for q in d.questions)
        if abs(q_sum - 1.0) > 0.01:
            all_q_weights_ok = False
            break
    check(
        "Each dimension's question weights sum to 1.0",
        all_q_weights_ok,
    )

    return rules


# -----------------------------------------------------------------------------
# Section 2: Scoring engine
# -----------------------------------------------------------------------------

def section_scoring(rules):
    print("\n-- Scoring engine --")

    profiles = {
        "weak":   ({"d1": 1, "d2": 0, "d3": 1, "d4": 1, "d5": 0, "d6": 1, "d7": 1, "d8": 0}, 0.62),
        "mixed":  ({"d1": 3, "d2": 2, "d3": 3, "d4": 2, "d5": 1, "d6": 2, "d7": 3, "d8": 1}, 2.14),
        "strong": ({"d1": 4, "d2": 3, "d3": 4, "d4": 3, "d5": 3, "d6": 4, "d7": 4, "d8": 2}, 3.39),
    }

    for name, (targets, expected) in profiles.items():
        responses = {}
        for dim in rules.dimensions:
            for q in dim.questions:
                responses[q.id] = targets[dim.id]
        result = score_assessment(rules, responses)
        within_range = abs(result.overall_score - expected) < 0.1
        check(
            f"{name} profile scores ~{expected}",
            within_range,
            f"got {result.overall_score:.2f}",
        )

    # Contract checks
    try:
        score_assessment(rules, {"invalid_qid": 2})
        check("Rejects unknown question ID", False, "did not raise")
    except ValueError:
        check("Rejects unknown question ID", True)

    try:
        score_assessment(rules, {"d1_q1": 99})
        check("Rejects out-of-range value", False, "did not raise")
    except ValueError:
        check("Rejects out-of-range value", True)


# -----------------------------------------------------------------------------
# Section 3: Seeded database
# -----------------------------------------------------------------------------

EXPECTED_TENANTS = {"northwind-utilities", "meridian-health", "cascade-telecom"}


def section_database(rules):
    print("\n-- Seeded database --")
    db = SessionLocal()
    try:
        demo_tenants = db.query(Tenant).filter(Tenant.is_demo == 1).all()
        slugs = {t.slug for t in demo_tenants}

        check(
            "Exactly 3 demo tenants exist",
            len(demo_tenants) == 3,
            f"got {len(demo_tenants)}: {sorted(slugs)}",
        )

        check(
            "Expected tenant slugs present",
            slugs == EXPECTED_TENANTS,
            f"missing: {EXPECTED_TENANTS - slugs}, extra: {slugs - EXPECTED_TENANTS}",
        )

        # Per-tenant checks
        for tenant in demo_tenants:
            completed = [
                a for a in tenant.assessments if a.status == "completed"
            ]
            completed.sort(key=lambda a: a.completed_at or a.started_at)

            check(
                f"{tenant.slug}: has exactly 2 completed assessments",
                len(completed) == 2,
                f"got {len(completed)}",
            )

            if len(completed) == 2:
                historical, current = completed
                delta = (current.overall_score or 0) - (historical.overall_score or 0)
                check(
                    f"{tenant.slug}: current score > historical score",
                    delta > 0,
                    f"delta={delta:.3f} "
                    f"(hist={historical.overall_score:.2f}, curr={current.overall_score:.2f})",
                )

                # D8 upsell hook check -- should fire on all three tenants
                result_json = current.result_json or {}
                gaps = result_json.get("gaps", [])
                d8_gaps_with_upsell = [
                    g for g in gaps
                    if g.get("dimension_id") == "d8" and g.get("upsell_hook")
                ]
                check(
                    f"{tenant.slug}: D8 upsell hook fires in current assessment",
                    len(d8_gaps_with_upsell) > 0,
                    f"found {len(d8_gaps_with_upsell)} D8 gaps with upsell_hook",
                )

                # Gap sort order check
                severity_rank = {"critical": 0, "high": 1, "moderate": 2, "low": 3}
                ranks = [severity_rank.get(g.get("severity"), 99) for g in gaps]
                check(
                    f"{tenant.slug}: gaps sorted critical -> moderate",
                    ranks == sorted(ranks),
                    f"rank sequence: {ranks}",
                )
    finally:
        db.close()


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

def main():
    print("=" * 72)
    print("GARABYTE PRIVACY HEALTH CHECK -- END-TO-END SMOKE TEST")
    print("=" * 72)

    rules = section_rules_library()
    section_scoring(rules)
    section_database(rules)

    summary_and_exit()


if __name__ == "__main__":
    main()
