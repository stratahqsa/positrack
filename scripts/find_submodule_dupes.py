#!/usr/bin/env python3
"""
scripts/find_submodule_dupes.py — diagnostic tool, NOT part of the snapshot
pipeline. Scans a snapshot's bug list for submodule values that LOOK like
duplicates but aren't already merged by parse.submodule()'s exact-alias +
fold-key logic (scripts/reports/parse.py) — typos ("Manager Customer" vs
"Manage Customer") or missing-word variants the conservative automatic fold
can't safely catch on its own. Prints candidate pairs (with occurrence
counts and a similarity score) for a human to review and, if genuine, add to
parse._SUBMODULE_ALIASES. Never auto-merges anything.

Usage:
    python3 scripts/find_submodule_dupes.py [path/to/snapshot.json]
    (defaults to dashboard/data/latest.json)
"""
import difflib
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from reports import parse  # noqa: E402

SIMILARITY_THRESHOLD = 0.72


def load_submodule_counts(path):
    with open(path) as f:
        snap = json.load(f)
    bugs_block = snap.get("bugs") or {}
    raw_bugs = bugs_block.get("open_bugs") or bugs_block.get("seven_day_bugs") or []
    counts = Counter()
    for b in raw_bugs:
        sub = b.get("submodule")
        if sub:
            counts[sub] += 1
    return counts


def find_candidates(counts):
    """One representative (most-common exact spelling) per fold-key — pairs
    ALREADY merged by submodule_fold_key() or _SUBMODULE_ALIASES are not
    candidates, since module_insights() already combines them."""
    by_key = {}
    for s, n in counts.items():
        key = parse.submodule_fold_key(s)
        cur = by_key.get(key)
        if cur is None or n > cur[1]:
            by_key[key] = (s, n)
    reps = list(by_key.items())

    candidates = []
    for i in range(len(reps)):
        key_a, (disp_a, n_a) = reps[i]
        for j in range(i + 1, len(reps)):
            key_b, (disp_b, n_b) = reps[j]
            ratio = difflib.SequenceMatcher(None, key_a, key_b).ratio()
            if ratio >= SIMILARITY_THRESHOLD:
                candidates.append((ratio, disp_a, n_a, disp_b, n_b))
    candidates.sort(key=lambda c: -c[0])
    return candidates


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "dashboard/data/latest.json"
    if not Path(path).exists():
        print("No snapshot found at %s" % path)
        return
    counts = load_submodule_counts(path)
    if not counts:
        print("No submodule data found in %s (bugs.open_bugs / seven_day_bugs empty?)" % path)
        return

    candidates = find_candidates(counts)
    if not candidates:
        print("No likely duplicate submodules found (similarity threshold %.2f)." % SIMILARITY_THRESHOLD)
        return

    print("Possible submodule duplicates — review before adding to parse._SUBMODULE_ALIASES:\n")
    for ratio, disp_a, n_a, disp_b, n_b in candidates:
        print("  %.2f  %-30s (%d)   vs   %-30s (%d)" % (ratio, disp_a, n_a, disp_b, n_b))


if __name__ == "__main__":
    main()
