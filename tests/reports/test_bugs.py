from reports import bugs, parse

RAW = {  # Examples_1 §4 verbatim
    "id": "2-48231", "idReadable": "PXB1-3987",
    "summary": "Settings: Register- Placeholder text missing",
    "created": 1751971500000, "resolved": None,
    "reporter": {"fullName": "Divya S", "login": "divya.s"},
    "customFields": [
        {"name": "State", "value": {"name": "OPEN"}},
        {"name": "Priority", "value": {"name": "Medium"}},
        {"name": "Module", "value": {"name": "Settings"}},
        {"name": "Assignee", "value": {"name": "Rahul M"}},
    ],
}

def test_parse_bug():
    b = bugs.parse_bug(RAW)
    assert b == {
        "id": "PXB1-3987", "summary": "Settings: Register- Placeholder text missing",
        "created": 1751971500000, "state": "OPEN", "priority": "Medium",
        "module": "Settings", "submodule": "Register",
        "assignee": "Rahul M", "reporter": "Divya S",
    }

def test_reporter_falls_back_to_login():
    raw = dict(RAW, reporter={"login": "only.login"})
    assert bugs.parse_bug(raw)["reporter"] == "only.login"

def test_section_split_invariant():
    # Examples_1 §5 T6: 25 open High, 6 in window → Section 2 = 19, no overlap
    win_start = 1000
    q2 = [{"created": 500 + i} for i in range(19)] + [{"created": 1000 + i} for i in range(6)]
    old, new = bugs.split_high(q2, win_start)
    assert len(old) == 19 and len(new) == 6
    assert len(old) + len(new) == len(q2)
    assert all(b["created"] < win_start for b in old)

def test_state_breakdown_percentages_sum_100():
    open_med = [{"state": "TESTING"}] * 44 + [{"state": "OPEN"}] * 31 + [{"state": "RE-OPEN"}] * 18
    rows = bugs.state_breakdown(open_med)
    assert rows[0]["state"] == "TESTING" and rows[0]["count"] == 44
    assert abs(sum(r["pct"] for r in rows) - 100.0) < 0.5

def test_module_insights_top8_and_no_module_bucket():
    seven = ([{"summary": "Sale: Credit Note - x", "module": "Sale"}] * 7
             + [{"summary": "no colon here", "module": None}] * 2)
    mods = bugs.module_insights(seven)
    assert mods[0]["module"] == "Sale" and mods[0]["count"] == 7
    assert mods[0]["submodules"][0] == {"submodule": "Credit Note", "count": 7}
    assert any(m["module"] == "(No module)" for m in mods)

# --- Step 5: remaining coverage from Examples_1 §9 acceptance table ---

def test_t2_window_includes_bug_created_0015_ist_despite_earlier_utc_date():
    # Examples_1 §2 Example 3 / §9 T2: 8 Jul 00:15 IST = 2026-07-07T18:45:00Z —
    # UTC calendar date is 7 Jul, but epoch ms puts it inside the window.
    now_ms = parse.iso_to_ms("2026-07-09T04:34:00Z")   # report run: 9 Jul 10:04 AM IST
    w = parse.ist_window(now_ms)
    created = parse.iso_to_ms("2026-07-07T18:45:00Z")  # 8 Jul 00:15 IST
    assert bugs.in_window(created, w["start_ms"], w["end_ms"]) is True

def test_t3_window_excludes_bug_created_before_start():
    # Examples_1 §9 T3: bug created 7 Jul 11:59 PM IST → excluded from Section 1.
    now_ms = parse.iso_to_ms("2026-07-09T04:34:00Z")
    w = parse.ist_window(now_ms)
    created = parse.iso_to_ms("2026-07-07T18:29:00Z")  # 7 Jul 23:59 IST (1 min before WIN_START)
    assert bugs.in_window(created, w["start_ms"], w["end_ms"]) is False

def test_t11_null_module_groups_under_no_module_bucket():
    seven = [{"summary": "Login page broken", "module": None},
             {"summary": "Also no colon", "module": None},
             {"summary": "Crash on save", "module": None}]
    mods = bugs.module_insights(seven)
    assert mods == [{"module": "(No module)", "count": 3, "submodules": []}]

def test_module_insights_merges_submodule_near_duplicates():
    # 2026-07-21: "POS" / "POS Screen" / "Web POS" under the same Module used
    # to count as 3 separate submodule rows; must now merge into one.
    seven = ([{"summary": "Sale: POS - crash", "module": "Sale"}] * 2
             + [{"summary": "Sale: POS Screen - freeze", "module": "Sale"}] * 3
             + [{"summary": "Sale: Web POS - blank", "module": "Sale"}])
    mods = bugs.module_insights(seven)
    assert mods[0]["module"] == "Sale"
    assert mods[0]["submodules"] == [{"submodule": "POS", "count": 6}]

def test_module_insights_auto_merges_casing_and_plural_without_alias_entry():
    # 2026-07-22: NOT in parse._SUBMODULE_ALIASES — proves the generic
    # fold-key layer catches future casing/pluralization duplicates on its
    # own, without needing every future pair reported and added by hand.
    seven = ([{"summary": "Reports: Widget Config - a", "module": "Reports"}] * 4
             + [{"summary": "Reports: widget config - b", "module": "Reports"}]
             + [{"summary": "Reports: Widget Configs - c", "module": "Reports"}])
    mods = bugs.module_insights(seven)
    assert mods[0]["submodules"] == [{"submodule": "Widget Config", "count": 6}]

def test_module_insights_tie_break_prefers_title_case():
    seven = ([{"summary": "Reports: Widget Config - a", "module": "Reports"}]
             + [{"summary": "Reports: widget config - b", "module": "Reports"}])
    mods = bugs.module_insights(seven)
    assert mods[0]["submodules"] == [{"submodule": "Widget Config", "count": 2}]

def test_t13_reopen_and_open_are_distinct_state_breakdown_rows():
    # Examples_1 §9 T13: RE-OPEN must not be mis-bucketed as OPEN (exact-value
    # tally, no substring collapsing between the two states).
    open_bugs = [{"state": "OPEN"}] * 5 + [{"state": "RE-OPEN"}] * 3
    rows = bugs.state_breakdown(open_bugs)
    by_state = {r["state"]: r["count"] for r in rows}
    assert by_state == {"OPEN": 5, "RE-OPEN": 3}

# T16 (reporter fallback) is already covered by test_reporter_falls_back_to_login above.

DAY = 86400000.0
NOW = 1782729000000  # 2026-06-29T10:30:00Z, same fixed instant used elsewhere in this test suite

def _bug_aged(bug_id, age_days_val, **overrides):
    return dict({"id": bug_id, "created": int(NOW - age_days_val * DAY)}, **overrides)

def test_aging_buckets_high_urgent_thresholds_7_14_30():
    bugs_list = [
        _bug_aged("A", 3),    # below citable (7) -> excluded entirely
        _bug_aged("B", 7),    # exactly at citable boundary -> "7-13d"
        _bug_aged("C", 13.9), # "7-13d"
        _bug_aged("D", 14),   # exactly at medium boundary -> "14-29d"
        _bug_aged("E", 21),   # PXB1-8288-style case -> "14-29d"
        _bug_aged("F", 30),   # exactly at high boundary -> "30+d"
        _bug_aged("G", 90),   # "30+d"
    ]
    out = bugs.aging_buckets(bugs_list, bugs.AGING_THRESHOLDS_HIGH_URGENT, NOW)
    assert [b["range"] for b in out] == ["7-13d", "14-29d", "30+d"]
    assert [b["severity"] for b in out] == ["low", "medium", "high"]
    by_range = {b["range"]: [x["id"] for x in b["bugs"]] for b in out}
    assert by_range["7-13d"] == ["C", "B"]  # oldest first: 13.9d before 7d
    assert by_range["14-29d"] == ["E", "D"]  # oldest first: 21d before 14d
    assert by_range["30+d"] == ["G", "F"]    # oldest first: 90d before 30d
    assert [b["count"] for b in out] == [2, 2, 2]

def test_aging_buckets_medium_thresholds_are_double_high_urgent() :
    assert bugs.AGING_THRESHOLDS_MEDIUM == tuple(t * 2 for t in bugs.AGING_THRESHOLDS_HIGH_URGENT)

def test_aging_buckets_bug_younger_than_citable_threshold_excluded_from_every_bucket():
    out = bugs.aging_buckets([_bug_aged("A", 6.9)], bugs.AGING_THRESHOLDS_HIGH_URGENT, NOW)
    assert sum(b["count"] for b in out) == 0

def test_aging_buckets_annotates_age_days_rounded():
    out = bugs.aging_buckets([_bug_aged("A", 21.04)], bugs.AGING_THRESHOLDS_HIGH_URGENT, NOW)
    medium_bucket = next(b for b in out if b["range"] == "14-29d")
    assert medium_bucket["bugs"][0]["age_days"] == 21.0

def test_aging_buckets_bug_with_no_created_timestamp_excluded_not_crashed():
    out = bugs.aging_buckets([{"id": "NO-CREATED"}], bugs.AGING_THRESHOLDS_HIGH_URGENT, NOW)
    assert sum(b["count"] for b in out) == 0

def test_aging_buckets_empty_input_still_returns_three_buckets():
    out = bugs.aging_buckets([], bugs.AGING_THRESHOLDS_HIGH_URGENT, NOW)
    assert [b["range"] for b in out] == ["7-13d", "14-29d", "30+d"]
    assert [b["count"] for b in out] == [0, 0, 0]

def test_module_insights_high_urgent_style_filter_excludes_medium_low():
    # Mirrors build_bugs()'s own filter: module_insights([b for b in q6 if
    # b["priority"] in ("High", "Urgent")]) -- a module with mostly Medium/Low
    # bugs should NOT out-rank one with fewer but High/Urgent bugs once
    # pre-filtered this way.
    open_bugs = (
        [{"summary": "Sale: POS - a", "module": "Sale", "priority": "Low"}] * 20
        + [{"summary": "Purchase: RG - b", "module": "Purchase", "priority": "High"}] * 3
    )
    filtered = [b for b in open_bugs if b["priority"] in ("High", "Urgent")]
    mods = bugs.module_insights(filtered)
    assert mods[0]["module"] == "Purchase"
    assert mods[0]["count"] == 3
