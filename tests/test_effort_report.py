"""Tests for the ported PXB1 Phase-1 Effort Report (core/ytcore.py effort_report).

Two layers:
  * PURE, fixture-based unit tests for the recipe logic — categorization, the
    pending-Phase-1 estimate rollup + epic-level fallback, the missing-estimate flag,
    the P2 activity-history filter, the story->epic spend attribution (incl. child-bug
    time), and the ISO->ms cutoff parse. No network; run with no token.
  * Recipe-TRAP guards that independently assert the subtle rules the report depends
    on (TaskType: EPIC not type: Epic; resolved-date query syntax; activity-based P2;
    PXB1-3295 excluded; man-day = 480; epic-estimate fallback).
  * A LIVE golden test (skipped without $YT_TOKEN) that runs effort_report at the
    frozen cutoff and asserts EXACT per-section counts + per-field man-day totals from
    a committed fixture (exact counts; +/-1 man-day tolerance on rollups/spend).

The golden fixture is tests/golden/effort_pxb1_phase1.json, captured from a real run.
"""
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "core"))
import ytcore as yt  # noqa: E402

GOLDEN = os.path.join(os.path.dirname(os.path.abspath(__file__)), "golden", "effort_pxb1_phase1.json")


# ---------- fixture builders (recipe-shaped issue dicts) ----------
def _cf(name, value):
    return {"name": name, "value": value}


def _story(sid, state, scope="PHASE 1", server=0, ui=0, testing=0, assignee="", spent=0):
    return {"idReadable": sid, "summary": sid, "created": 1,
            "assignee": ({"name": assignee} if assignee else None),
            "customFields": [_cf("State", {"name": state}), _cf("Scope", {"name": scope}),
                             _cf("Server Estimation", {"minutes": server}),
                             _cf("UI Estimation", {"minutes": ui}),
                             _cf("Testing Estimation", {"minutes": testing}),
                             _cf("Spent time", {"minutes": spent})]}


def _epic(eid, state, stories=(), server=0, ui=0, testing=0, resolved=None, assignee=""):
    return {"idReadable": eid, "summary": eid, "created": 1, "resolved": resolved,
            "assignee": ({"name": assignee} if assignee else None),
            "customFields": [_cf("State", {"name": state}),
                             _cf("Server Estimation", {"minutes": server}),
                             _cf("UI Estimation", {"minutes": ui}),
                             _cf("Testing Estimation", {"minutes": testing})],
            "links": [{"linkType": {"name": "Subtask"}, "direction": "OUTWARD",
                       "issues": list(stories)}] if stories else []}


# ---------- iso_to_ms (3.9-safe cutoff parse) ----------
def test_iso_to_ms_both_formats_utc():
    # 2026-06-29 10:30:00 UTC == 1782729000000 ms
    assert yt.iso_to_ms("2026-06-29T10:30:00.000Z") == 1782729000000
    assert yt.iso_to_ms("2026-06-29T10:30:00Z") == 1782729000000
    assert yt.iso_to_ms("") is None
    assert yt.iso_to_ms(None) is None


# ---------- man-day constant + DONE states (recipe traps) ----------
def test_man_day_is_480():
    assert yt.MAN_DAY == 480  # trap: a man-day is 8h; every md total divides by this


def test_done_states_substring_match():
    for s in ("DONE", "Fixed", "verified", "CLOSED", "Won't Fix", "Duplicate", "Obsolete"):
        assert yt.is_done_state(s), s
    for s in ("UI INTEGRATION", "READY FOR DEPLOYEMENT", "IN PROGRESS", "OPEN", ""):
        assert not yt.is_done_state(s), s


# ---------- categorize_epic: the four categories ----------
def test_categorize_done_zeroes_rollup():
    rec = yt.categorize_epic(_epic("E-1", "DONE", stories=[_story("S-1", "OPEN", server=480)]))
    assert rec["category"] == "DONE"
    assert rec["rollup"] == {"server": 0, "ui": 0, "testing": 0}
    assert rec["missing_est"] is False


def test_categorize_no_stories():
    rec = yt.categorize_epic(_epic("E-2", "OPEN"))
    assert rec["category"] == "NO_STORIES"


def test_categorize_pending_rollup_over_pending_p1_only():
    ep = _epic("E-3", "OPEN", stories=[
        _story("S-a", "IN PROGRESS", server=480, ui=0, testing=240),
        _story("S-b", "OPEN", server=60, ui=120, testing=0)])
    rec = yt.categorize_epic(ep)
    assert rec["category"] == "PENDING"          # stories, none done
    assert rec["rollup"] == {"server": 540, "ui": 120, "testing": 240}


def test_categorize_mixed_excludes_done_story_from_rollup():
    ep = _epic("E-4", "OPEN", stories=[
        _story("S-done", "DONE", server=100, ui=100, testing=100),   # excluded (done)
        _story("S-open", "OPEN", server=50, ui=0, testing=480)])     # counted
    rec = yt.categorize_epic(ep)
    assert rec["category"] == "MIXED"
    assert rec["rollup"] == {"server": 50, "ui": 0, "testing": 480}


def test_categorize_non_phase1_pending_story_excluded_from_rollup():
    # a pending story explicitly scoped PHASE 2 is not part of the Phase-1 rollup
    ep = _epic("E-5", "OPEN", stories=[
        _story("S-p2", "OPEN", scope="PHASE 2", server=999, ui=999, testing=999),
        _story("S-p1", "OPEN", scope="PHASE 1", server=30, ui=0, testing=60)])
    rec = yt.categorize_epic(ep)
    assert rec["rollup"] == {"server": 30, "ui": 0, "testing": 60}


def test_categorize_phase3_pending_story_also_excluded_from_rollup():
    # broadened 2026-07-18: a Phase 3 story is excluded from the rollup exactly
    # like a Phase 2 one, and counted in p2_stories/excluded from p1_pending.
    ep = _epic("E-5b", "OPEN", stories=[
        _story("S-p3", "OPEN", scope="PHASE 3", server=999, ui=999, testing=999),
        _story("S-p1", "OPEN", scope="PHASE 1", server=30, ui=0, testing=60)])
    rec = yt.categorize_epic(ep)
    assert rec["rollup"] == {"server": 30, "ui": 0, "testing": 60}
    assert rec["p2_stories"] == 1   # counts Phase 2 AND Phase 3 deferrals
    assert rec["p1_pending"] == 1   # only the Phase 1 story is still P1-pending


# ---------- per-story spend (Consensus: reuse the PM's scheduled-report recipe) ----------
def test_epic_stories_carry_own_spent_time_field():
    # each story's own "Spent time" custom field is read straight onto its dict,
    # separate from the epic-level work-item sweep (effort_report's rec["spent"]).
    ep = _epic("E-10", "OPEN", stories=[
        _story("S-a", "OPEN", server=480, spent=120),
        _story("S-b", "DONE", server=240, spent=600)])
    rec = yt.categorize_epic(ep)
    spent_by_id = {s["id"]: s["spent"] for s in rec["stories"]}
    assert spent_by_id == {"S-a": 120, "S-b": 600}


# ---------- epic-level estimate fallback (recipe trap, corrected scope) ----------
# Verified live against PXB1-513 / PXB1-414: the fallback used to apply per-field
# to every epic, so a genuinely-zero component on a real pending story (or an
# epic whose only pending stories were out-of-phase) silently pulled in the
# epic's own — often stale, all-stories-inclusive — Estimation fields. It's now
# scoped to NO_STORIES epics only, the sole case where the epic's own fields are
# the only estimate that exists.
def test_no_stories_epic_falls_back_to_own_estimate():
    ep = _epic("E-6", "OPEN", server=240, ui=60, testing=120)
    rec = yt.categorize_epic(ep)
    assert rec["category"] == "NO_STORIES"
    assert rec["rollup"] == {"server": 240, "ui": 60, "testing": 120}


def test_epic_with_stories_keeps_real_zero_no_fallback():
    # story rollup for UI is genuinely 0 (e.g. a backend-only story) and the epic
    # has its own UI 60 on record, but since the epic HAS stories, no fallback
    # substitution happens — the real zero is kept.
    ep = _epic("E-6b", "OPEN", ui=60, testing=120, stories=[
        _story("S-z", "OPEN", server=240, ui=0, testing=0)])
    rec = yt.categorize_epic(ep)
    assert rec["rollup"] == {"server": 240, "ui": 0, "testing": 0}


def test_out_of_phase_only_pending_story_yields_zero_rollup_no_fallback():
    # PXB1-414 shape: the epic has stories, but its only non-done story is
    # Phase 2 (out of scope) — p1p is empty even though `stories` isn't, so the
    # rollup should be a real zero, NOT a fallback to the epic's own (stale,
    # done-inclusive) Estimation fields.
    ep = _epic("E-414", "OPEN", server=999, ui=999, testing=999, stories=[
        _story("S-p2", "OPEN", scope="PHASE 2", server=100, ui=100, testing=100),
        _story("S-done", "DONE", scope="PHASE 1", server=500, ui=500, testing=500)])
    rec = yt.categorize_epic(ep)
    assert rec["category"] == "MIXED"
    assert rec["rollup"] == {"server": 0, "ui": 0, "testing": 0}


def test_missing_est_flag_rule():
    # (Dev=0 AND UI=0) OR QA=0
    dev_ui_zero = yt.categorize_epic(_epic("E-7", "OPEN", stories=[
        _story("S", "OPEN", server=0, ui=0, testing=480)]))
    assert dev_ui_zero["missing_est"] is True     # Dev=0 AND UI=0
    qa_zero = yt.categorize_epic(_epic("E-8", "OPEN", stories=[
        _story("S", "OPEN", server=480, ui=0, testing=0)]))
    assert qa_zero["missing_est"] is True         # QA=0
    ok = yt.categorize_epic(_epic("E-9", "OPEN", stories=[
        _story("S", "OPEN", server=480, ui=0, testing=240)]))
    assert ok["missing_est"] is False             # Dev>0 and QA>0


# ---------- P2/P3 activity-history filter (recipe trap: activity-based, not scope-field) ----------
# 2026-07-18 redesign (PXB1-2201): _scope_changed_p1_to_p2 (matched only on
# "PHASE 1 removed") was replaced by _scope_arrived_at_after_cutoff, called
# with the epic's CURRENT phase — so a multi-hop epic reports its most recent
# arrival, not its first departure from Phase 1. See its own docstring.
def test_scope_arrived_at_after_cutoff_ignores_before_cutoff_and_wrong_field():
    cut = 1782729000000
    acts = [
        {"field": {"name": "Scope"}, "timestamp": cut - 1,
         "removed": [{"name": "PHASE 1"}], "added": [{"name": "PHASE 2"}]},     # before cutoff -> no
        {"field": {"name": "Scope"}, "timestamp": cut + 1000,
         "removed": [{"name": "PHASE 1"}], "added": [{"name": "PHASE 2"}]},     # after -> yes
        {"field": {"name": "Priority"}, "timestamp": cut + 5,
         "removed": [{"name": "PHASE 1"}], "added": [{"name": "PHASE 2"}]},     # wrong field -> no
    ]
    assert yt._scope_arrived_at_after_cutoff(acts, cut, "PHASE 2") == cut + 1000


def test_scope_arrived_at_after_cutoff_multi_hop_reports_latest_arrival_at_current_phase():
    # PXB1-2201 shape: PHASE 1 -> PHASE 2 (day 5) -> PHASE 3 (day 10). Asking
    # for "PHASE 3" (the epic's current scope) must report day 10, not day 5.
    cut = 1782729000000
    day5 = cut + 5 * 86400000
    day10 = cut + 10 * 86400000
    acts = [
        {"field": {"name": "Scope"}, "timestamp": day5,
         "removed": [{"name": "PHASE 1"}], "added": [{"name": "PHASE 2"}]},
        {"field": {"name": "Scope"}, "timestamp": day10,
         "removed": [{"name": "PHASE 2"}], "added": [{"name": "PHASE 3"}]},
    ]
    assert yt._scope_arrived_at_after_cutoff(acts, cut, "PHASE 3") == day10
    assert yt._scope_arrived_at_after_cutoff(acts, cut, "PHASE 2") == day5


def test_scope_arrived_at_after_cutoff_finds_the_hop_regardless_of_removed():
    # this function only answers "when did `phase_name` get added after the
    # cutoff" — it doesn't require "PHASE 1" to appear in `removed` anywhere.
    # (Whether an epic with this exact activity shape belongs in the backlog
    # at all is _scope_at_or_before's job, tested below — PXB1-4916's shape
    # is precisely this one, and it's excluded at that eligibility layer, not
    # here.)
    cut = 1782729000000
    acts = [{"field": {"name": "Scope"}, "timestamp": cut + 2000,
             "removed": [{"name": "PHASE 2"}], "added": [{"name": "PHASE 3"}]}]
    assert yt._scope_arrived_at_after_cutoff(acts, cut, "PHASE 3") == cut + 2000


def test_scope_arrived_at_after_cutoff_ignores_reverse_and_empty():
    cut = 1782729000000
    reverse = [{"field": {"name": "Scope"}, "timestamp": cut + 5,
                "removed": [{"name": "PHASE 2"}], "added": [{"name": "PHASE 1"}]}]
    assert yt._scope_arrived_at_after_cutoff(reverse, cut, "PHASE 2") is None
    assert yt._scope_arrived_at_after_cutoff([], cut, "PHASE 2") is None


# ---------- P2/P3-backlog eligibility gate (PXB1-4916 vs PXB1-49) ----------
def test_scope_at_or_before_pxb1_4916_shape_was_already_p2_at_cutoff():
    # already PHASE 2 before the cutoff, later reclassified PHASE 2->PHASE 3
    # after it — scope AT the cutoff was PHASE 2, not PHASE 1, so this epic
    # must be excluded from the backlog regardless of the later hop.
    cut = 1782729000000
    acts = [
        {"field": {"name": "Scope"}, "timestamp": cut - 86400000,
         "removed": [{"name": "PHASE 1"}], "added": [{"name": "PHASE 2"}]},   # before cutoff
        {"field": {"name": "Scope"}, "timestamp": cut + 86400000,
         "removed": [{"name": "PHASE 2"}], "added": [{"name": "PHASE 3"}]},   # after cutoff
    ]
    assert yt._scope_at_or_before(acts, cut) == "PHASE 2"


def test_scope_at_or_before_pxb1_49_shape_was_p1_at_cutoff_then_left():
    # PHASE 1 at the cutoff (no Scope activity before it at all — constant
    # since creation), left afterward. Must be included.
    cut = 1782729000000
    acts = [{"field": {"name": "Scope"}, "timestamp": cut + 86400000,
             "removed": [{"name": "PHASE 1"}], "added": [{"name": "PHASE 2"}]}]
    assert yt._scope_at_or_before(acts, cut) == "PHASE 1"


def test_scope_at_or_before_uses_latest_change_at_or_before_cutoff():
    cut = 1782729000000
    acts = [
        {"field": {"name": "Scope"}, "timestamp": cut - 2000,
         "removed": [{"name": "PHASE 1"}], "added": [{"name": "PHASE 2"}]},
        {"field": {"name": "Scope"}, "timestamp": cut - 1000,   # later, still before cutoff -> wins
         "removed": [{"name": "PHASE 2"}], "added": [{"name": "PHASE 1"}]},
    ]
    assert yt._scope_at_or_before(acts, cut) == "PHASE 1"


def test_scope_at_or_before_none_when_no_scope_activity_at_all():
    assert yt._scope_at_or_before([], 1782729000000) is None


# ---------- spend attribution (Consensus Rev #2) ----------
def test_attribute_spend_epic_story_bug_and_unattributed():
    story_epic = {"S-1": "E-1", "S-2": "E-2"}
    bug_parent = {"BUG-1": "S-1", "BUG-2": "E-2"}      # bug under a story; bug under an epic
    epic_ids = ["E-1", "E-2"]
    items = [
        {"issue": "E-1", "minutes": 100},               # direct on epic
        {"issue": "S-1", "minutes": 50},                # on a story -> E-1
        {"issue": "S-2", "minutes": 30},                # on a story -> E-2
        {"issue": "BUG-1", "minutes": 20},              # bug -> S-1 -> E-1
        {"issue": "BUG-2", "minutes": 40},              # bug -> E-2 (parent is the epic)
        {"issue": "OTHER", "minutes": 7},               # unattributed (kept visible)
        {"issue": "E-1", "minutes": 0},                 # zero-minute entry ignored
    ]
    spend, un = yt._attribute_spend(items, story_epic, epic_ids, bug_parent)
    assert spend == {"E-1": 170, "E-2": 70}
    assert un == 7                                      # never silently dropped


def test_attribute_spend_does_not_use_issue_rollup():
    # Attribution is purely from work items; an epic with no work-item entries gets 0
    # spend even if (in reality) it carries a Spent-time rollup. Guards against
    # regressing to the issue-level rollup the recipe/plan forbids.
    spend, un = yt._attribute_spend([], {"S": "E"}, ["E"], {})
    assert spend == {} and un == 0


def test_build_story_epic_map_first_writer_wins():
    cats = [
        {"id": "E-1", "stories": [{"id": "S-1"}, {"id": "S-2"}]},
        {"id": "E-2", "stories": [{"id": "S-2"}, {"id": "S-3"}]},   # S-2 already mapped to E-1
    ]
    m = yt._build_story_epic_map(cats)
    assert m == {"S-1": "E-1", "S-2": "E-1", "S-3": "E-2"}


# ---------- report block rendering (pure, no network) ----------
def test_effort_blocks_render_sections_and_grand_total():
    rep = {
        "project": "PXB1", "scope": "PHASE 1", "cutoff_iso": "2026-06-29T10:30:00.000Z",
        "man_day": 480,
        "counts": {"done": 1, "pending": 1, "mixed": 0, "no_stories": 0, "p2_backlog": 1,
                   "epics_discovered": 3},
        "sections": {
            "done": [{"id": "E-D", "summary": "d", "assignee": "", "created": 1, "resolved": 2,
                      "rollup": {"server": 0, "ui": 0, "testing": 0}, "total": 0, "spent": 0,
                      "overshoot": False, "missing_est": False, "stories": []}],
            "pending": [{"id": "E-P", "summary": "p", "assignee": "Lead", "created": 1,
                         "rollup": {"server": 480, "ui": 0, "testing": 480}, "total": 960,
                         "spent": 1440, "overshoot": True, "missing_est": False, "stories": []}],
            "mixed": [], "no_stories": [],
            "p2_backlog": [{"id": "E-2P", "summary": "moved", "assignee": "", "created": 1,
                            "changed_at": 3}],
        },
        "totals": {
            "pending": {"server": 480, "ui": 0, "testing": 480, "total": 960, "spent": 1440},
            "mixed": {"server": 0, "ui": 0, "testing": 0, "total": 0, "spent": 0},
            "no_stories": {"server": 0, "ui": 0, "testing": 0, "total": 0, "spent": 0},
            "done": {"server": 0, "ui": 0, "testing": 0, "total": 0, "spent": 0},
            "grand_total": {"server": 480, "ui": 0, "testing": 480, "total": 960, "spent": 1440,
                            "server_md": 1.0, "ui_md": 0.0, "testing_md": 1.0, "total_md": 2.0,
                            "spent_md": 3.0},
        },
        "spend": {"scope_query": "project: PXB1", "total_minutes": 1440,
                  "unattributed_minutes": 0, "excluded": {"total": "5h 0m"}},
    }
    blocks = yt._effort_blocks(rep)
    kinds = [b["kind"] for b in blocks]
    assert kinds.count("table") == 5          # done, pending, mixed, no-stories, p2
    text = "\n".join(b["s"] for b in blocks if b["kind"] == "raw")
    assert "Grand Total" in text and "Total 2.0 man-days" in text
    # overshoot marker rides on the pending epic's Spent cell
    pend_tbl = [b for b in blocks if b["kind"] == "table"][1]
    assert any("⚠" in str(c) for row in pend_tbl["rows"] for c in row)


# ---------- LIVE golden test (skipped without a token) ----------
def _load_golden():
    with open(GOLDEN) as f:
        return json.load(f)


@pytest.mark.skipif(not os.environ.get("YT_TOKEN"),
                    reason="live golden test needs $YT_TOKEN (YouTrack); skipped in offline CI")
def test_effort_golden_live():
    """Run the ported report at the frozen cutoff and assert it reproduces the golden
    fixture: EXACT section counts + P2 id set; per-field man-day totals within +/-1."""
    golden = _load_golden()
    ctx = yt.Ctx(os.environ["YT_TOKEN"], os.environ.get("YT_BASE") or yt.DEFAULT_BASE)
    rep = yt.effort_report(ctx, project=golden["project"], scope=golden["scope"],
                           cutoff_iso=golden["cutoff_iso"],
                           exclude_ids=tuple(golden["excluded_ids"]))

    # exact section counts
    for k, v in golden["counts"].items():
        assert rep["counts"][k] == v, "count[%s]: got %d want %d" % (k, rep["counts"][k], v)

    # exact P2-backlog id set (activity-based discovery must be stable)
    assert sorted(e["id"] for e in rep["sections"]["p2_backlog"]) == sorted(golden["p2_ids"])

    # PXB1-3295 excluded from every section (recipe trap)
    all_ids = [e["id"] for sec in rep["sections"].values() for e in sec]
    assert "PXB1-3295" not in all_ids

    # per-field man-day totals within +/-1 man-day (worklog spend can drift a touch)
    for sec, want in golden["totals_md"].items():
        got = rep["totals"][sec]
        for field, wmd in want.items():
            gmd = round(got[field] / 480.0, 1)
            assert abs(gmd - wmd) <= 1.0, \
                "totals_md[%s][%s]: got %.1f want %.1f (+/-1)" % (sec, field, gmd, wmd)
