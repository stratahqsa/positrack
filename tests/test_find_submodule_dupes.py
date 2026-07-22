import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from find_submodule_dupes import find_candidates  # noqa: E402


def test_flags_a_likely_typo_pair():
    counts = {"Manage Customer": 10, "Manager Customer": 1}
    candidates = find_candidates(counts)
    assert any({c[1], c[3]} == {"Manage Customer", "Manager Customer"} for c in candidates)


def test_does_not_flag_already_merged_fold_key_variants():
    # "Purchase Return" / "Purchase Returns" already merge via
    # parse.submodule_fold_key() — not a candidate here, since they collapse
    # to the same representative before pairwise comparison even runs.
    counts = {"Purchase Return": 5, "Purchase Returns": 2}
    candidates = find_candidates(counts)
    assert candidates == []


def test_does_not_flag_unrelated_submodules():
    counts = {"Purchase Order": 5, "Stock Adjustment": 3}
    candidates = find_candidates(counts)
    assert candidates == []
