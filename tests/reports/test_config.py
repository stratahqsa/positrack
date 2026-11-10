import json, os
from reports.config import load_config, ReportsConfig

def test_defaults_when_no_file(tmp_path):
    cfg = load_config(path=str(tmp_path / "missing.json"))
    assert cfg.project == "PXB1"
    assert cfg.scope == "PHASE 2"
    assert cfg.exclude_ids == ["PXB1-3295"]
    assert cfg.man_day_minutes == 480
    # baselines are ISO strings that parse to the documented epoch ms
    assert cfg.jun29_cutoff_iso == "2026-10-06T00:00:00Z"
    assert cfg.mtg_cutoff_iso == "2026-10-16T10:30:00Z"
    assert cfg.week1_anchor == "2026-10-06"

def test_file_overrides_defaults(tmp_path):
    p = tmp_path / "reports.json"
    p.write_text(json.dumps({"project": "PXB2", "week1_anchor": "2026-09-01"}))
    cfg = load_config(path=str(p))
    assert cfg.project == "PXB2"          # overridden
    assert cfg.week1_anchor == "2026-09-01"
    assert cfg.scope == "PHASE 2"         # default retained

def test_include_epic_ids_default_is_the_working_epic_list():
    cfg = load_config(path="/nonexistent.json")
    assert "PXB1-10171" in cfg.include_epic_ids and len(cfg.include_epic_ids) == 15


def test_release_mode_defaults_to_monthly():
    assert load_config(path="/nonexistent.json").release_mode == "monthly"


def test_android_epic_ids_default_includes_stock_take():
    assert ReportsConfig().android_epic_ids == ["PXB1-3295", "PXB1-6372"]


def test_auto_include_epics_defaults_on():
    assert ReportsConfig().auto_include_epics is True
