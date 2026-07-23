from reports import bug_blocker
from reports.config import ReportsConfig


def _ticket(tid, bug_ids):
    return {
        "idReadable": tid,
        "summary": "%s - Development" % tid,
        "links": [{
            "direction": "OUTWARD",
            "linkType": {"name": "Bugs Reported"},
            "issues": [{"idReadable": bid} for bid in bug_ids],
        }],
    }


def _bug(bid, priority, state="OPEN"):
    return {
        "idReadable": bid,
        "summary": "Bug %s" % bid,
        "customFields": [
            {"name": "State", "value": {"name": state}},
            {"name": "Priority", "value": {"name": priority}},
        ],
    }


class FakeYT:
    def __init__(self, tickets, bugs):
        self.tickets = tickets
        self.bugs = {b["idReadable"]: b for b in bugs}

    def get_issues(self, ctx, query, fields=None, limit=None, top=None):
        if "TaskType: Development" in query:
            return self.tickets
        # Bulk `issue ID: A, B, ...` queries return EVERY matching id (like the
        # real API) — build_bug_blocker batches its bug fetches since 2026-07-23.
        return [raw for bid, raw in self.bugs.items() if bid in query]


def test_high_priority_unresolved_bug_blocks_ticket():
    yt = FakeYT(
        tickets=[_ticket("PXB1-100", ["PXB1-900"])],
        bugs=[_bug("PXB1-900", "High")],
    )
    result = bug_blocker.build_bug_blocker(ctx=None, yt=yt, cfg=ReportsConfig())
    t = result["tickets"][0]
    assert t["status"] == "blocked"
    assert [b["id"] for b in t["blockingBugs"]] == ["PXB1-900"]
    assert t["lowPriorityBugs"] == []


def test_only_low_priority_bug_does_not_block():
    yt = FakeYT(
        tickets=[_ticket("PXB1-101", ["PXB1-901"])],
        bugs=[_bug("PXB1-901", "Low")],
    )
    result = bug_blocker.build_bug_blocker(ctx=None, yt=yt, cfg=ReportsConfig())
    t = result["tickets"][0]
    assert t["status"] == "ready"
    assert t["blockingBugs"] == []
    assert [b["id"] for b in t["lowPriorityBugs"]] == ["PXB1-901"]


def test_done_bug_is_excluded_entirely():
    yt = FakeYT(
        tickets=[_ticket("PXB1-102", ["PXB1-902"])],
        bugs=[_bug("PXB1-902", "Urgent", state="FIXED")],
    )
    result = bug_blocker.build_bug_blocker(ctx=None, yt=yt, cfg=ReportsConfig())
    t = result["tickets"][0]
    assert t["status"] == "ready"
    assert t["blockingBugs"] == [] and t["lowPriorityBugs"] == []


def test_ticket_with_no_linked_bugs_is_ready():
    yt = FakeYT(tickets=[_ticket("PXB1-103", [])], bugs=[])
    result = bug_blocker.build_bug_blocker(ctx=None, yt=yt, cfg=ReportsConfig())
    assert result["tickets"][0]["status"] == "ready"


def test_kpi_totals_sum_across_tickets():
    yt = FakeYT(
        tickets=[
            _ticket("PXB1-100", ["PXB1-900"]),
            _ticket("PXB1-101", ["PXB1-901"]),
            _ticket("PXB1-103", []),
        ],
        bugs=[_bug("PXB1-900", "High"), _bug("PXB1-901", "Low")],
    )
    result = bug_blocker.build_bug_blocker(ctx=None, yt=yt, cfg=ReportsConfig())
    assert result["kpi"] == {"total": 3, "blocked": 1, "ready": 2}


def test_urgent_and_medium_also_block():
    yt = FakeYT(
        tickets=[_ticket("PXB1-104", ["PXB1-904", "PXB1-905"])],
        bugs=[_bug("PXB1-904", "Urgent"), _bug("PXB1-905", "Medium")],
    )
    result = bug_blocker.build_bug_blocker(ctx=None, yt=yt, cfg=ReportsConfig())
    t = result["tickets"][0]
    assert t["status"] == "blocked"
    assert {b["id"] for b in t["blockingBugs"]} == {"PXB1-904", "PXB1-905"}
