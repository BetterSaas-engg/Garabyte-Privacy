"""
Smoke test for the scoring engine.
Runs three realistic profiles (weak, mixed, strong privacy program) through
the full path: rules loader -> scoring engine -> final result.

Run from the backend/ directory:
    python test_scoring.py

Expected rough output:
    WEAK profile:   overall score ~0.6  (Developing)
    MIXED profile:  overall score ~2.1  (Defined)
    STRONG profile: overall score ~3.4  (Managed)
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.services.rules_loader import load_rules_library
from app.services.scoring import score_assessment


def make_responses_for_profile(profile: str, rules) -> dict[str, int]:
    """
    Build a response dict matching a sector-agnostic maturity profile.
    Each dimension gets a target score; every question in that dimension
    is answered with the target (we'll add variation later in real tenants).
    """
    profiles = {
        "weak":   {"d1": 1, "d2": 0, "d3": 1, "d4": 1, "d5": 0, "d6": 1, "d7": 1, "d8": 0},
        "mixed":  {"d1": 3, "d2": 2, "d3": 3, "d4": 2, "d5": 1, "d6": 2, "d7": 3, "d8": 1},
        "strong": {"d1": 4, "d2": 3, "d3": 4, "d4": 3, "d5": 3, "d6": 4, "d7": 4, "d8": 2},
    }
    target = profiles[profile]
    responses = {}
    for dim in rules.dimensions:
        for q in dim.questions:
            responses[q.id] = target[dim.id]
    return responses


def render_bar(score: float, width: int = 16) -> str:
    """Simple ASCII bar: score 0-4 maps to 0-width block characters."""
    filled = int(round((score / 4.0) * width))
    return "#" * filled + "-" * (width - filled)


def main():
    rules_dir = Path(__file__).parent.parent / "rules"
    rules = load_rules_library(rules_dir)

    print("=" * 72)
    print("SCORING ENGINE SMOKE TEST")
    print("=" * 72)

    for profile in ["weak", "mixed", "strong"]:
        print(f"\n--- Profile: {profile.upper()} ---")
        responses = make_responses_for_profile(profile, rules)
        result = score_assessment(rules, responses)

        print(f"Overall: {result.overall_score:.2f} ({result.overall_maturity_label})")
        print(f"Dimensions:")
        for ds in result.dimension_scores:
            bar = render_bar(ds.score)
            print(
                f"  {ds.dimension_id}  score={ds.score:.1f}  "
                f"[{bar}]  {ds.dimension_name}"
            )

        print(f"Gap findings: {len(result.gaps)}")
        for g in result.gaps[:5]:
            hours = f" ({g.typical_consulting_hours}h)" if g.typical_consulting_hours else ""
            print(f"  [{g.severity.upper():>8}] {g.dimension_name}: {g.finding}{hours}")
            if g.upsell_hook:
                print(f"              UPSELL: {g.upsell_hook}")
        if len(result.gaps) > 5:
            print(f"  ... and {len(result.gaps) - 5} more")

    # Test the contract checks
    print("\n--- Contract checks ---")
    try:
        score_assessment(rules, {"invalid_qid": 2})
        print("  [FAIL] unknown question ID should have raised")
    except ValueError as e:
        print(f"  [OK] unknown question ID rejected: {e}")

    try:
        score_assessment(rules, {"d1_q1": 99})
        print("  [FAIL] out-of-range value should have raised")
    except ValueError as e:
        print(f"  [OK] out-of-range value rejected: {e}")

    print("\n" + "=" * 72)
    print("All scoring checks complete.")


if __name__ == "__main__":
    main()
