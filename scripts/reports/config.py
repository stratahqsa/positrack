# scripts/reports/config.py
"""Re-baseline-able config for the PXB1 reports. Defaults reproduce the current
Phase-1 baseline; web/config/reports.json overrides any key. Changing baselines
for Phase 2 = edit that JSON, no code."""
import json, os
from dataclasses import dataclass, field

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(os.path.dirname(_HERE))
_DEFAULT_PATH = os.path.join(_ROOT, "web", "config", "reports.json")

# NOTE: "done" detection is a stable, phase-independent definition — the single
# source of truth is parse.DONE_STATES, deliberately NOT a per-phase config knob.

@dataclass
class ReportsConfig:
    project: str = "PXB1"
    scope: str = "PHASE 2"
    exclude_ids: list = field(default_factory=lambda: ["PXB1-3295"])
    include_epic_ids: list = field(default_factory=lambda: ["PXB1-%s" % x for x in "1787 3205 3274 3546 3977 4846 4847 4848 5104 9430 9999 10000 10171 10305 10316".split()])   # non-empty = track ONLY these epics
    android_epic_ids: list = field(default_factory=lambda: ["PXB1-3295", "PXB1-6372"])   # Android Status Report epics, merged into one list
    man_day_minutes: int = 480
    release_mode: str = "monthly"   # "monthly" = month-end releases from Sprint / QA deadline; "milestone" = Phase 1 behaviour
    jun29_cutoff_iso: str = "2026-10-06T00:00:00Z"   # Phase 2 baseline (Phase 1 was 29 Jun 2026)
    mtg_cutoff_iso: str = "2026-10-16T10:30:00Z"     # Phase 2 release to QA (Phase 1 was 3 Jul)
    week1_anchor: str = "2026-10-06"                 # Tue→Mon week 1 start (Phase 1: 2026-06-30)
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
