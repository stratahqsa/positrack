"""Tests for scripts/release_schedule.py — the Release Schedule Tracker producer.

PURE/structural, offline, no network and no YT_TOKEN required — mirrors
tests/test_snapshot.py's idiom exactly. Exercises: two-pass story->epic matching,
epic-state-badge computation, story visibility rules, milestone grouping, and the
bug-drilldown link-chasing helper (via a monkeypatched yt.get_issues).
"""
import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(_ROOT, "scripts"))
sys.path.insert(0, os.path.join(_ROOT, "core"))
import release_schedule as rs  # noqa: E402
import ytcore as yt  # noqa: E402


# ---------- fixture builders ----------
def _linked_issue(iid, links=None):
    """Minimal raw-shaped issue for two-pass matching tests: only `id`/`links`
    matter to build_story_epic_map."""
    return {"id": iid, "links": links or []}


def _subtask_link(direction, parent_or_child_ids):
    return {
        "direction": direction,
        "linkType": {"name": "Subtask"},
        "issues": [{"idReadable": i} for i in parent_or_child_ids],
    }


def _relates_link(direction, ids):
    return {
        "direction": direction,
        "linkType": {"name": "Relates"},
        "issues": [{"idReadable": i} for i in ids],
    }


def _story(iid, state="Open", resolved=None, dev_est=0, ui_est=0, qa_est=0,
           spent=0, sprints=None, dev_deadline=None, qa_deadline=None):
    """A fully-normalized story dict (the _normalize() output shape)."""
    return {
        "id": iid, "summary": iid, "state": state, "assignee": "", "created": 1,
        "resolved": resolved, "dev_est": dev_est, "ui_est": ui_est, "qa_est": qa_est,
        "spent": spent, "dev_deadline": dev_deadline, "qa_deadline": qa_deadline,
        "sprints": sprints or [], "links": [],
    }


def _epic(iid, dev_deadline=None, qa_deadline=None, epic_done=None):
    e = _story(iid, dev_deadline=dev_deadline, qa_deadline=qa_deadline)
    if epic_done is not None:
        e["_epic_done"] = epic_done
    return e


# ---------- two-pass matching ----------
def test_pass1_direct_match():
    epics = [_linked_issue("PXB1-1")]
    stories = [_linked_issue("PXB1-2", links=[_subtask_link("INWARD", ["PXB1-1"])])]
    mapping, orphans = rs.build_story_epic_map(epics, stories)
    assert mapping == {"PXB1-2": "PXB1-1"}
    assert orphans == []


def test_pass2_single_hop_transitive():
    epics = [_linked_issue("PXB1-1")]
    # PXB1-2 -> direct epic (Pass 1). PXB1-3 -> parent is PXB1-2 (a story), not an
    # epic, so it must be resolved transitively in Pass 2.
    stories = [
        _linked_issue("PXB1-2", links=[_subtask_link("INWARD", ["PXB1-1"])]),
        _linked_issue("PXB1-3", links=[_subtask_link("INWARD", ["PXB1-2"])]),
    ]
    mapping, orphans = rs.build_story_epic_map(epics, stories)
    assert mapping["PXB1-2"] == "PXB1-1"
    assert mapping["PXB1-3"] == "PXB1-1"
    assert orphans == []


def test_pass2_multi_hop_transitive():
    epics = [_linked_issue("PXB1-1")]
    # 3-level chain: PXB1-4 -> PXB1-3 -> PXB1-2 -> epic PXB1-1.
    stories = [
        _linked_issue("PXB1-2", links=[_subtask_link("INWARD", ["PXB1-1"])]),
        _linked_issue("PXB1-3", links=[_subtask_link("INWARD", ["PXB1-2"])]),
        _linked_issue("PXB1-4", links=[_subtask_link("INWARD", ["PXB1-3"])]),
    ]
    mapping, orphans = rs.build_story_epic_map(epics, stories)
    assert mapping["PXB1-4"] == "PXB1-1"
    assert orphans == []


def test_orphan_story_never_dropped():
    epics = [_linked_issue("PXB1-1")]
    stories = [_linked_issue("PXB1-9", links=[])]  # no Subtask link at all
    mapping, orphans = rs.build_story_epic_map(epics, stories)
    assert "PXB1-9" not in mapping
    assert orphans == ["PXB1-9"]


def test_link_type_discrimination():
    epics = [_linked_issue("PXB1-1")]
    # A "Relates" link to the epic must NOT count as a Subtask parent match.
    stories = [_linked_issue("PXB1-2", links=[_relates_link("INWARD", ["PXB1-1"])])]
    mapping, orphans = rs.build_story_epic_map(epics, stories)
    assert mapping == {}
    assert orphans == ["PXB1-2"]


def test_direction_discrimination():
    epics = [_linked_issue("PXB1-1")]
    # An OUTWARD Subtask on the story (i.e. the story's own CHILD) must not be
    # mistaken for its parent epic — this is an easy bug to introduce by copying
    # ytcore._epic_stories' OUTWARD-filtered pattern without flipping direction.
    stories = [_linked_issue("PXB1-2", links=[_subtask_link("OUTWARD", ["PXB1-1"])])]
    mapping, orphans = rs.build_story_epic_map(epics, stories)
    assert mapping == {}
    assert orphans == ["PXB1-2"]


def test_pass1_always_wins_over_pass2():
    # PXB1-3 has BOTH a direct Subtask link to epic PXB1-1 (Pass 1) and a parent
    # story PXB1-2 that maps to a DIFFERENT epic PXB1-5 (would-be Pass 2 result).
    # Pass 1 must win.
    epics = [_linked_issue("PXB1-1"), _linked_issue("PXB1-5")]
    stories = [
        _linked_issue("PXB1-2", links=[_subtask_link("INWARD", ["PXB1-5"])]),
        _linked_issue(
            "PXB1-3",
            links=[_subtask_link("INWARD", ["PXB1-1", "PXB1-2"])],
        ),
    ]
    mapping, orphans = rs.build_story_epic_map(epics, stories)
    assert mapping["PXB1-3"] == "PXB1-1"


# ---------- epic-state badge ----------
def test_badge_zero_stories_shows_epic_own_state():
    text, done = rs.epic_state_badge([], "In Progress")
    assert text == "In Progress"
    assert done is False


def test_badge_zero_stories_done_epic():
    text, done = rs.epic_state_badge([], "Done")
    assert text == "Done"
    assert done is True


def test_badge_single_story_shows_literal_state():
    text, done = rs.epic_state_badge([_story("PXB1-2", state="In Review")], "Open")
    assert text == "In Review"
    assert done is False


def test_badge_all_done():
    stories = [_story("PXB1-2", state="Done"), _story("PXB1-3", state="Fixed")]
    text, done = rs.epic_state_badge(stories, "Open")
    assert text == "DONE"
    assert done is True


def test_badge_any_pending():
    stories = [_story("PXB1-2", state="Done"), _story("PXB1-3", state="Open")]
    text, done = rs.epic_state_badge(stories, "Open")
    assert text == "NOT DONE"
    assert done is False


# ---------- story visibility rules ----------
def test_visibility_not_done_epic_pending_story_visible():
    stories = [_story("PXB1-2", state="Open")]
    assert rs.visible_stories(False, stories) == stories


def test_visibility_not_done_epic_done_before_meeting_cutoff_hidden():
    before = rs.MEETING_CUTOFF_MS - 1000
    stories = [_story("PXB1-2", state="Done", resolved=before)]
    assert rs.visible_stories(False, stories) == []


def test_visibility_not_done_epic_done_after_meeting_cutoff_visible():
    after = rs.MEETING_CUTOFF_MS + 1000
    stories = [_story("PXB1-2", state="Done", resolved=after)]
    assert rs.visible_stories(False, stories) == stories


def test_visibility_cutoff_boundary_is_exclusive():
    exact = rs.MEETING_CUTOFF_MS
    stories = [_story("PXB1-2", state="Done", resolved=exact)]
    assert rs.visible_stories(False, stories) == []  # not strictly after -> hidden


def test_visibility_done_epic_before_jun29_hidden():
    before = rs.JUN29_CUTOFF_MS - 1000
    stories = [_story("PXB1-2", state="Done", resolved=before)]
    assert rs.visible_stories(True, stories) == []


def test_visibility_done_epic_after_jun29_visible():
    after = rs.JUN29_CUTOFF_MS + 1000
    stories = [_story("PXB1-2", state="Done", resolved=after)]
    assert rs.visible_stories(True, stories) == stories


# ---------- epic rollup ----------
def test_rollup_not_done_epic_uses_pending_only():
    pending = _story("PXB1-2", state="Open", dev_est=100, ui_est=50, qa_est=20, spent=10)
    done_after_meeting = _story(
        "PXB1-3", state="Done", resolved=rs.MEETING_CUTOFF_MS + 1000,
        dev_est=999, ui_est=999, qa_est=999, spent=999,
    )
    all_stories = [pending, done_after_meeting]
    visible = rs.visible_stories(False, all_stories)
    assert done_after_meeting in visible  # visible, but NOT in the rollup pool
    r = rs.epic_rollup(False, all_stories, visible)
    assert r["dev"] == 100 and r["ui"] == 50 and r["qa"] == 20 and r["spent"] == 10


def test_rollup_done_epic_uses_visible_only():
    visible_story = _story(
        "PXB1-2", state="Done", resolved=rs.JUN29_CUTOFF_MS + 1000,
        dev_est=40, ui_est=10, qa_est=5, spent=50,
    )
    hidden_story = _story(
        "PXB1-3", state="Done", resolved=rs.JUN29_CUTOFF_MS - 1000,
        dev_est=999, ui_est=999, qa_est=999, spent=999,
    )
    all_stories = [visible_story, hidden_story]
    visible = rs.visible_stories(True, all_stories)
    r = rs.epic_rollup(True, all_stories, visible)
    assert r["dev"] == 40 and r["ui"] == 10 and r["qa"] == 5 and r["spent"] == 50


# ---------- milestone grouping ----------
def test_milestone_same_day_different_ms_groups_together():
    day_start = 1_800_000_000_000  # arbitrary ms aligned enough for the test
    e1 = _epic("PXB1-1", dev_deadline=day_start + 1000)
    e2 = _epic("PXB1-2", dev_deadline=day_start + 5000)
    e1["_epic_done"] = e2["_epic_done"] = False
    groups = rs.group_by_milestone([e1, e2])
    assert len(groups) == 1
    assert len(groups[0]["epics"]) == 2


def test_milestone_groups_sort_ascending():
    e1 = _epic("PXB1-1", dev_deadline=2_000_000_000_000)
    e2 = _epic("PXB1-2", dev_deadline=1_000_000_000_000)
    e1["_epic_done"] = e2["_epic_done"] = False
    groups = rs.group_by_milestone([e1, e2])
    assert [g["epics"][0]["id"] for g in groups if g["date_ms"] is not None] == ["PXB1-2", "PXB1-1"]


def test_milestone_all_done_flag():
    e1 = _epic("PXB1-1", dev_deadline=1_000_000_000_000)
    e1["_epic_done"] = True
    e2 = _epic("PXB1-2", dev_deadline=1_000_000_000_000)
    e2["_epic_done"] = False
    all_done_group = rs.group_by_milestone([e1])[0]
    mixed_group = rs.group_by_milestone([e1, e2])[0]
    assert all_done_group["all_done"] is True
    assert mixed_group["all_done"] is False


def test_milestone_uses_whichever_deadline_present():
    e1 = _epic("PXB1-1", dev_deadline=1_000_000_000_000, qa_deadline=None)
    e2 = _epic("PXB1-2", dev_deadline=None, qa_deadline=1_000_000_000_000)
    assert rs.milestone_key(e1) == rs.milestone_key(e2)


def test_milestone_both_null_goes_to_trailing_bucket():
    e1 = _epic("PXB1-1", dev_deadline=1_000_000_000_000)
    e1["_epic_done"] = False
    e2 = _epic("PXB1-2")  # both deadlines None
    e2["_epic_done"] = False
    groups = rs.group_by_milestone([e1, e2])
    assert groups[-1]["date_ms"] is None
    assert groups[-1]["epics"] == [e2]


# ---------- bug drilldown (_children_by_parent + bug_drilldown) ----------
class _FakeCtx:
    pass


def test_children_by_parent_chunk_boundary(monkeypatch):
    """5 parent ids with chunk=2 must span 3 batches; results from every batch
    must be merged, not just the first (an easy 'losing a later chunk' bug)."""
    calls = []

    def fake_get_issues(ctx, query, fields="", top=300):
        calls.append(query)
        # One child per parent named in this batch's query, e.g. "issue ID: A, B".
        ids = query.replace("issue ID: ", "").split(", ")
        out = []
        for pid in ids:
            out.append({
                "idReadable": pid,
                "links": [_subtask_link("OUTWARD", [pid + "-child"])],
            })
        return out

    monkeypatch.setattr(rs.yt, "get_issues", fake_get_issues)
    parent_ids = ["P1", "P2", "P3", "P4", "P5"]
    result = rs._children_by_parent(_FakeCtx(), parent_ids, "Subtask", chunk=2)
    assert len(calls) == 3  # ceil(5/2)
    for pid in parent_ids:
        assert result[pid] == [pid + "-child"]


def test_bug_drilldown_no_dev_tickets_returns_empty(monkeypatch):
    monkeypatch.setattr(rs.yt, "get_issues", lambda ctx, q, fields="", top=300: [])
    assert rs.bug_drilldown(_FakeCtx(), ["PXB1-9"]) == {}


def test_bug_drilldown_excludes_closed_bugs(monkeypatch):
    def fake_get_issues(ctx, query, fields="", top=300):
        if "customFields" in fields and "summary" in fields:
            # bug-detail fetch
            return [
                {"idReadable": "PXB1-100", "summary": "Open bug",
                 "customFields": [{"name": "State", "value": {"name": "Open"}}]},
                {"idReadable": "PXB1-101", "summary": "Closed bug",
                 "customFields": [{"name": "State", "value": {"name": "Fixed"}}]},
            ]
        ids = query.replace("issue ID: ", "").split(", ")
        if ids == ["PXB1-9"]:  # story -> dev ticket hop
            return [{"idReadable": "PXB1-9",
                      "links": [_subtask_link("OUTWARD", ["PXB1-50"])]}]
        # dev ticket -> bugs hop
        return [{"idReadable": "PXB1-50", "links": [
            {"direction": "OUTWARD", "linkType": {"name": "Bugs Reported"},
             "issues": [{"idReadable": "PXB1-100"}, {"idReadable": "PXB1-101"}]},
        ]}]

    monkeypatch.setattr(rs.yt, "get_issues", fake_get_issues)
    result = rs.bug_drilldown(_FakeCtx(), ["PXB1-9"])
    assert len(result["PXB1-9"]) == 1
    assert result["PXB1-9"][0]["id"] == "PXB1-100"


# ---------- max_sprint / cf helpers ----------
def test_max_sprint_by_numeric_suffix():
    assert rs.max_sprint(["beta1-2", "beta1-19", "beta1-9"]) == "beta1-19"


def test_max_sprint_empty():
    assert rs.max_sprint([]) is None


def test_is_reopen_state_matches_variants():
    assert rs.is_reopen_state("Re-Open")
    assert rs.is_reopen_state("Reopen")
    assert not rs.is_reopen_state("Open")


# ---------- HTML rendering — light structural smoke tests ----------
def _minimal_report_data(epics=None):
    epics = epics or []
    for e in epics:
        e.setdefault("_all_stories", [])
        e.setdefault("_visible_stories", [])
        e.setdefault("_epic_state_badge", e.get("state", "—"))
        e.setdefault("_epic_done", False)
        e.setdefault("_resolved_date", None)
        e.setdefault("_rollup", {"dev": 0, "ui": 0, "qa": 0, "spent": 0, "sprint": None})
    return {
        "generated_at_iso": "x", "project": "PXB1", "scope": "PHASE 1",
        "engine_version": "test", "milestones": rs.group_by_milestone(epics),
        "orphan_story_ids": [], "bugs_by_story": {},
        "totals": {"dev": 0, "ui": 0, "qa": 0, "spent": 0, "epics_total": len(epics),
                   "epics_done": 0, "epics_pending": len(epics), "stories_total": 0,
                   "stories_done": 0, "stories_pending": 0, "open_bugs": 0,
                   "reopen_stories": 0, "total_est": 0, "remaining": 0},
        "final_ts": None, "milestone_count": 0,
    }


def test_render_html_contains_css_and_js_once():
    html_out = rs.render_html(_minimal_report_data())
    assert html_out.count(rs.CSS) == 1
    assert html_out.count(rs.JS) == 1
    assert html_out.startswith("<!DOCTYPE html>")
    assert html_out.endswith("</html>")


def test_render_story_row_has_all_twelve_columns():
    """Regression test: an earlier version of render_story_row silently dropped
    the QA Deadline cell (11 tds instead of 12, matching _TABLE_HEAD's 12
    columns) and threw a 'not enough arguments for format string' error."""
    story = _story("PXB1-2003", state="Re-Open", dev_est=60, ui_est=30, qa_est=10, spent=5)
    bugs = [{"id": "PXB1-9001", "summary": "Crash on save", "state": "Open"}]
    row = rs.render_story_row(story, bugs, "test_0")
    story_tr = row[: row.index("</tr>")]
    assert story_tr.count("<td") == len(rs._TABLE_HEAD.split("<th")) - 1
    assert "PXB1-9001" in row and "Crash on save" in row
    assert row.count("<tr") == 2  # the story row + one bug drill-down row


def test_render_html_done_badge_renders_with_style_hook():
    e = _epic("PXB1-1")
    e["_epic_done"] = True
    e["_epic_state_badge"] = "DONE"
    e["_all_stories"] = [_story("PXB1-2", state="Done")]
    e["_visible_stories"] = []
    e["_resolved_date"] = None
    e["_rollup"] = {"dev": 0, "ui": 0, "qa": 0, "spent": 0, "sprint": None}
    html_out = rs.render_html(_minimal_report_data([e]))
    assert "#15803d" in html_out and "DONE" in html_out
