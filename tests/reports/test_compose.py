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
                      "low_by_state", "module_insights", "kpi"}
    assert set(b["new_in_window"]) == {"High", "Medium", "Low"}
    assert b["kpi"]["total_open"] == 0
