from reports import drilldown

STORY_LINKS = {  # Examples_4 §8 step 1
    "idReadable": "PXB1-3412",
    "links": [
        {"direction": "OUTWARD", "linkType": {"name": "Subtask"}, "issues": [
            {"idReadable": "PXB1-3488", "summary": "DEV: Return tender mapping", "links": [
                {"direction": "OUTWARD", "linkType": {"name": "Bugs Reported"},
                 "issues": [{"idReadable": "PXB1-3901"}, {"idReadable": "PXB1-3907"}]}]},
            {"idReadable": "PXB1-3489", "summary": "UI: Return screen", "links": []},
        ]},
    ],
}

def test_bug_candidates_from_links():
    cands = drilldown.bug_candidates(STORY_LINKS)
    # PXB1-3901/3907 via dev ticket PXB1-3488; PXB1-3489 has none
    assert cands == {"PXB1-3901": "PXB1-3488", "PXB1-3907": "PXB1-3488"}

def test_keep_open_only(monkeypatch):
    bug_states = {"PXB1-3901": "OPEN", "PXB1-3907": "Fixed"}
    def fake_get(bid):
        return {"idReadable": bid, "summary": "x", "resolved": None,
                "customFields": [{"name": "State", "value": {"name": bug_states[bid]}},
                                 {"name": "Priority", "value": {"name": "High"}},
                                 {"name": "Assignee", "value": {"name": "Fahad K"}}]}
    kept = drilldown.resolve_bugs({"PXB1-3901": "PXB1-3488", "PXB1-3907": "PXB1-3488"}, fake_get)
    assert [b["bugId"] for b in kept] == ["PXB1-3901"]    # Fixed dropped
    assert kept[0]["priority"] == "High" and kept[0]["devTicketId"] == "PXB1-3488"

# --- Step 5: remaining coverage from Examples_4 §9/§12 ---

def test_t9_reopen_story_one_open_one_fixed_shows_exactly_one_bug_row():
    # Examples_4 §9 T9: full path (bug_candidates -> resolve_bugs) over the
    # §8 fixture: 1 open + 1 fixed linked bug -> exactly 1 bug row, dev-ticket-linked.
    bug_states = {"PXB1-3901": "OPEN", "PXB1-3907": "Fixed"}
    def fake_get(bid):
        return {"idReadable": bid, "summary": "Sales: Return - amount rounds wrong",
                "customFields": [{"name": "State", "value": {"name": bug_states[bid]}},
                                  {"name": "Assignee", "value": {"name": "Fahad K"}},
                                  {"name": "Priority", "value": {"name": "High"}}]}
    cands = drilldown.bug_candidates(STORY_LINKS)
    kept = drilldown.resolve_bugs(cands, fake_get)
    assert len(kept) == 1
    assert kept[0] == {"bugId": "PXB1-3901", "summary": "Sales: Return - amount rounds wrong",
                        "state": "OPEN", "assignee": "Fahad K", "priority": "High",
                        "devTicketId": "PXB1-3488"}

def test_t10_dev_ticket_with_no_bugs_reported_links_no_crash():
    # Examples_4 §9 T10: dev ticket has no "Bugs Reported" links -> no candidates,
    # no crash. Covers both an explicit empty list and a missing "links" key.
    story_links = {
        "idReadable": "PXB1-9000",
        "links": [
            {"direction": "OUTWARD", "linkType": {"name": "Subtask"}, "issues": [
                {"idReadable": "PXB1-9001", "summary": "UI: no bugs field", "links": []},
                {"idReadable": "PXB1-9002", "summary": "UI: missing links key"},
            ]},
        ],
    }
    assert drilldown.bug_candidates(story_links) == {}

def test_section12_duplicate_bug_across_two_dev_tickets_deduped_and_fetched_once():
    # Examples_4 §12: same bug linked from two dev tickets -> de-duplicated by
    # bug ID before fetching (first dev ticket wins), so it is fetched exactly once.
    story_links = {
        "idReadable": "PXB1-3412",
        "links": [
            {"direction": "OUTWARD", "linkType": {"name": "Subtask"}, "issues": [
                {"idReadable": "PXB1-3488", "links": [
                    {"direction": "OUTWARD", "linkType": {"name": "Bugs Reported"},
                     "issues": [{"idReadable": "PXB1-3901"}]}]},
                {"idReadable": "PXB1-3489", "links": [
                    {"direction": "OUTWARD", "linkType": {"name": "Bugs Reported"},
                     "issues": [{"idReadable": "PXB1-3901"}, {"idReadable": "PXB1-3920"}]}]},
            ]},
        ],
    }
    cands = drilldown.bug_candidates(story_links)
    assert cands == {"PXB1-3901": "PXB1-3488", "PXB1-3920": "PXB1-3489"}  # first dev ticket wins

    fetch_calls = []
    def fake_get(bid):
        fetch_calls.append(bid)
        return {"idReadable": bid, "summary": "x",
                "customFields": [{"name": "State", "value": {"name": "OPEN"}}]}
    drilldown.resolve_bugs(cands, fake_get)
    assert fetch_calls.count("PXB1-3901") == 1   # fetched once despite 2 dev-ticket links
