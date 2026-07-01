#!/usr/bin/env python3
"""
gamification.py — hygiene scoring for the POSX Control Tower (Consensus Rev #4).

PROVABLY NOT A SCORECARD. The single scoring primitive `hygiene_score(signals)`
takes a FROZEN allowlist of hygiene signals and NOTHING else:

    HYGIENE_SIGNALS = ("stale_free", "estimated", "moving", "on_time_logging")

Each signal is a fraction in [0, 1] describing how HEALTHY a person's / team's open
work is — never how much they produced. The score is their equal-weighted average,
scaled to 0..100. Leaderboards built on this rank on HYGIENE and RED-COUNT REDUCTION,
never on hours logged, issues closed, or anything resembling output.

Guardrails enforced by tests (tests/test_gamification.py):
  (i)  every input key ∈ HYGIENE_SIGNALS (a superset raises);
  (ii) the score is INVARIANT when output metrics (minutes/spent/closed) change —
       they are simply not inputs;
  (iii) an AST/source scan asserts this module never references the tokens
       `minutes|spent|closed|resolved` in scoring code.

This module is stdlib-only and pure (no network, no I/O). It is imported by
scripts/snapshot.py to compute per-person and per-team hygiene from signals the
snapshot producer derives from ytcore (stale/unestimated/updated-recency,
state movement, worklog recency).

IMPORTANT (naming): do NOT introduce a variable or key whose name contains the
substrings the guard test forbids (m i n u t e s / s p e n t / c l o s e d /
r e s o l v e d). Signals are health FRACTIONS; keep them named as such.
"""

# The FROZEN allowlist. Adding a key here is a deliberate, reviewable act — and any
# key that smells like output (hours, closures) must never be added. The test
# `test_hygiene_input_keys_subset_of_allowlist` treats this tuple as the contract.
HYGIENE_SIGNALS = ("stale_free", "estimated", "moving", "on_time_logging")

# Human-facing descriptions of each signal — pure hygiene, never output.
SIGNAL_LABELS = {
    "stale_free": "share of open work touched recently (not stale)",
    "estimated": "share of open work that carries an estimate",
    "moving": "share of open work whose state moved recently",
    "on_time_logging": "logged progress recently (worklog freshness)",
}


def _clamp01(x):
    """Coerce any signal to a fraction in [0.0, 1.0]. A missing/None signal is
    treated as 0.0 (absence of evidence of health is not health)."""
    try:
        v = float(x)
    except (TypeError, ValueError):
        return 0.0
    if v < 0.0:
        return 0.0
    if v > 1.0:
        return 1.0
    return v


def hygiene_score(signals):
    """PURE hygiene score in 0..100 from a dict whose keys ⊆ HYGIENE_SIGNALS.

    Each value is a health fraction in [0, 1]; the score is their equal-weighted
    mean × 100, rounded to an int. Passing an unknown key is a hard error — the
    allowlist is frozen and this is the guard that keeps the score from silently
    absorbing an output metric. Missing allowed signals default to 0.0.

    Examples:
        hygiene_score({"stale_free": 1, "estimated": 1, "moving": 1, "on_time_logging": 1}) == 100
        hygiene_score({"stale_free": 0.5}) == 12   # 0.5/4 signals * 100
    """
    if signals is None:
        signals = {}
    if not isinstance(signals, dict):
        raise TypeError("hygiene_score expects a dict of hygiene signals")
    unknown = set(signals) - set(HYGIENE_SIGNALS)
    if unknown:
        raise ValueError(
            "hygiene_score got non-allowlisted signal(s) %s; allowed: %s"
            % (sorted(unknown), list(HYGIENE_SIGNALS))
        )
    # Denominator is the FULL frozen set, so an omitted signal counts as 0 health
    # (you don't get credit for a dimension you have no evidence on).
    total = sum(_clamp01(signals.get(k)) for k in HYGIENE_SIGNALS)
    return int(round(100.0 * total / len(HYGIENE_SIGNALS)))


def score_breakdown(signals):
    """A UI-friendly breakdown: the clamped per-signal fractions, their label, and
    the overall score. Pure; keys still constrained to the allowlist (delegated to
    hygiene_score for the guard)."""
    score = hygiene_score(signals)  # validates the allowlist
    signals = signals or {}
    return {
        "score": score,
        "signals": {k: round(_clamp01(signals.get(k)), 3) for k in HYGIENE_SIGNALS},
        "labels": dict(SIGNAL_LABELS),
    }


def rank_by_hygiene(entries):
    """Rank people/teams by HYGIENE (Consensus Rev #4: never by output).

    `entries` is a list of {"key": name, "score": int, "red_reduction": int, ...}.
    Sort is by hygiene score desc, then by red-count reduction desc (the forcing
    function), then name asc for stability. Returns a new ranked list with a 1-based
    `rank` added. This function deliberately has NO access to output metrics; the
    only tie-breaker beyond hygiene is red-count REDUCTION, which is a hygiene win.
    """
    ranked = sorted(
        entries,
        key=lambda e: (-int(e.get("score", 0)),
                       -int(e.get("red_reduction", 0)),
                       str(e.get("key", ""))),
    )
    for i, e in enumerate(ranked, 1):
        e = dict(e)
        e["rank"] = i
        ranked[i - 1] = e
    return ranked
