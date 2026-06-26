"""Unit tests for the pure (no-network) parts of core/ytcore.py.

Covers: period parsing, the typed custom-field builder per $type family, value
rendering, age math, scope clause building, the YTError model, and token
redaction. These never touch the network and run with no token.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "core"))
import ytcore as yt  # noqa: E402


# ---------- parse_period ----------
def test_parse_period_units():
    assert yt.parse_period("2h") == 120
    assert yt.parse_period("1d") == 480
    assert yt.parse_period("1h30m") == 90
    assert yt.parse_period("1w") == 2400
    assert yt.parse_period("45") == 45
    assert yt.parse_period("") is None
    assert yt.parse_period(None) is None
    assert yt.parse_period("90m") == 90
    assert yt.parse_period("2d4h") == 1200  # 2*480 + 4*60


# ---------- cf_entry (typed custom-field builder) ----------
def test_cf_entry_enum_single_and_multi():
    assert yt.cf_entry("Type", "enum[1]", "Bug") == {
        "name": "Type", "$type": "SingleEnumIssueCustomField", "value": {"name": "Bug"}}
    multi = yt.cf_entry("Tags", "enum[*]", "a, b")
    assert multi["$type"] == "MultiEnumIssueCustomField"
    assert multi["value"] == [{"name": "a"}, {"name": "b"}]


def test_cf_entry_state_user_period_date_numeric_text():
    assert yt.cf_entry("State", "state[1]", "Open")["$type"] == "StateIssueCustomField"
    assert yt.cf_entry("State", "state[1]", "Open")["value"] == {"name": "Open"}

    u1 = yt.cf_entry("Assignee", "user[1]", "jsmith")
    assert u1["$type"] == "SingleUserIssueCustomField"
    assert u1["value"] == {"login": "jsmith"}

    um = yt.cf_entry("Reviewers", "user[*]", "a,b")
    assert um["$type"] == "MultiUserIssueCustomField"
    assert um["value"] == [{"login": "a"}, {"login": "b"}]

    p = yt.cf_entry("Estimate", "period", "1h30m")
    assert p["$type"] == "PeriodIssueCustomField"
    assert p["value"] == {"minutes": 90}

    d = yt.cf_entry("Due", "date", "1700000000000")
    assert d["$type"] == "DateIssueCustomField"
    assert d["value"] == 1700000000000

    assert yt.cf_entry("Points", "integer", "5")["value"] == 5
    assert yt.cf_entry("Ratio", "float", "1.5")["value"] == 1.5
    assert yt.cf_entry("Module", "string", "Sale")["value"] == "Sale"

    t = yt.cf_entry("Notes", "text", "hello")
    assert t["$type"] == "TextIssueCustomField"
    assert t["value"] == {"$type": "TextFieldValue", "text": "hello"}


def test_cf_entry_version_family():
    v = yt.cf_entry("Fix versions", "version[*]", "1.0, 2.0")
    assert v["$type"] == "MultiVersionIssueCustomField"
    assert v["value"] == [{"name": "1.0"}, {"name": "2.0"}]


# ---------- vname / days_since ----------
def test_vname():
    assert yt.vname(None) == ""
    assert yt.vname({"name": "Bug"}) == "Bug"
    assert yt.vname({"login": "jsmith"}) == "jsmith"
    assert yt.vname({"fullName": "J Smith"}) == "J Smith"
    assert yt.vname([{"name": "a"}, {"name": "b"}]) == "a, b"
    assert yt.vname("plain") == "plain"


def test_days_since():
    assert yt.days_since(None) is None
    assert yt.days_since(0) is None  # falsy -> None
    val = yt.days_since(1)  # ~ now in days, large positive float
    assert isinstance(val, float) and val > 0


# ---------- scope_clause ----------
def test_scope_clause():
    assert yt.scope_clause("", "") == ""
    assert yt.scope_clause("IS", "") == "project: IS "
    assert yt.scope_clause("", "SA") == "Location: SA "
    assert yt.scope_clause("", "Saudi Arabia") == "Location: {Saudi Arabia} "
    assert yt.scope_clause("IS", "SA") == "project: IS Location: SA "


def test_search_query_strips():
    assert yt.search_query("#Unresolved", "IS", "") == "project: IS #Unresolved"
    assert yt.search_query("#Unresolved") == "#Unresolved"


# ---------- YTError + redaction ----------
def test_redact_strips_tokens():
    assert yt.redact("Bearer perm-abc123.def_456-XYZ leaked") == "Bearer perm-*** leaked"
    assert yt.redact("nothing here") == "nothing here"
    assert yt.redact("") == ""


def test_yterror_carries_structured_fields_and_redacts_raw():
    e = yt.YTError(403, "no permission", "raw body with perm-secrettoken123 inside")
    assert e.status_code == 403
    assert e.friendly_message == "no permission"
    assert "perm-secrettoken123" not in e.raw_body
    assert "perm-***" in e.raw_body
    assert str(e) == "no permission"


# ---------- visuals (bar / cell) ----------
def test_bar():
    assert yt.bar(5, 10, width=10) == "█████░░░░░"
    assert yt.bar(0, 10, width=10) == "░" * 10
    assert yt.bar(10, 10, width=10) == "█" * 10
    assert yt.bar(3, 0) == ""        # no scale -> empty
    assert yt.bar(None, 10) == ""    # missing value -> empty
    assert yt.bar(-1, 10) == ""      # transient sentinel -> empty


def test_cell():
    assert yt._cell(None) == "—"
    assert yt._cell(-1) == "…"
    assert yt._cell(5) == 5


def test_reassign_requires_scope():
    # The high-blast-radius guard must fire BEFORE any network call.
    ctx = yt.Ctx("perm-dummy")
    try:
        yt.reassign(ctx, "a@x.com", "b")
        assert False, "expected YTError (no project, not instance_wide)"
    except yt.YTError as e:
        assert e.status_code is None and "project scope" in e.friendly_message


def test_ctx_requires_token():
    try:
        yt.Ctx("")
        assert False, "expected YTError"
    except yt.YTError as e:
        assert e.status_code is None
    c = yt.Ctx("perm-x", "https://example.com/")
    assert c.token == "perm-x"
    assert c.base == "https://example.com"  # trailing slash stripped
