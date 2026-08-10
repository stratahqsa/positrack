from reports import android

EPIC_RAW = {
    "id": "82-100", "idReadable": "PXB1-3295", "summary": "POS (Android)",
    "links": [
        {"direction": "OUTWARD", "linkType": {"name": "Subtask"}, "issues": [
            {"idReadable": "PXB1-3776"}, {"idReadable": "PXB1-3773"},
        ]},
    ],
}

STORY_OPEN = {
    "idReadable": "PXB1-3776", "summary": "Android: barcode scan",
    "created": 1700000000000, "resolved": None,
    "customFields": [
        {"name": "State", "value": {"name": "In Progress"}},
        {"name": "Assignee", "value": {"name": "Ravi K"}},
        {"name": "Server Estimation", "value": {"minutes": 120}},
        {"name": "UI Estimation", "value": {"minutes": 60}},
        {"name": "Testing Estimation", "value": {"minutes": 30}},
        {"name": "Spent time", "value": {"minutes": 90}},
    ],
    "links": [
        {"direction": "INWARD", "linkType": {"name": "Subtask"}, "issues": [
            {"idReadable": "PXB1-3295"},
        ]},
        {"direction": "OUTWARD", "linkType": {"name": "Subtask"}, "issues": [
            {"idReadable": "PXB1-3826", "links": [
                {"direction": "OUTWARD", "linkType": {"name": "Bugs Reported"},
                 "issues": [{"idReadable": "APP-908"}, {"idReadable": "APP-1012"}]},
            ]},
        ]},
    ],
}

STORY_DONE = {
    "idReadable": "PXB1-3773", "summary": "Android: login screen",
    "created": 1690000000000, "resolved": 1695000000000,
    "customFields": [
        {"name": "State", "value": {"name": "Done"}},
        {"name": "Assignee", "value": {"name": "Ravi K"}},
        {"name": "Server Estimation", "value": {"minutes": 60}},
        {"name": "UI Estimation", "value": {"minutes": 30}},
        {"name": "Testing Estimation", "value": {"minutes": 15}},
        {"name": "Spent time", "value": {"minutes": 100}},
    ],
    "links": [
        {"direction": "INWARD", "linkType": {"name": "Subtask"}, "issues": [
            {"idReadable": "PXB1-3295"},
        ]},
    ],
}

BUG_OPEN = {
    "idReadable": "APP-908", "summary": "Scan crashes on old device", "resolved": None,
    "customFields": [
        {"name": "State", "value": {"name": "Open"}},
        {"name": "Assignee", "value": {"name": "Zaid"}},
        # APP has no Priority field -- cf_name must gracefully return "".
    ],
}
BUG_CLOSED = {
    "idReadable": "APP-1012", "summary": "Old scan bug (stale)", "resolved": 123,
    "customFields": [{"name": "State", "value": {"name": "Closed"}}],
}


class FakeYT:
    def __init__(self, epic, stories, bugs):
        self.epic = epic
        self.stories = {s["idReadable"]: s for s in stories}
        self.bugs = {b["idReadable"]: b for b in bugs}
        self.queries = []

    def get_issues(self, ctx, query, fields=None, top=None, limit=None):
        self.queries.append(query)
        if query == "issue ID: %s" % self.epic["idReadable"]:
            return [self.epic]
        ids = query[len("issue ID: "):].split(", ")
        out = []
        for i in ids:
            if i in self.stories:
                out.append(self.stories[i])
            elif i in self.bugs:
                out.append(self.bugs[i])
        return out


def _yt():
    return FakeYT(EPIC_RAW, [STORY_OPEN, STORY_DONE], [BUG_OPEN, BUG_CLOSED])


def test_build_android_pulls_epics_own_direct_subtask_stories():
    block = android.build_android(ctx=None, yt=_yt())
    assert block["epicId"] == "PXB1-3295"
    assert block["epicName"] == "POS (Android)"
    assert [s["storyId"] for s in block["stories"]] == ["PXB1-3776", "PXB1-3773"]


def test_stories_reuse_schedule_parse_story_shape():
    block = android.build_android(ctx=None, yt=_yt())
    open_story = block["stories"][0]
    assert open_story["state"] == "In Progress"
    assert open_story["done"] is False
    assert open_story["devEst"] == 120 and open_story["uiEst"] == 60 and open_story["qaEst"] == 30
    assert open_story["epicId"] == "PXB1-3295"


def test_bugs_attached_via_dev_ticket_bugs_reported_link():
    block = android.build_android(ctx=None, yt=_yt())
    open_story = block["stories"][0]
    assert {b["bugId"] for b in open_story["bugs"]} == {"APP-908", "APP-1012"}
    by_id = {b["bugId"]: b for b in open_story["bugs"]}
    # APP project has no Priority field -- must not crash, just blank.
    assert by_id["APP-908"]["priority"] == ""
    assert by_id["APP-908"]["devTicketId"] == "PXB1-3826"


def test_resolved_bugs_are_kept_not_dropped():
    # Unlike Weekly Deadline's RE-OPEN drill-down, Android shows the full bug
    # history per story (skill-report parity) -- a Closed bug stays in the
    # list, just flagged done=True instead of being filtered out.
    block = android.build_android(ctx=None, yt=_yt())
    by_id = {b["bugId"]: b for b in block["stories"][0]["bugs"]}
    assert by_id["APP-908"]["done"] is False
    assert by_id["APP-1012"]["done"] is True


def test_done_story_has_no_bugs():
    block = android.build_android(ctx=None, yt=_yt())
    done_story = block["stories"][1]
    assert done_story["done"] is True
    assert done_story["bugs"] == []


def test_kpi_counts():
    block = android.build_android(ctx=None, yt=_yt())
    assert block["kpi"] == {
        "total_stories": 2, "done_stories": 1, "open_stories": 1, "open_bugs": 1,
    }


def test_no_stories_returns_empty_block_no_crash():
    empty_epic = dict(EPIC_RAW, links=[])
    yt = FakeYT(empty_epic, [], [])
    block = android.build_android(ctx=None, yt=yt)
    assert block["stories"] == []
    assert block["kpi"] == {"total_stories": 0, "done_stories": 0, "open_stories": 0, "open_bugs": 0}
