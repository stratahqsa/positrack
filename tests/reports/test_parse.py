from reports import parse

def test_submodule_extraction():
    # from Examples_1 §6 worked table
    assert parse.submodule("Settings: Register- Placeholder text missing") == "Register"
    assert parse.submodule("Sale: Credit Note – wrong tax on return") == "Credit Note"   # en-dash
    assert parse.submodule("Reports: Stock Ledger — export empty") == "Stock Ledger"      # em-dash
    assert parse.submodule("Purchase: GRN") == "GRN"                                       # no dash
    assert parse.submodule("Login page broken") is None                                    # no colon
    assert parse.submodule("Accounts: Day Book - Pettycash - crash") == "Day Book"         # first dash only

def test_is_done_matches_substring_and_apostrophe():
    assert parse.is_done("Fixed") is True
    assert parse.is_done("Won't fix") is True
    assert parse.is_done("READY FOR DEPLOYEMENT") is False   # sic — real pending state
    assert parse.is_done("RE-OPEN") is False

def test_ist_window_worked_example():
    # Examples_1 §2 Example 1: run Thu 9 Jul 2026 10:04 IST == 2026-07-09T04:34:00Z
    now_ms = parse.iso_to_ms("2026-07-09T04:34:00Z")
    w = parse.ist_window(now_ms)
    assert w["start_ms"] == parse.iso_to_ms("2026-07-07T18:30:00Z")  # yesterday 00:00 IST
    assert w["end_ms"] == now_ms
    assert w["yesterday_str"] == "2026-07-08"
    assert w["seven_days_str"] == "2026-07-02"

def test_sprint_max_by_numeric_suffix():
    assert parse.sprint_max([{"name": "Sprint 9"}, {"name": "Sprint 14"}]) == "Sprint 14"
    assert parse.sprint_max([]) == ""

def test_cf_readers_handle_all_value_shapes():
    issue = {"customFields": [
        {"name": "State", "value": {"name": "RE-OPEN"}},
        {"name": "Server Estimation", "value": {"minutes": 960}},
        {"name": "Deadline Date", "value": 1751932800000},   # bare number
        {"name": "Sprints", "value": [{"name": "Sprint 14"}, {"name": "Sprint 15"}]},
        {"name": "Assignee", "value": None},
    ]}
    assert parse.cf_name(issue, "State") == "RE-OPEN"
    assert parse.cf_minutes(issue, "Server Estimation") == 960
    assert parse.cf_date_ms(issue, "Deadline Date") == 1751932800000
    assert parse.cf_name(issue, "Assignee") == ""           # null → ""
    assert parse.cf_minutes(issue, "UI Estimation") == 0     # absent → 0
