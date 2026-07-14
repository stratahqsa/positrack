import json, os
from reports.config import load_config, ReportsConfig

def test_defaults_when_no_file(tmp_path):
    cfg = load_config(path=str(tmp_path / "missing.json"))
    assert cfg.project == "PXB1"
    assert cfg.scope == "PHASE 1"
    assert cfg.exclude_ids == ["PXB1-3295"]
    assert cfg.man_day_minutes == 480
    # baselines are ISO strings that parse to the documented epoch ms
    assert cfg.jun29_cutoff_iso == "2026-06-29T10:30:00Z"
    assert cfg.mtg_cutoff_iso == "2026-07-03T10:30:00Z"
    assert cfg.week1_anchor == "2026-06-30"

def test_file_overrides_defaults(tmp_path):
    p = tmp_path / "reports.json"
    p.write_text(json.dumps({"project": "PXB2", "week1_anchor": "2026-09-01"}))
    cfg = load_config(path=str(p))
    assert cfg.project == "PXB2"          # overridden
    assert cfg.week1_anchor == "2026-09-01"
    assert cfg.scope == "PHASE 1"         # default retained
