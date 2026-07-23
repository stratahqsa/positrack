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


def test_report_myday_structure(monkeypatch):
    # myday composes proven primitives; verify its block shape with the network stubbed.
    ctx = yt.Ctx("perm-x")
    monkeypatch.setattr(yt, "count_soft", lambda c, q: 7)
    monkeypatch.setattr(yt, "get_issues",
                        lambda c, q, **k: [{"idReadable": "IS-1", "summary": "x", "customFields": [], "created": 1}])
    blocks = yt.report(ctx, "myday", days=5)
    assert [b["kind"] for b in blocks] == ["raw", "raw", "search", "raw", "search"]
    assert "Your day" in blocks[0]["s"] and "7 open" in blocks[0]["s"]
    assert "Stale" in blocks[1]["s"]
    assert blocks[2]["columns"] == ["id", "project", "summary", "State", "age"]


def test_report_hygiene_structure(monkeypatch):
    ctx = yt.Ctx("perm-x")
    # op=10 (plain open), st=3 (touched <30d), un=2, ue=2 -> hygiene 70%
    monkeypatch.setattr(yt, "count_soft",
                        lambda c, q: 3 if "updated" in q else (2 if ("Unassigned" in q or "Estimate" in q) else 10))
    blocks = yt.report(ctx, "hygiene", project="IS")
    assert blocks[0]["s"].startswith("# Board hygiene")
    tbl = blocks[1]
    assert tbl["kind"] == "table" and tbl["headers"][5] == "Hygiene"
    assert tbl["rows"][0][0] == "IS" and tbl["rows"][0][5] == "70%"
    assert "need attention" in blocks[2]["s"]


# ---------- true logged time (work items) ----------
def test_fmt_minutes():
    assert yt.fmt_minutes(0) == "0h 0m"
    assert yt.fmt_minutes(30) == "0h 30m"
    assert yt.fmt_minutes(110) == "1h 50m"
    assert yt.fmt_minutes(10910) == "181h 50m"   # the screenshot's QX Lead total
    assert yt.fmt_minutes(None) == "0h 0m"


def test_wi_norm_full_and_empty():
    w = {"duration": {"minutes": 90, "presentation": "1h 30m"},
         "issue": {"idReadable": "PXB1-5", "project": {"shortName": "PXB1"}},
         "author": {"login": "qx", "fullName": "QX Lead"},
         "type": {"name": "Development"}, "date": 1700000000000, "text": "did x"}
    n = yt._wi_norm(w)
    assert n["issue"] == "PXB1-5" and n["project"] == "PXB1"
    assert n["login"] == "qx" and n["author"] == "QX Lead"
    assert n["minutes"] == 90 and n["type"] == "Development"
    # missing pieces degrade gracefully (no KeyError, sensible placeholders)
    e = yt._wi_norm({})
    assert e["minutes"] == 0 and e["author"] == "(unknown)" and e["type"] == "(none)" and e["issue"] == ""


def test_aggregate_work_by_author_sorted_and_summed():
    items = [
        {"author": "QX Lead", "type": "Dev", "project": "PXB1", "issue": "PXB1-1", "minutes": 100},
        {"author": "QX Lead", "type": "QA",  "project": "PXB1", "issue": "PXB1-2", "minutes": 50},
        {"author": "Ajnas O", "type": "Dev", "project": "PXB1", "issue": "PXB1-1", "minutes": 200},
    ]
    r = yt.aggregate_work(items, "author")
    assert r["count"] == 3 and r["total_minutes"] == 350 and r["total"] == "5h 50m"
    g = r["groups"]
    assert [x["key"] for x in g] == ["Ajnas O", "QX Lead"]          # by time desc
    assert g[0]["minutes"] == 200 and g[0]["presentation"] == "3h 20m"
    assert g[1]["entries"] == 2 and g[1]["issues"] == 2             # 2 entries across 2 issues
    assert g[0]["bar"] and not g[1]["bar"].startswith("█" * 14)     # top bar fuller than the rest


def test_aggregate_work_empty_and_group_by_issue():
    assert yt.aggregate_work([], "author") == {
        "group_by": "author", "count": 0, "total_minutes": 0, "total": "0h 0m", "groups": []}
    items = [{"author": "a", "type": "Dev", "project": "P", "issue": "P-1", "minutes": 60},
             {"author": "b", "type": "Dev", "project": "P", "issue": "P-1", "minutes": 30}]
    r = yt.aggregate_work(items, "issue")
    assert r["groups"][0]["key"] == "P-1" and r["groups"][0]["minutes"] == 90 and r["groups"][0]["entries"] == 2


def test_wi_query_composition():
    assert yt._wi_query(sprint="beta1-19", project="PXB1") == "project: PXB1 Sprints: {beta1-19}"
    assert yt._wi_query(query="Type: Bug", project="P8") == "project: P8 Type: Bug"
    assert yt._wi_query(location="SA") == "Location: SA"
    assert yt._wi_query() == ""


def test_report_timespent_structure(monkeypatch):
    # timespent must read work items (not issues) and attribute by logger; stub the fetch.
    ctx = yt.Ctx("perm-x")
    fake = [
        {"author": {"fullName": "QX Lead"}, "duration": {"minutes": 100}, "issue": {"idReadable": "PXB1-1"}, "type": {"name": "Dev"}},
        {"author": {"fullName": "Ajnas O"}, "duration": {"minutes": 200}, "issue": {"idReadable": "PXB1-2"}, "type": {"name": "Dev"}},
    ]
    monkeypatch.setattr(yt, "work_items", lambda c, **k: fake)
    blocks = yt.report(ctx, "timespent", project="PXB1", sprint="beta1-19")
    assert blocks[0]["s"].startswith("# Time spent by person — sprint beta1-19")
    assert "who LOGGED" in blocks[1]["s"]
    tbl = blocks[2]
    assert tbl["kind"] == "table" and tbl["headers"] == ["Person", "Entries", "Issues", "Time", "▕"]
    assert tbl["rows"][0][0] == "Ajnas O"                           # sorted desc by time
    assert tbl["rows"][-1][0] == "**Total**" and tbl["rows"][-1][3] == "**5h 0m**"


def test_split_by_type_propagated():
    # The propagation workflow writes "Propagated from Bug ..." into the work-item
    # TEXT (type is usually empty), so match on that — not the type.
    items = [
        {"author": "a", "type": "Development", "text": "", "minutes": 60, "issue": "P-1"},
        {"author": "a", "type": "(none)", "text": "Propagated from Bug PXB1-3079", "minutes": 60, "issue": "P-2"},
        {"author": "b", "type": "", "text": "Propagated from Bug PXB1-3080", "minutes": 30, "issue": "P-3"},
        {"author": "b", "type": "QA", "text": "manual test run", "minutes": 15, "issue": "P-4"},
    ]
    kept, dropped = yt._split_by_type(items)                      # exclude_propagated default True
    assert [it["issue"] for it in kept] == ["P-1", "P-4"]
    assert len(dropped) == 2 and sum(d["minutes"] for d in dropped) == 90
    assert yt._split_by_type(items, exclude_propagated=False)[1] == []
    _, dropped3 = yt._split_by_type(items, exclude_propagated=False, exclude_types=["qa"])
    assert [d["issue"] for d in dropped3] == ["P-4"]


def _wi(author, minutes, issue, type_name=None, text=""):
    return {"author": {"fullName": author}, "duration": {"minutes": minutes},
            "issue": {"idReadable": issue}, "type": ({"name": type_name} if type_name else None), "text": text}


def test_time_spent_excludes_propagated(monkeypatch):
    ctx = yt.Ctx("perm-x")
    fake = [
        _wi("Sarjith", 100, "PXB1-9", "Development"),
        _wi("Sarjith", 300, "PXB1-1599", None, "Propagated from Bug PXB1-3079"),
        _wi("Aleena", 60, "PXB1-3", "Development"),
    ]
    monkeypatch.setattr(yt, "work_items", lambda c, **k: fake)
    d = yt.time_spent(ctx, project="PXB1", sprint="beta1-19")     # default: drop propagated
    assert d["count"] == 2 and d["total"] == "2h 40m"
    assert d["groups"][0]["key"] == "Sarjith" and d["groups"][0]["presentation"] == "1h 40m"
    assert d["excluded"] == {"entries": 1, "minutes": 300, "total": "5h 0m"}
    d2 = yt.time_spent(ctx, project="PXB1", exclude_propagated=False)
    assert d2["count"] == 3 and d2["total"] == "7h 40m" and "excluded" not in d2
    assert d2["groups"][0]["presentation"] == "6h 40m"           # Sarjith inflated by the propagated copy


def test_report_timespent_notes_exclusion(monkeypatch):
    ctx = yt.Ctx("perm-x")
    fake = [_wi("Sarjith", 100, "PXB1-9", "Development"),
            _wi("Sarjith", 300, "PXB1-1599", None, "Propagated from Bug PXB1-3079")]
    monkeypatch.setattr(yt, "work_items", lambda c, **k: fake)
    blocks = yt.report(ctx, "timespent", project="PXB1", sprint="beta1-19")
    assert "Excluded 5h 0m of workflow-propagated" in blocks[1]["s"]
    assert blocks[2]["rows"][-1][3] == "**1h 40m**"              # total is direct time only


def test_ctx_requires_token():
    try:
        yt.Ctx("")
        assert False, "expected YTError"
    except yt.YTError as e:
        assert e.status_code is None
    c = yt.Ctx("perm-x", "https://example.com/")
    assert c.token == "perm-x"
    assert c.base == "https://example.com"  # trailing slash stripped


# ---------- get_issues_by_ids (chunked bulk fetch) ----------
def test_get_issues_by_ids_chunks_and_preserves_order(monkeypatch):
    calls = []
    def fake_get_issues(ctx, query, fields="", top=200, limit=None):
        calls.append(query)
        ids = [t.strip() for t in query.replace("issue ID:", "").split(",")]
        return [{"idReadable": i} for i in reversed(ids)]  # scrambled on purpose
    monkeypatch.setattr(yt, "get_issues", fake_get_issues)
    ids = ["A-%d" % i for i in range(70)]
    out = yt.get_issues_by_ids(None, ids, fields="idReadable", chunk=30)
    assert [o["idReadable"] for o in out] == ids          # original order restored
    assert len(calls) == 3                                 # 30+30+10 -> 3 chunks


def test_get_issues_by_ids_skips_missing(monkeypatch):
    monkeypatch.setattr(yt, "get_issues",
                        lambda ctx, q, fields="", top=200, limit=None: [{"idReadable": "A-1"}])
    out = yt.get_issues_by_ids(None, ["A-1", "A-2"], fields="idReadable")
    assert [o["idReadable"] for o in out] == ["A-1"]


# ---------- timespent_from_items (pure pool rebuild) ----------
def _wi_fixture(issue, login, minutes, date=1, text=""):
    return {"issue": issue, "project": "PXB1", "login": login, "author": login,
            "minutes": minutes, "type": "(none)", "date": date, "text": text}


def test_timespent_from_items_matches_time_spent_shape():
    kept = [_wi_fixture("A-1", "amy", 60), _wi_fixture("A-2", "bob", 30)]
    dropped = [_wi_fixture("A-1", "amy", 60, text="Propagated from Bug A-9")]
    out = yt.timespent_from_items(kept, dropped, "project: PXB1")
    assert out["group_by"] == "author" and out["count"] == 2
    assert out["scope"] == "project: PXB1"
    assert out["excluded"] == {"entries": 1, "minutes": 60, "total": yt.fmt_minutes(60)}
    assert [g["key"] for g in out["groups"]] == ["amy", "bob"]


def test_timespent_from_items_no_dropped_no_excluded_key():
    out = yt.timespent_from_items([_wi_fixture("A-1", "amy", 10)], [], "s")
    assert "excluded" not in out and "window" not in out


def test_wi_scope_matches_private_builder():
    assert yt.wi_scope(project="PXB1", sprint="beta1-19") == "project: PXB1 Sprints: {beta1-19}"


def test_effort_report_accepts_injected_pool(monkeypatch):
    """Regression: the spend disclosure block must build from the injected pool
    (a live run caught `sweep` referenced-before-assignment when items were
    injected but the disclosure still read the internal sweep dict)."""
    monkeypatch.setattr(yt, "get_issues", lambda *a, **k: [])
    pool = {"scope": "project: PXB1",
            "items": [_wi_fixture("A-1", "amy", 60)],
            "dropped": [_wi_fixture("A-1", "amy", 30, text="Propagated from Bug A-9")]}
    rep = yt.effort_report(None, project="PXB1", scope="PHASE 1", pool=pool)
    assert rep["spend"]["scope_query"] == "project: PXB1"
    assert rep["spend"]["total_minutes"] == 60
    assert rep["spend"]["excluded"] == {"entries": 1, "minutes": 30, "total": yt.fmt_minutes(30)}
    assert rep["counts"]["epics_discovered"] == 0
