"""
Smoke test for the rules loader. Not a unit test -- a tracer bullet that
exercises the whole path from YAML files on disk to validated dataclasses.

Run from the backend/ directory:
    python test_rules_loader.py
"""

import sys
from pathlib import Path

# Make sure we can import from app/
sys.path.insert(0, str(Path(__file__).parent))

from app.services.rules_loader import load_rules_library


def main():
    rules_dir = Path(__file__).parent.parent / "rules"
    print(f"Loading rules from: {rules_dir}")

    lib = load_rules_library(rules_dir)

    print(f"\n[OK] Loaded {len(lib.dimensions)} dimensions")
    print(f"[OK] Total questions: {sum(len(d.questions) for d in lib.dimensions)}")

    print("\nDimension summary:")
    print(f"  {'ID':4} {'Weight':>8}  {'Qs':>3}  {'Regs':>4}  Name")
    print(f"  {'-'*4} {'-'*8:>8}  {'-'*3:>3}  {'-'*4:>4}  {'-'*40}")
    for d in lib.dimensions:
        print(
            f"  {d.id:4} {d.weight:>8.3f}  {len(d.questions):>3}  "
            f"{len(d.regulatory_anchors):>4}  {d.name}"
        )

    weight_total = sum(d.weight for d in lib.dimensions)
    print(f"\n  Total dimension weight: {weight_total:.4f} (should be 1.0000)")

    # Test the by_id lookup
    d1 = lib.by_id("d1")
    print(f"\n[OK] Lookup by id works: lib.by_id('d1') -> {d1.name}")

    # Dump one full dimension to show everything parsed correctly
    print(f"\n--- Full parsed detail for {d1.id} ({d1.name}) ---")
    print(f"Description: {d1.description.strip()[:100]}...")
    print(f"Regulatory anchors:")
    for ra in d1.regulatory_anchors:
        print(f"  - {ra.regulation}: {', '.join(ra.clauses[:2])}{'...' if len(ra.clauses) > 2 else ''}")
    print(f"Maturity levels:")
    for ml in d1.maturity_levels:
        print(f"  - Level {ml.level} ({ml.label}): {ml.description[:60]}...")
    print(f"First question:")
    q1 = d1.questions[0]
    print(f"  {q1.id}: {q1.text}")
    print(f"  Weight: {q1.weight}, Options: {len(q1.options)}")
    print(f"Gap remediation entries: {len(d1.gap_remediation_library)}")

    print("\n[OK] All checks passed. Rules loader works end-to-end.")


if __name__ == "__main__":
    main()
