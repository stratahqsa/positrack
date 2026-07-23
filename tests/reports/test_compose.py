# tests/reports/test_compose.py
from reports import bugs, schedule
from reports.config import ReportsConfig

def test_bugs_block_shape():
    cfg = ReportsConfig()
    # Minimal fake yt returning empty lists proves wiring + block keys exist.
    class FakeYT:
        def get_issues(self, *a, **k): return []
    b = bugs.build_bugs(ctx=None, yt=FakeYT(), cfg=cfg, now_ms=1752035640000)
    assert set(b) == {"window", "new_in_window", "open_high_older", "medium_by_state",
                      "low_by_state", "module_insights", "seven_day_bugs", "open_bugs", "kpi"}
    assert set(b["new_in_window"]) == {"High", "Medium", "Low"}
    assert b["kpi"]["total_open"] == 0

def test_urgent_folds_into_high_everywhere():
    # 2026-07-21: Urgent (this instance's top severity) must merge into the
    # "High" bucket in both the reporting-window section and the open/older
    # section — no separate Urgent section, one combined count under "High".
    cfg = ReportsConfig()
    now_ms = 1752035640000

    def raw(id_, priority, created):
        return {
            "idReadable": id_, "summary": "Sale: POS - x", "created": created, "resolved": None,
            "reporter": {"fullName": "QA"},
            "customFields": [
                {"name": "State", "value": {"name": "OPEN"}},
                {"name": "Priority", "value": {"name": priority}},
                {"name": "Module", "value": {"name": "Sale"}},
            ],
        }
    high_new, urgent_new = raw("PXB1-1", "High", now_ms), raw("PXB1-2", "Urgent", now_ms)
    high_old, urgent_old = raw("PXB1-3", "High", 0), raw("PXB1-4", "Urgent", 0)

    class FakeYT:
        def get_issues(self, ctx, query, fields=None):
            if "Priority: {Urgent}" in query:
                return [urgent_old]
            if "Priority: {High}" in query:
                return [high_old]
            if "created:" in query and "Priority" not in query:
                return [high_new, urgent_new]   # q1 (window) and q5 (7-day) both match
            return []

    b = bugs.build_bugs(ctx=None, yt=FakeYT(), cfg=cfg, now_ms=now_ms)
    assert {x["id"] for x in b["new_in_window"]["High"]} == {"PXB1-1", "PXB1-2"}
    assert {x["id"] for x in b["open_high_older"]} == {"PXB1-3", "PXB1-4"}
    assert b["kpi"]["open_high"] == 2
    assert b["kpi"]["new_high"] == 2
    # Sub-counts for the "· N Urgent" tile annotation: 1 Urgent in the window,
    # 1 Urgent among the open/older High bugs.
    assert b["kpi"]["new_urgent"] == 1
    assert b["kpi"]["open_urgent"] == 1
