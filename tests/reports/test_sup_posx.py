from reports import sup_posx

RAW = {
    "id": "3-1001", "idReadable": "SUP-4821",
    "summary": "POS X freezing on receipt print",
    "created": 1745000000000,
    "customFields": [
        {"name": "State", "value": {"name": "Escalated"}},
        {"name": "Location", "value": {"name": "SA"}},
        {"name": "Assignee", "value": {"name": "Rahul M"}},
    ],
}

def test_parse_ticket():
    t = sup_posx.parse_ticket(RAW)
    assert t == {
        "id": "SUP-4821", "summary": "POS X freezing on receipt print",
        "created": 1745000000000, "state": "Escalated", "location": "SA",
        "assignee": "Rahul M",
    }

def test_parse_ticket_blank_location_is_none():
    raw = dict(RAW, customFields=RAW["customFields"][:1] + RAW["customFields"][2:])
    assert sup_posx.parse_ticket(raw)["location"] is None

def test_breakdown_shape_and_sort_by_count_desc():
    tickets = (
        [{"state": "New"}] * 1
        + [{"state": "Escalated"}] * 3
        + [{"state": "On hold"}] * 4
    )
    rows = sup_posx._breakdown(tickets, "state", "(No state)")
    assert [r["state"] for r in rows] == ["On hold", "Escalated", "New"]
    assert [r["count"] for r in rows] == [4, 3, 1]
    assert rows[0]["bar"] == 1.0  # max bucket
    assert abs(sum(r["pct"] for r in rows) - 100.0) < 0.5

def test_breakdown_blank_key_uses_blank_label():
    tickets = [{"location": None}, {"location": "UAE"}]
    rows = sup_posx._breakdown(tickets, "location", "(No location)")
    by_label = {r["state"]: r["count"] for r in rows}
    assert by_label == {"(No location)": 1, "UAE": 1}

class FakeYT:
    def __init__(self, issues):
        self.issues = issues
        self.last_query = None

    def get_issues(self, ctx, query, fields=None):
        self.last_query = query
        return self.issues

def test_build_sup_posx_query_excludes_solved_and_closed():
    yt = FakeYT([])
    sup_posx.build_sup_posx(ctx=None, yt=yt, now_ms=1745100000000)
    assert "project: SUP" in yt.last_query
    assert "Type: {POS X}" in yt.last_query
    assert "State: -Solved" in yt.last_query
    assert "State: -Closed" in yt.last_query

def test_build_sup_posx_shapes_kpi_and_breakdowns():
    now_ms = 1745100000000  # ~1.157 days after RAW's created ts
    raw2 = dict(RAW, idReadable="SUP-4822", created=1744900000000, customFields=[
        {"name": "State", "value": {"name": "New"}},
        {"name": "Location", "value": {"name": "UAE"}},
    ])
    yt = FakeYT([RAW, raw2])
    block = sup_posx.build_sup_posx(ctx=None, yt=yt, now_ms=now_ms)
    assert block["kpi"]["pending"] == 2
    assert block["kpi"]["top_state"] in ("Escalated", "New")  # tie, either valid
    assert block["kpi"]["oldest_days"] == round((now_ms - 1744900000000) / 86400000.0, 1)
    assert {r["state"] for r in block["by_location"]} == {"SA", "UAE"}

def test_build_sup_posx_empty_result_has_null_kpi_fields():
    block = sup_posx.build_sup_posx(ctx=None, yt=FakeYT([]), now_ms=1745100000000)
    assert block["kpi"] == {"pending": 0, "oldest_days": None, "top_state": None, "top_location": None}
    assert block["tickets"] == []
    assert block["by_state"] == []
