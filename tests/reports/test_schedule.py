from reports import parse, schedule

STORY = {  # Examples_4 §4 verbatim (trimmed)
    "id": "2-45872", "idReadable": "PXB1-3412", "summary": "Sales: Return to original tender",
    "created": 1750750200000, "resolved": None,
    "customFields": [
        {"name": "State", "value": {"name": "RE-OPEN"}},
        {"name": "Assignee", "value": {"name": "Fahad K"}},
        {"name": "Server Estimation", "value": {"minutes": 960}},
        {"name": "UI Estimation", "value": {"minutes": 480}},
        {"name": "Testing Estimation", "value": {"minutes": 240}},
        {"name": "Spent time", "value": {"minutes": 1110}},
        {"name": "Deadline Date", "value": 1751932800000},
        {"name": "QA Deadline", "value": 1752451200000},
        {"name": "Sprints", "value": [{"name": "Sprint 14"}, {"name": "Sprint 15"}]},
    ],
    "links": [
        {"direction": "INWARD", "linkType": {"name": "Subtask"},
         "issues": [{"id": "2-41200", "idReadable": "PXB1-3101"}]},
    ],
}

def test_parse_story():
    s = schedule.parse_story(STORY)
    assert s["storyId"] == "PXB1-3412" and s["state"] == "RE-OPEN" and s["done"] is False
    assert s["devEst"] == 960 and s["uiEst"] == 480 and s["qaEst"] == 240 and s["spent"] == 1110
    assert s["ddTs"] == 1751932800000 and s["qaTs"] == 1752451200000
    assert s["sprint"] == "Sprint 15"
    assert s["parentId"] == "PXB1-3101"        # Subtask INWARD

def test_two_pass_matching_direct_transitive_orphan():
    epics = {"PXB1-3101"}
    a = {"storyId": "PXB1-3412", "parentId": "PXB1-3101"}   # direct
    b = {"storyId": "PXB1-3520", "parentId": "PXB1-3412"}   # under a story
    c = {"storyId": "PXB1-3601", "parentId": None}          # orphan
    matched, orphans = schedule.match_epics([a, b, c], epics)
    assert matched["PXB1-3412"] == "PXB1-3101"
    assert matched["PXB1-3520"] == "PXB1-3101"              # transitive
    assert orphans == ["PXB1-3601"]

# --- Step 5: remaining coverage from Examples_4 §6/§9 ---

def _ms(date_str):
    """'YYYY-MM-DD' -> epoch ms at UTC midnight, via the already-tested
    iso_to_ms (which requires a full 'T..Z' timestamp)."""
    return parse.iso_to_ms(date_str + "T00:00:00Z") if date_str else None

def _raw_story(story_id, state, resolved_iso, dd_iso, qa_iso, d_min, u_min, q_min):
    """Minimal raw story builder for the §6 truth table. Omits a date custom
    field entirely (rather than emitting a null value) when its *_iso is None,
    matching how an unset YouTrack date field is actually absent from the
    customFields list."""
    cf = [{"name": "State", "value": {"name": state}}]
    if dd_iso:
        cf.append({"name": "Deadline Date", "value": _ms(dd_iso)})
    if qa_iso:
        cf.append({"name": "QA Deadline", "value": _ms(qa_iso)})
    cf += [
        {"name": "Server Estimation", "value": {"minutes": d_min}},
        {"name": "UI Estimation", "value": {"minutes": u_min}},
        {"name": "Testing Estimation", "value": {"minutes": q_min}},
    ]
    return {
        "id": "2-" + story_id.rsplit("-", 1)[-1], "idReadable": story_id,
        "resolved": _ms(resolved_iso),
        "customFields": cf,
    }

def test_section6_truth_table_parsed_fields():
    # Examples_4 §6 — the inclusion filter itself (done-too-early / missing
    # deadline / beyond WEEK_END) is a view-layer concern deferred to Plan 2.
    # Here we pin that parse_story extracts done/resolved/ddTs/qaTs/estimates
    # correctly for every row in the table so that filter has correct inputs.
    rows = [
        # story_id,     state,          resolved_iso,   dd_iso,        qa_iso,        (dev,ui,qa) ests, done?
        ("PXB1-3412", "RE-OPEN",      None,            "2026-07-08", "2026-07-14", (960, 480, 240), False),
        ("PXB1-3390", "DONE",         "2026-07-05",    "2026-07-03", "2026-07-06", (480, 0, 240),   True),
        ("PXB1-3255", "DONE",         "2026-06-25",    "2026-06-22", "2026-06-24", (480, 0, 240),   True),
        ("PXB1-3470", "OPEN",         None,            "2026-07-09", None,          (960, 0, 480),   False),
        ("PXB1-3488", "DEVELOPMENT",  None,            "2026-07-10", "2026-07-15", (0, 0, 0),        False),
        ("PXB1-3550", "OPEN",         None,            "2026-07-21", "2026-07-27", (480, 0, 240),   False),
        ("PXB1-3111", "OPEN",         None,            "2026-06-12", "2026-06-20", (960, 480, 480), False),
    ]
    for story_id, state, resolved_iso, dd_iso, qa_iso, ests, expect_done in rows:
        raw = _raw_story(story_id, state, resolved_iso, dd_iso, qa_iso, *ests)
        s = schedule.parse_story(raw)
        assert s["done"] is expect_done, story_id
        assert s["resolved"] == _ms(resolved_iso), story_id
        assert s["ddTs"] == _ms(dd_iso), story_id
        assert s["qaTs"] == _ms(qa_iso), story_id
        assert (s["devEst"], s["uiEst"], s["qaEst"]) == ests, story_id

def test_t18_sprint_max_shows_highest_numbered_sprint():
    # Examples_4 §9 T18: Sprints = ["Sprint 9", "Sprint 14"] → sprint field "Sprint 14"
    raw = _raw_story("PXB1-8888", "OPEN", None, "2026-07-10", "2026-07-15", 480, 0, 240)
    raw["customFields"].append({"name": "Sprints", "value": [{"name": "Sprint 9"}, {"name": "Sprint 14"}]})
    s = schedule.parse_story(raw)
    assert s["sprint"] == "Sprint 14"

def test_story_missing_deadline_date_field_yields_ddts_none():
    # Task 4 Step 5: a story whose "Deadline Date" custom field is entirely
    # absent (not just null-valued) → ddTs is None, no KeyError/crash.
    raw = _raw_story("PXB1-9999", "OPEN", None, dd_iso=None, qa_iso="2026-07-20",
                      d_min=480, u_min=0, q_min=240)
    s = schedule.parse_story(raw)
    assert s["ddTs"] is None
    assert s["qaTs"] == _ms("2026-07-20")
