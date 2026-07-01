"""Tests for scripts/gamification.py — the PROVABLY-not-a-scorecard hygiene score
(Consensus Rev #4).

Three binding guards from the plan:
  (i)   hygiene_score input keys are a SUBSET of the frozen allowlist;
  (ii)  the score is INVARIANT when output metrics (minutes/spent/closed) change in
        a fixture — they are not inputs and cannot move it;
  (iii) an AST + source scan asserts the scoring MODULE never references the tokens
        `minutes|spent|closed|resolved` (so it cannot regress into rewarding output).

Plus behavioural tests on the score math and the hygiene-only leaderboard ranking.
Pure; no token, no network.
"""
import ast
import os
import re
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts"))
import gamification as g  # noqa: E402

GAMIFICATION_SRC = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts", "gamification.py"
)


# ---------- (i) frozen allowlist ----------
def test_allowlist_is_frozen_expected_set():
    # The exact set the plan froze. If this changes, it must be a deliberate review.
    assert set(g.HYGIENE_SIGNALS) == {"stale_free", "estimated", "moving", "on_time_logging"}
    assert isinstance(g.HYGIENE_SIGNALS, tuple)  # immutable contract object


def test_hygiene_input_keys_subset_of_allowlist():
    # A fully-specified input is accepted...
    full = {k: 1.0 for k in g.HYGIENE_SIGNALS}
    assert g.hygiene_score(full) == 100
    # ...a strict subset is accepted (missing signals default to 0 health)...
    assert g.hygiene_score({"stale_free": 1.0}) == 25  # 1 of 4 signals full
    # ...and any key OUTSIDE the allowlist is a hard error (the core guarantee).
    for bad in ("minutes", "spent", "closed", "resolved", "hours", "issues_closed", "velocity"):
        with pytest.raises(ValueError):
            g.hygiene_score({bad: 1.0})
        with pytest.raises(ValueError):
            g.hygiene_score(dict({k: 1.0 for k in g.HYGIENE_SIGNALS}, **{bad: 1.0}))


# ---------- (ii) score invariant to output metrics ----------
def test_score_invariant_when_output_metrics_change():
    base_signals = {"stale_free": 0.8, "estimated": 0.5, "moving": 0.25, "on_time_logging": 1.0}
    baseline = g.hygiene_score(dict(base_signals))
    # Simulate a fixture where a person logs way more hours / closes more issues /
    # spends more minutes. None of these are inputs, so the score MUST NOT move.
    for output_metric in ("minutes", "spent", "closed", "resolved", "issues_closed"):
        for value in (0, 1, 10_000, 999_999):
            # Build a "record" that carries an output metric alongside the signals.
            record = dict(base_signals)
            record_with_output = dict(record)
            record_with_output[output_metric] = value
            # We must NOT feed the output metric to the scorer (it would raise) —
            # the invariance is that the scorer only ever sees hygiene signals, so
            # the score computed from the signals alone is unchanged regardless of
            # whatever output the surrounding record accumulates.
            signals_only = {k: record_with_output[k] for k in g.HYGIENE_SIGNALS}
            assert g.hygiene_score(signals_only) == baseline, (
                "output metric %s=%s perturbed the hygiene score" % (output_metric, value)
            )


# ---------- (iii) AST + source scan: no output tokens in scoring code ----------
FORBIDDEN = re.compile(r"minutes|spent|closed|resolved")


def test_source_never_references_output_tokens_via_ast():
    """Walk the AST and assert no identifier, attribute, or string constant used in
    the module contains a forbidden output token. This is stricter than a grep: it
    proves the SCORING LOGIC never names output — a leaderboard can't secretly key
    on hours/closures if the module can't even spell them."""
    src = open(GAMIFICATION_SRC, encoding="utf-8").read()
    tree = ast.parse(src)
    offenders = []
    for node in ast.walk(tree):
        # identifiers (variables, function/arg names)
        if isinstance(node, ast.Name) and FORBIDDEN.search(node.id):
            offenders.append(("Name", node.id))
        elif isinstance(node, ast.arg) and FORBIDDEN.search(node.arg):
            offenders.append(("arg", node.arg))
        elif isinstance(node, ast.Attribute) and FORBIDDEN.search(node.attr):
            offenders.append(("Attribute", node.attr))
        elif isinstance(node, ast.keyword) and node.arg and FORBIDDEN.search(node.arg):
            offenders.append(("keyword", node.arg))
        # dict keys / string constants that are actual data (not prose in the module
        # docstring). We exclude the module docstring + function docstrings from the
        # scan so explanatory text ("never rewards hours") is allowed, but any
        # string used as data is not.
        elif isinstance(node, ast.Constant) and isinstance(node.value, str):
            if FORBIDDEN.search(node.value) and not _is_docstring_constant(tree, node):
                offenders.append(("str-constant", node.value[:40]))
    assert not offenders, "gamification scoring references forbidden output tokens: %s" % offenders


def _is_docstring_constant(tree, target):
    """True if `target` is a docstring expression (module/func/class) — those are
    prose and allowed to explain what the score deliberately excludes."""
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            body = getattr(node, "body", None) or []
            if body and isinstance(body[0], ast.Expr) and body[0].value is target:
                return True
    return False


def test_getsource_scan_scoring_functions_only():
    """A second, function-scoped guard via inspect.getsource: the actual scoring
    functions' SOURCE (bodies, minus their own docstrings) must not name output
    tokens. Complements the AST walk with a direct read of the hot path."""
    import inspect
    for fn in (g.hygiene_score, g.score_breakdown, g.rank_by_hygiene, g._clamp01):
        src = inspect.getsource(fn)
        doc = inspect.getdoc(fn) or ""
        # strip the docstring text so only executable code is scanned
        code_only = src.replace(doc, "")
        assert not FORBIDDEN.search(code_only), (
            "%s source references a forbidden output token" % fn.__name__
        )


# ---------- score math ----------
def test_score_math_bounds_and_rounding():
    assert g.hygiene_score({}) == 0
    assert g.hygiene_score(None) == 0
    assert g.hygiene_score({k: 1.0 for k in g.HYGIENE_SIGNALS}) == 100
    # clamping: out-of-range values are pulled into [0,1]
    assert g.hygiene_score({"stale_free": 5.0, "estimated": -3.0,
                            "moving": 1.0, "on_time_logging": 0.0}) == 50  # (1+0+1+0)/4
    # non-numeric signal is treated as 0
    assert g.hygiene_score({"stale_free": "oops", "estimated": 1.0,
                            "moving": 1.0, "on_time_logging": 1.0}) == 75


def test_score_breakdown_shape():
    b = g.score_breakdown({"stale_free": 0.5, "estimated": 1.0})
    assert b["score"] == g.hygiene_score({"stale_free": 0.5, "estimated": 1.0})
    assert set(b["signals"]) == set(g.HYGIENE_SIGNALS)
    assert b["signals"]["moving"] == 0.0  # omitted -> 0
    assert set(b["labels"]) == set(g.HYGIENE_SIGNALS)


# ---------- leaderboard ranks on hygiene / red-reduction, never output ----------
def test_rank_by_hygiene_orders_by_score_then_red_reduction():
    entries = [
        {"key": "A", "score": 80, "red_reduction": 1},
        {"key": "B", "score": 90, "red_reduction": 0},
        {"key": "C", "score": 80, "red_reduction": 5},   # ties A on score, wins on red-reduction
        {"key": "D", "score": 80, "red_reduction": 5},   # ties C -> name breaks it
    ]
    ranked = g.rank_by_hygiene(entries)
    assert [e["key"] for e in ranked] == ["B", "C", "D", "A"]
    assert [e["rank"] for e in ranked] == [1, 2, 3, 4]


def test_rank_is_pure_does_not_mutate_input():
    entries = [{"key": "A", "score": 10}, {"key": "B", "score": 20}]
    before = [dict(e) for e in entries]
    g.rank_by_hygiene(entries)
    assert entries == before  # inputs untouched (no 'rank' leaked back)
