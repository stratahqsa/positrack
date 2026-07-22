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
    assert w["window_start_str"] == "2026-07-08"
    assert w["seven_days_str"] == "2026-07-02"


def test_ist_window_monday_starts_friday_not_yesterday():
    # 2026-07-13 is a Monday. Run Mon 13 Jul 2026 09:00 IST == 2026-07-13T03:30:00Z.
    # Window must start the preceding Friday (10 Jul) 00:00 IST, not Sunday (12 Jul)
    # — a plain "yesterday" window would silently drop the whole weekend's bugs.
    now_ms = parse.iso_to_ms("2026-07-13T03:30:00Z")
    w = parse.ist_window(now_ms)
    assert w["start_ms"] == parse.iso_to_ms("2026-07-09T18:30:00Z")  # Fri 10 Jul 00:00 IST
    assert w["window_start_str"] == "2026-07-10"


def test_ist_window_non_monday_still_uses_yesterday():
    # 2026-07-14 is a Tuesday — must NOT get the Friday special-case.
    now_ms = parse.iso_to_ms("2026-07-14T03:30:00Z")
    w = parse.ist_window(now_ms)
    assert w["window_start_str"] == "2026-07-13"

def test_submodule_folds_casing_duplicates():
    assert parse.submodule("Product: Product category - x") == "Product Category"
    assert parse.submodule("Product: Product Category - x") == "Product Category"

def test_submodule_folds_confirmed_synonym_pairs():
    # 2026-07-21: user-confirmed canonical spellings for near-duplicate
    # free-text submodules that were splitting Module Insights counts.
    assert parse.submodule("Product: Product Imports - x") == "Product Import"
    assert parse.submodule("Product: Product Import - x") == "Product Import"
    assert parse.submodule("Purchase: Payable Management - x") == "Payables Management"
    assert parse.submodule("Purchase: Payables Management - x") == "Payables Management"
    assert parse.submodule("Purchase: Receive Goods - x") == "Goods Receipt"
    assert parse.submodule("Purchase: Goods Receipt - x") == "Goods Receipt"
    assert parse.submodule("Sale: POS Screen - x") == "POS"
    assert parse.submodule("Sale: Web POS - x") == "POS"
    assert parse.submodule("Sale: POS - x") == "POS"
    assert parse.submodule("Customers: Manage customer - x") == "Manage Customer"
    assert parse.submodule("Customers: Manage Customers - x") == "Manage Customer"
    assert parse.submodule("Customers: Manager Customer - x") == "Manage Customer"   # typo
    assert parse.submodule("POS Register App: Customer settlement - x") == "Customer Settlement"

def test_submodule_folds_more_confirmed_synonym_pairs():
    # 2026-07-22: second round of user-confirmed canonical spellings.
    assert parse.submodule("Sale: Laybuy Report - x") == "Laybuy Report"
    assert parse.submodule("Sale: Laybuy report - x") == "Laybuy Report"
    assert parse.submodule("Purchase: Purchase Return - x") == "Purchase Return"
    assert parse.submodule("Purchase: Purchase Returns - x") == "Purchase Return"
    assert parse.submodule("Purchase: RG - x") == "Goods Receipt"
    assert parse.submodule("Reports: Stock Valuation - x") == "Stock Valuation Report"
    assert parse.submodule("Reports: Stock Valuation Report - x") == "Stock Valuation Report"

def test_submodule_fold_key_folds_casing_and_trailing_plural():
    assert parse.submodule_fold_key("Laybuy Report") == parse.submodule_fold_key("Laybuy report")
    assert parse.submodule_fold_key("Purchase Return") == parse.submodule_fold_key("Purchase Returns")
    # A short trailing word (an acronym like POS) must NOT be singular-folded.
    assert parse.submodule_fold_key("Web POS") == "web pos"
    assert parse.submodule_fold_key("POS") == "pos"
    # A double-s ending must not be stripped either.
    assert parse.submodule_fold_key("Database Access") == "database access"

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
