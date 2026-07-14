# scripts/reports/config.py
"""Re-baseline-able config for the PXB1 reports. Defaults reproduce the current
Phase-1 baseline; web/config/reports.json overrides any key. Changing baselines
for Phase 2 = edit that JSON, no code."""
import json, os
from dataclasses import dataclass, field

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(os.path.dirname(_HERE))
_DEFAULT_PATH = os.path.join(_ROOT, "web", "config", "reports.json")

DEFAULT_DONE_STATES = ["done", "fixed", "verified", "closed", "won't fix", "duplicate", "obsolete"]

@dataclass
class ReportsConfig:
    project: str = "PXB1"
    scope: str = "PHASE 1"
    exclude_ids: list = field(default_factory=lambda: ["PXB1-3295"])
    man_day_minutes: int = 480
    jun29_cutoff_iso: str = "2026-06-29T10:30:00Z"   # 29 Jun 2026 4:00 PM IST
    mtg_cutoff_iso: str = "2026-07-03T10:30:00Z"     # 3 Jul 2026 4:00 PM IST
    week1_anchor: str = "2026-06-30"                 # Tue→Mon week 1 start
    done_states: list = field(default_factory=lambda: list(DEFAULT_DONE_STATES))
    youtrack_base: str = "https://support.posibolt.com"

def load_config(path=_DEFAULT_PATH):
    data = {}
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        data = {}
    known = {f.name for f in ReportsConfig.__dataclass_fields__.values()}
    return ReportsConfig(**{k: v for k, v in data.items() if k in known})
