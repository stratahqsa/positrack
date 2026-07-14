# Reports Dashboard — Plan 1: Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Python snapshot producer so one nightly/on-demand run fetches and *correctly parses* every piece of data the four PXB1 Phase-1 reports need — bugs, stories with deadlines, epic matching, and the RE-OPEN→bug drill-down — and emits them in the snapshot JSON, with fixture-based tests pinning every known YouTrack gotcha.

**Architecture:** New report-data modules live under `scripts/reports/` and are composed into the existing `scripts/snapshot.py::build_snapshot()`. They call the shared engine's public API (`ytcore.get_issues`, `GET`, `cf_map`, `vname`, `iso_to_ms`) — they do **not** modify `core/ytcore.py`, so the 3-way engine sync gate (`scripts/check_sync.sh`) is untouched. The Next.js app (Plans 2+) consumes the enriched snapshot and does all grouping/filtering client-side; this plan produces the *data*, not the views.

**Tech Stack:** Python 3.9+ (stdlib only, matching the engine), `pytest` for tests, JSON config at `web/config/reports.json`. Ground-truth specs live in `docs/reports-dashboard/reference/specs/`.

**Scope of THIS plan (and explicit non-scope):**
- ✅ Config, shared parsers, bug acquisition, story+epic+deadline acquisition, bug drill-down, snapshot composition, TS types.
- ❌ Milestone grouping, week-slot bucketing, health metrics — these are cheap and computed **client-side** in the view plans so filters stay instant. (Confirmed by spec §4/§8.)
- ❌ Any UI. That is Plan 2 onward.

**Reference (read before coding a task):** each task cites the exact in-repo guide, e.g. `docs/reports-dashboard/reference/specs/Examples_1_PXB1_Bug_Analysis_Implementation_Guide.md §6`. The guides contain full worked examples, JSON fixtures, and acceptance tables (T1…T20) — this plan includes the representative tests; **add the remaining T-rows from the cited table following the same pattern** when a task says so.

---

## File Structure

| File | Responsibility |
|---|---|
| `web/config/reports.json` (create) | The re-baseline-able config: project, scope, baselines, week anchor, excludes, done-states. |
| `scripts/reports/__init__.py` (create) | Package marker. |
| `scripts/reports/config.py` (create) | Load `reports.json` with hard defaults; expose a typed `ReportsConfig`. |
| `scripts/reports/parse.py` (create) | Shared pure parsers: custom-field readers, `is_done`, `submodule`, IST window, sprint-max, date/period readers. **No network.** |
| `scripts/reports/bugs.py` (create) | Bug acquisition + shaping (Bug Analysis source). |
| `scripts/reports/schedule.py` (create) | Epic+story acquisition, deadline parsing, 2-pass epic matching (Release Schedule + Weekly Deadline source). |
| `scripts/reports/drilldown.py` (create) | RE-OPEN story → dev ticket → open-bug drill-down. |
| `scripts/snapshot.py` (modify) | Compose `config`, `bugs`, `schedule` blocks into the snapshot. |
| `web/lib/types.ts` (modify) | Add `ReportsConfig`, `Bug`, `BugsBlock`, `ScheduleStory`, `ScheduleEpic`, `ScheduleBlock` and extend `Snapshot`. |
| `tests/reports/…` (create) | One test module per source file, fixture-driven. |
| `tests/reports/fixtures/*.json` (create) | Trimmed-but-production-shaped YouTrack payloads copied from the guides. |
| `tests/reports/conftest.py` (create) | Puts `scripts/` on `sys.path` so tests can `from reports import …`. |

---

## Task 0: Test harness

The repo has **no repo-wide conftest**; existing tests (`tests/test_snapshot.py`) insert `scripts/` + `core/` onto `sys.path` and import by bare name. Match that so `from reports import …` resolves.

**Files:**
- Create: `tests/reports/conftest.py`

- [ ] **Step 1: Create the conftest**

```python
# tests/reports/conftest.py
import os, sys
_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(_ROOT, "scripts"))   # enables `from reports import ...`
sys.path.insert(0, os.path.join(_ROOT, "core"))      # enables `import ytcore` if a test needs it
```

- [ ] **Step 2: Commit**

```bash
git add tests/reports/conftest.py
git commit -m "test(reports): conftest puts scripts/ on sys.path for reports imports"
```

---

## Task 1: Reports config (`config.py`)

**Files:**
- Create: `web/config/reports.json`
- Create: `scripts/reports/__init__.py` (empty)
- Create: `scripts/reports/config.py`
- Test: `tests/reports/test_config.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/reports/test_config.py
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
    assert "fixed" in cfg.done_states

def test_file_overrides_defaults(tmp_path):
    p = tmp_path / "reports.json"
    p.write_text(json.dumps({"project": "PXB2", "week1_anchor": "2026-09-01"}))
    cfg = load_config(path=str(p))
    assert cfg.project == "PXB2"          # overridden
    assert cfg.week1_anchor == "2026-09-01"
    assert cfg.scope == "PHASE 1"         # default retained
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/reports/test_config.py -v`
Expected: FAIL with `ModuleNotFoundError: scripts.reports.config`

- [ ] **Step 3: Write minimal implementation**

```python
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
```

- [ ] **Step 4: Create the config file**

```json
// web/config/reports.json
{
  "project": "PXB1",
  "scope": "PHASE 1",
  "exclude_ids": ["PXB1-3295"],
  "man_day_minutes": 480,
  "jun29_cutoff_iso": "2026-06-29T10:30:00Z",
  "mtg_cutoff_iso": "2026-07-03T10:30:00Z",
  "week1_anchor": "2026-06-30",
  "done_states": ["done", "fixed", "verified", "closed", "won't fix", "duplicate", "obsolete"],
  "youtrack_base": "https://support.posibolt.com"
}
```
> Note: JSON has no comments — remove the `//` line when creating the real file.

- [ ] **Step 5: Run test to verify it passes**

Run: `python -m pytest tests/reports/test_config.py -v`
Expected: PASS (2 passed)

- [ ] **Step 6: Commit**

```bash
git add scripts/reports/__init__.py scripts/reports/config.py web/config/reports.json tests/reports/test_config.py
git commit -m "feat(reports): re-baseline-able config module for the reports data layer"
```

---

## Task 2: Shared pure parsers (`parse.py`)

The gotcha-proofing layer. Every rule here comes from a guide; every rule has a test.
**Reference:** `Examples_1 §2,§6,§8`, `Examples_4 §4,§9`. Custom-field value shapes: period = `{"minutes": N}`, date = **bare number**, sprints = array, enum/state = `{"name": …}`.

**Files:**
- Create: `scripts/reports/parse.py`
- Test: `tests/reports/test_parse.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/reports/test_parse.py
from reports import parse

def test_submodule_extraction():
    # from Examples_1 §6 worked table
    assert parse.submodule("Settings: Register- Placeholder text missing") == "Register"
    assert parse.submodule("Sale: Credit Note – wrong tax on return") == "Credit Note"   # en-dash
    assert parse.submodule("Reports: Stock Ledger — export empty") == "Stock Ledger"      # em-dash
    assert parse.submodule("Purchase: GRN") == "GRN"                                       # no dash
    assert parse.submodule("Login page broken") is None                                    # no colon
    assert parse.submodule("Accounts: Day Book - Pettycash - crash") == "Day Book"         # first dash only

def test_is_done_matches_substring_and_apostrophe():
    assert parse.is_done("Fixed") is True
    assert parse.is_done("Won't fix") is True
    assert parse.is_done("READY FOR DEPLOYEMENT") is False   # sic — real pending state
    assert parse.is_done("RE-OPEN") is False

def test_ist_window_worked_example():
    # Examples_1 §2 Example 1: run Thu 9 Jul 2026 10:04 IST == 2026-07-09T04:34:00Z
    now_ms = parse.iso_to_ms("2026-07-09T04:34:00Z")
    w = parse.ist_window(now_ms)
    assert w["start_ms"] == parse.iso_to_ms("2026-07-07T18:30:00Z")  # yesterday 00:00 IST
    assert w["end_ms"] == now_ms
    assert w["yesterday_str"] == "2026-07-08"
    assert w["seven_days_str"] == "2026-07-02"

def test_sprint_max_by_numeric_suffix():
    assert parse.sprint_max([{"name": "Sprint 9"}, {"name": "Sprint 14"}]) == "Sprint 14"
    assert parse.sprint_max([]) == ""

def test_cf_readers_handle_all_value_shapes():
    issue = {"customFields": [
        {"name": "State", "value": {"name": "RE-OPEN"}},
        {"name": "Server Estimation", "value": {"minutes": 960}},
        {"name": "Deadline Date", "value": 1751932800000},   # bare number
        {"name": "Sprints", "value": [{"name": "Sprint 14"}, {"name": "Sprint 15"}]},
        {"name": "Assignee", "value": None},
    ]}
    assert parse.cf_name(issue, "State") == "RE-OPEN"
    assert parse.cf_minutes(issue, "Server Estimation") == 960
    assert parse.cf_date_ms(issue, "Deadline Date") == 1751932800000
    assert parse.cf_name(issue, "Assignee") == ""           # null → ""
    assert parse.cf_minutes(issue, "UI Estimation") == 0     # absent → 0
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/reports/test_parse.py -v`
Expected: FAIL (`ModuleNotFoundError: scripts.reports.parse`)

- [ ] **Step 3: Implement**

```python
# scripts/reports/parse.py
"""Pure parsers shared by all report-data modules. No network. Every rule is
pinned to a guide section and a test in tests/reports/test_parse.py."""
import datetime, re

IST = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
_DASH_RE = re.compile(r"[-–—]")  # hyphen, en-dash, em-dash
DONE_STATES = ("done", "fixed", "verified", "closed", "won't fix", "duplicate", "obsolete")

def iso_to_ms(iso):
    if not iso:
        return None
    s = str(iso).strip()
    fmt = "%Y-%m-%dT%H:%M:%S.%fZ" if "." in s else "%Y-%m-%dT%H:%M:%SZ"
    dt = datetime.datetime.strptime(s, fmt).replace(tzinfo=datetime.timezone.utc)
    return int(dt.timestamp() * 1000)

def _cf_value(issue, name):
    for cf in (issue.get("customFields") or []):
        if cf.get("name") == name:
            return cf.get("value")
    return None

def cf_name(issue, name):
    """`value.name` (enum/state/user) → str, or '' when absent/null."""
    v = _cf_value(issue, name)
    if isinstance(v, dict):
        return v.get("name") or v.get("fullName") or v.get("login") or ""
    return "" if v is None else str(v)

def cf_minutes(issue, name):
    """Period customField → minutes int, or 0."""
    v = _cf_value(issue, name)
    return int(v["minutes"]) if isinstance(v, dict) and v.get("minutes") else 0

def cf_date_ms(issue, name):
    """Date customField → epoch ms. Value is a BARE NUMBER on this instance
    (Examples_4 §4 gotcha 2); tolerate {'timestamp': n} defensively. None if unset."""
    v = _cf_value(issue, name)
    if isinstance(v, (int, float)):
        return int(v)
    if isinstance(v, dict) and v.get("timestamp"):
        return int(v["timestamp"])
    return None

def sprint_max(value):
    """Max sprint name by trailing numeric suffix (Examples_4 §4 gotcha 3)."""
    names = [s.get("name") for s in (value or []) if s and s.get("name")]
    if not names:
        return ""
    def key(n):
        m = re.search(r"(\d+)\s*$", n)
        return int(m.group(1)) if m else -1
    return max(names, key=key)

def is_done(state):
    """Case-insensitive substring match against DONE_STATES (Examples_4 §4)."""
    s = (state or "").lower()
    return any(d in s for d in DONE_STATES)

def submodule(summary):
    """Text after the FIRST colon, cut at the FIRST dash of any type; None if no
    colon (Examples_1 §6)."""
    if not summary or ":" not in summary:
        return None
    after = summary.split(":", 1)[1]
    part = _DASH_RE.split(after, 1)[0].strip()
    return part or None

def fmt_ist(ms):
    """Epoch ms → 'DD Mon YYYY, h:mm AM/PM' in IST (Examples_1 §4)."""
    dt = datetime.datetime.fromtimestamp(ms / 1000, IST)
    return dt.strftime("%d %b %Y, %-I:%M %p")

def ist_window(now_ms):
    """The Bug Analysis window: yesterday 00:00 IST → now (Examples_1 §2).
    Returns start_ms, end_ms, label, yesterday_str (YYYY-MM-DD), seven_days_str."""
    now_ist = datetime.datetime.fromtimestamp(now_ms / 1000, IST)
    today = now_ist.date()
    yest = today - datetime.timedelta(days=1)
    start_ist = datetime.datetime(yest.year, yest.month, yest.day, 0, 0, tzinfo=IST)
    start_ms = int(start_ist.timestamp() * 1000)
    return {
        "start_ms": start_ms,
        "end_ms": now_ms,
        "yesterday_str": yest.isoformat(),
        "seven_days_str": (today - datetime.timedelta(days=7)).isoformat(),
        "label": "%s → %s IST" % (fmt_ist(start_ms), fmt_ist(now_ms)),
    }
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/reports/test_parse.py -v`
Expected: PASS (5 passed). If `fmt_ist` `%-I` fails on the runner's platform, switch to `str(int(dt.strftime('%I')))` — verify on CI (Linux, where `%-I` is supported).

- [ ] **Step 5: Commit**

```bash
git add scripts/reports/parse.py tests/reports/test_parse.py
git commit -m "feat(reports): shared pure parsers (cf readers, is_done, submodule, IST window)"
```

---

## Task 3: Bug acquisition (`bugs.py`)

**Reference:** `PRD_1 §4`, `Examples_1 §3,§5,§7` + acceptance table T1–T18.
Produces the `bugs` snapshot block. Uses `TaskType: BUG` (never `Type: Bug`) and explicit dates (never `-7d`).

**Files:**
- Create: `scripts/reports/bugs.py`
- Test: `tests/reports/test_bugs.py`
- Create: `tests/reports/fixtures/bugs_sample.json` (the §4 raw bug + variants: null module, no-colon summary, en/em-dash, RE-OPEN, created 00:15 IST)

- [ ] **Step 1: Write the failing tests** (parsing + the Section-1/2 invariant, no network)

```python
# tests/reports/test_bugs.py
from reports import bugs, parse

RAW = {  # Examples_1 §4 verbatim
    "id": "2-48231", "idReadable": "PXB1-3987",
    "summary": "Settings: Register- Placeholder text missing",
    "created": 1751971500000, "resolved": None,
    "reporter": {"fullName": "Divya S", "login": "divya.s"},
    "customFields": [
        {"name": "State", "value": {"name": "OPEN"}},
        {"name": "Priority", "value": {"name": "Medium"}},
        {"name": "Module", "value": {"name": "Settings"}},
        {"name": "Assignee", "value": {"name": "Rahul M"}},
    ],
}

def test_parse_bug():
    b = bugs.parse_bug(RAW)
    assert b == {
        "id": "PXB1-3987", "summary": "Settings: Register- Placeholder text missing",
        "created": 1751971500000, "state": "OPEN", "priority": "Medium",
        "module": "Settings", "submodule": "Register",
        "assignee": "Rahul M", "reporter": "Divya S",
    }

def test_reporter_falls_back_to_login():
    raw = dict(RAW, reporter={"login": "only.login"})
    assert bugs.parse_bug(raw)["reporter"] == "only.login"

def test_section_split_invariant():
    # Examples_1 §5 T6: 25 open High, 6 in window → Section 2 = 19, no overlap
    win_start = 1000
    q2 = [{"created": 500 + i} for i in range(19)] + [{"created": 1000 + i} for i in range(6)]
    old, new = bugs.split_high(q2, win_start)
    assert len(old) == 19 and len(new) == 6
    assert len(old) + len(new) == len(q2)
    assert all(b["created"] < win_start for b in old)

def test_state_breakdown_percentages_sum_100():
    open_med = [{"state": "TESTING"}] * 44 + [{"state": "OPEN"}] * 31 + [{"state": "RE-OPEN"}] * 18
    rows = bugs.state_breakdown(open_med)
    assert rows[0]["state"] == "TESTING" and rows[0]["count"] == 44
    assert abs(sum(r["pct"] for r in rows) - 100.0) < 0.5

def test_module_insights_top8_and_no_module_bucket():
    seven = ([{"summary": "Sale: Credit Note - x", "module": "Sale"}] * 7
             + [{"summary": "no colon here", "module": None}] * 2)
    mods = bugs.module_insights(seven)
    assert mods[0]["module"] == "Sale" and mods[0]["count"] == 7
    assert mods[0]["submodules"][0] == {"submodule": "Credit Note", "count": 7}
    assert any(m["module"] == "(No module)" for m in mods)
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/reports/test_bugs.py -v`
Expected: FAIL (`ModuleNotFoundError: scripts.reports.bugs`)

- [ ] **Step 3: Implement** (pure shaping fns + a networked `build_bugs`)

```python
# scripts/reports/bugs.py
"""Bug Analysis data block. Pure shaping fns are unit-tested; build_bugs() wires
the 5 queries. Rules: PRD_1 §4, Examples_1. TaskType: BUG only; explicit dates."""
from collections import Counter, defaultdict
from . import parse

def parse_bug(raw):
    return {
        "id": raw.get("idReadable") or raw.get("id"),
        "summary": raw.get("summary") or "",
        "created": raw.get("created"),
        "state": parse.cf_name(raw, "State"),
        "priority": parse.cf_name(raw, "Priority"),
        "module": parse.cf_name(raw, "Module") or None,
        "submodule": parse.submodule(raw.get("summary") or ""),
        "assignee": parse.cf_name(raw, "Assignee"),
        "reporter": ((raw.get("reporter") or {}).get("fullName")
                     or (raw.get("reporter") or {}).get("login") or ""),
    }

def split_high(q2_bugs, win_start_ms):
    """Section 1 (in window) vs Section 2 (older). Invariant: union == input."""
    old = [b for b in q2_bugs if (b.get("created") or 0) < win_start_ms]
    new = [b for b in q2_bugs if (b.get("created") or 0) >= win_start_ms]
    return old, new

def state_breakdown(open_bugs):
    counts = Counter((b.get("state") or "—") for b in open_bugs)
    total = sum(counts.values()) or 1
    mx = max(counts.values()) if counts else 1
    return [{"state": st, "count": n, "bar": round(n / mx, 3), "pct": round(100.0 * n / total, 1)}
            for st, n in counts.most_common()]

def module_insights(seven_day_bugs, top_submodules=8):
    by_mod = defaultdict(list)
    for b in seven_day_bugs:
        by_mod[b.get("module") or "(No module)"].append(b)
    out = []
    for mod, items in sorted(by_mod.items(), key=lambda kv: -len(kv[1])):
        subs = Counter(s for s in (parse.submodule(i.get("summary") or "") for i in items) if s)
        out.append({"module": mod, "count": len(items),
                    "submodules": [{"submodule": s, "count": n}
                                   for s, n in subs.most_common(top_submodules)]})
    return out

def _dedupe(raw_list):
    seen, out = set(), []
    for r in raw_list:
        k = r.get("idReadable") or r.get("id")
        if k and k not in seen:
            seen.add(k); out.append(r)
    return out

def build_bugs(ctx, yt, cfg, now_ms):
    """Run the 5 queries and shape the block. `yt` is the ytcore module."""
    w = parse.ist_window(now_ms)
    P = cfg.project
    F = "id,idReadable,summary,created,resolved,reporter(fullName,login),customFields(name,value(name,text))"
    def q(query):
        return [parse_bug(r) for r in _dedupe(yt.get_issues(ctx, query, fields=F))]
    q1 = [b for b in q("project: %s TaskType: BUG created: %s .. Today #Unresolved" % (P, w["yesterday_str"]))
          if w["start_ms"] <= (b["created"] or 0) <= w["end_ms"]]   # client-side window (Examples_1 §2 Ex3)
    q2 = q("project: %s TaskType: BUG Priority: {High} #Unresolved" % P)
    q3 = q("project: %s TaskType: BUG Priority: {Medium} #Unresolved" % P)
    q4 = q("project: %s TaskType: BUG Priority: {Low} #Unresolved" % P)
    q5 = q("project: %s TaskType: BUG created: %s .. Today" % (P, w["seven_days_str"]))
    old_high, new_high = split_high(q2, w["start_ms"])
    by_prio = {p: [b for b in q1 if b["priority"] == p] for p in ("High", "Medium", "Low")}
    modules = module_insights(q5)
    return {
        "window": {"start_ms": w["start_ms"], "end_ms": w["end_ms"], "label": w["label"]},
        "new_in_window": by_prio,
        "open_high_older": old_high,
        "medium_by_state": state_breakdown(q3),
        "low_by_state": state_breakdown(q4),
        "module_insights": modules,
        "kpi": {
            "new_high": len(by_prio["High"]), "new_medium": len(by_prio["Medium"]),
            "open_high": len(q2), "open_medium": len(q3), "open_low": len(q4),
            "total_open": len(q2) + len(q3) + len(q4),      # sum of 3 priority queries (Examples_1 §7)
            "modules_hit": len(modules),
        },
    }
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/reports/test_bugs.py -v`
Expected: PASS (5 passed)

- [ ] **Step 5: Add remaining coverage**

Add tests for `Examples_1` table rows **T2, T3** (window boundary at 00:15 IST include / 11:59 PM exclude), **T11** (null module → "(No module)"), **T13** (RE-OPEN not mis-bucketed as OPEN in `state_breakdown`), **T16** (reporter fallback — already covered). Use the fixture variants. Re-run; all pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/reports/bugs.py tests/reports/test_bugs.py tests/reports/fixtures/bugs_sample.json
git commit -m "feat(reports): Bug Analysis data block (5 queries, window, sections, module insights)"
```

---

## Task 4: Story + epic acquisition & matching (`schedule.py`)

**Reference:** `PRD_2 §3–4`, `Examples_4 §3–5`. Shared source for Release Schedule + Weekly Deadline. Fetch epics (2 queries, merge, exclude), fetch stories top-level (paginated), parse deadlines, 2-pass `Subtask` INWARD matching.

**Files:**
- Create: `scripts/reports/schedule.py`
- Test: `tests/reports/test_schedule.py`
- Create: `tests/reports/fixtures/story_sample.json` (Examples_4 §4 raw story), `tests/reports/fixtures/epics_sample.json` (Examples_4 §3)

- [ ] **Step 1: Write failing tests** (parsing + 2-pass matching, no network)

```python
# tests/reports/test_schedule.py
from reports import schedule

STORY = {  # Examples_4 §4 verbatim (trimmed)
    "id": "2-45872", "idReadable": "PXB1-3412", "summary": "Sales: Return to original tender",
    "created": 1750750200000, "resolved": None,
    "customFields": [
        {"name": "State", "value": {"name": "RE-OPEN"}},
        {"name": "Assignee", "value": {"name": "Fahad K"}},
        {"name": "Server Estimation", "value": {"minutes": 960}},
        {"name": "UI Estimation", "value": {"minutes": 480}},
        {"name": "Testing Estimation", "value": {"minutes": 240}},
        {"name": "Spent time", "value": {"minutes": 1110}},
        {"name": "Deadline Date", "value": 1751932800000},
        {"name": "QA Deadline", "value": 1752451200000},
        {"name": "Sprints", "value": [{"name": "Sprint 14"}, {"name": "Sprint 15"}]},
    ],
    "links": [
        {"direction": "INWARD", "linkType": {"name": "Subtask"},
         "issues": [{"id": "2-41200", "idReadable": "PXB1-3101"}]},
    ],
}

def test_parse_story():
    s = schedule.parse_story(STORY)
    assert s["storyId"] == "PXB1-3412" and s["state"] == "RE-OPEN" and s["done"] is False
    assert s["devEst"] == 960 and s["uiEst"] == 480 and s["qaEst"] == 240 and s["spent"] == 1110
    assert s["ddTs"] == 1751932800000 and s["qaTs"] == 1752451200000
    assert s["sprint"] == "Sprint 15"
    assert s["parentId"] == "PXB1-3101"        # Subtask INWARD

def test_two_pass_matching_direct_transitive_orphan():
    epics = {"PXB1-3101"}
    a = {"storyId": "PXB1-3412", "parentId": "PXB1-3101"}   # direct
    b = {"storyId": "PXB1-3520", "parentId": "PXB1-3412"}   # under a story
    c = {"storyId": "PXB1-3601", "parentId": None}          # orphan
    matched, orphans = schedule.match_epics([a, b, c], epics)
    assert matched["PXB1-3412"] == "PXB1-3101"
    assert matched["PXB1-3520"] == "PXB1-3101"              # transitive
    assert orphans == ["PXB1-3601"]
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/reports/test_schedule.py -v`
Expected: FAIL (`ModuleNotFoundError`)

- [ ] **Step 3: Implement**

```python
# scripts/reports/schedule.py
"""Epic+story acquisition, deadline parsing, 2-pass epic matching. Rules: PRD_2,
Examples_4. Shared by Release Schedule and Weekly Deadline views (client-side)."""
from . import parse

def parse_story(raw):
    sid = raw.get("idReadable") or raw.get("id")
    state = parse.cf_name(raw, "State")
    parent = None
    for lk in (raw.get("links") or []):
        if (lk.get("linkType") or {}).get("name") == "Subtask" and lk.get("direction") == "INWARD":
            issues = lk.get("issues") or []
            if issues:
                parent = issues[0].get("idReadable") or issues[0].get("id")
            break
    return {
        "storyId": sid, "summary": raw.get("summary") or "",
        "state": state, "done": parse.is_done(state),
        "assignee": parse.cf_name(raw, "Assignee"),
        "scope": parse.cf_name(raw, "Scope"),
        "created": raw.get("created"), "resolved": raw.get("resolved"),
        "devEst": parse.cf_minutes(raw, "Server Estimation"),
        "uiEst": parse.cf_minutes(raw, "UI Estimation"),
        "qaEst": parse.cf_minutes(raw, "Testing Estimation"),
        "spent": parse.cf_minutes(raw, "Spent time"),
        "ddTs": parse.cf_date_ms(raw, "Deadline Date"),
        "qaTs": parse.cf_date_ms(raw, "QA Deadline"),
        "sprint": parse.sprint_max(parse._cf_value(raw, "Sprints")),
        "parentId": parent,
    }

def match_epics(stories, epic_ids):
    """2-pass (Examples_4 §5). Returns ({storyId: epicId}, [orphan ids])."""
    epic_ids = set(epic_ids)
    by_id = {s["storyId"]: s for s in stories}
    matched = {}
    for s in stories:                                   # pass 1: direct
        if s["parentId"] in epic_ids:
            matched[s["storyId"]] = s["parentId"]
    for s in stories:                                   # pass 2: transitive
        if s["storyId"] in matched:
            continue
        p = s["parentId"]
        if p in matched:                                # parent story already mapped
            matched[s["storyId"]] = matched[p]
        elif p in by_id and by_id[p]["parentId"] in epic_ids:  # grandparent epic
            matched[s["storyId"]] = by_id[p]["parentId"]
    orphans = [s["storyId"] for s in stories if s["storyId"] not in matched]
    return matched, orphans

def fetch_epic_ids(ctx, yt, cfg):
    """2 epic queries (unresolved + recently-resolved), merged by internal id,
    excludes configured ids. Returns {idReadable: {id, summary}}."""
    F = "id,idReadable,summary,created,resolved,assignee(name),customFields(name,value(name,text,minutes,id))"
    cutoff_date = cfg.jun29_cutoff_iso[:10]
    qa = "project: %s TaskType: Epic #Unresolved Scope: {%s}" % (cfg.project, cfg.scope)
    qb = "project: %s TaskType: Epic resolved date: %s .. Today Scope: {%s}" % (cfg.project, cutoff_date, cfg.scope)
    merged = {}
    for r in yt.get_issues(ctx, qa, fields=F) + yt.get_issues(ctx, qb, fields=F):
        rid = r.get("idReadable")
        if rid and rid not in cfg.exclude_ids:
            merged[r.get("id")] = r     # de-dupe by internal id
    return {r["idReadable"]: r for r in merged.values()}

def build_schedule(ctx, yt, cfg):
    """Fetch stories top-level, parse, match to epics. Returns the enriched
    schedule block (epics + stories + orphan count). Drill-down added in Task 5."""
    epics = fetch_epic_ids(ctx, yt, cfg)
    F = ("id,idReadable,summary,created,resolved,"
         "customFields(name,value(name,text,minutes,id)),"
         "links(direction,linkType(name),issues(id,idReadable))")
    raw = yt.get_issues(ctx, "project: %s TaskType: Story Scope: {%s}" % (cfg.project, cfg.scope), fields=F)
    stories = [parse_story(r) for r in raw]
    matched, orphans = match_epics(stories, epics.keys())
    for s in stories:
        s["epicId"] = matched.get(s["storyId"])
    return {
        "epics": [{"id": rid, "summary": e.get("summary"), "resolved": e.get("resolved"),
                   "created": e.get("created")} for rid, e in epics.items()],
        "stories": stories,
        "orphan_count": len(orphans),
    }
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/reports/test_schedule.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Add remaining coverage**

Add `Examples_4 §6` truth-table tests: a done story resolved 25 Jun excluded vs 5 Jul included is a *view-layer* filter (Plan 2), but assert here that `parse_story` sets `done`/`resolved`/`ddTs` correctly for each row so the view can filter. Add `T18` (sprint max) and a story whose `Deadline Date` is absent → `ddTs is None`.

- [ ] **Step 6: Commit**

```bash
git add scripts/reports/schedule.py tests/reports/test_schedule.py tests/reports/fixtures/story_sample.json tests/reports/fixtures/epics_sample.json
git commit -m "feat(reports): epic+story acquisition with deadlines and 2-pass matching"
```

---

## Task 5: Bug drill-down (`drilldown.py`)

**Reference:** `Examples_4 §8`, `PRD_2 §5`. RE-OPEN story → OUTWARD `Subtask` dev tickets → each ticket's OUTWARD `Bugs Reported` → bugs → keep open only; de-dupe bug IDs.

**Files:**
- Create: `scripts/reports/drilldown.py`
- Test: `tests/reports/test_drilldown.py`
- Create: `tests/reports/fixtures/reopen_links.json` (Examples_4 §8 nested links), `tests/reports/fixtures/drill_bug.json`

- [ ] **Step 1: Write failing tests** (pure link-walk + open filter; network mocked)

```python
# tests/reports/test_drilldown.py
from reports import drilldown

STORY_LINKS = {  # Examples_4 §8 step 1
    "idReadable": "PXB1-3412",
    "links": [
        {"direction": "OUTWARD", "linkType": {"name": "Subtask"}, "issues": [
            {"idReadable": "PXB1-3488", "summary": "DEV: Return tender mapping", "links": [
                {"direction": "OUTWARD", "linkType": {"name": "Bugs Reported"},
                 "issues": [{"idReadable": "PXB1-3901"}, {"idReadable": "PXB1-3907"}]}]},
            {"idReadable": "PXB1-3489", "summary": "UI: Return screen", "links": []},
        ]},
    ],
}

def test_bug_candidates_from_links():
    cands = drilldown.bug_candidates(STORY_LINKS)
    # PXB1-3901/3907 via dev ticket PXB1-3488; PXB1-3489 has none
    assert cands == {"PXB1-3901": "PXB1-3488", "PXB1-3907": "PXB1-3488"}

def test_keep_open_only(monkeypatch):
    bug_states = {"PXB1-3901": "OPEN", "PXB1-3907": "Fixed"}
    def fake_get(bid):
        return {"idReadable": bid, "summary": "x", "resolved": None,
                "customFields": [{"name": "State", "value": {"name": bug_states[bid]}},
                                 {"name": "Priority", "value": {"name": "High"}},
                                 {"name": "Assignee", "value": {"name": "Fahad K"}}]}
    kept = drilldown.resolve_bugs({"PXB1-3901": "PXB1-3488", "PXB1-3907": "PXB1-3488"}, fake_get)
    assert [b["bugId"] for b in kept] == ["PXB1-3901"]    # Fixed dropped
    assert kept[0]["priority"] == "High" and kept[0]["devTicketId"] == "PXB1-3488"
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/reports/test_drilldown.py -v`
Expected: FAIL (`ModuleNotFoundError`)

- [ ] **Step 3: Implement**

```python
# scripts/reports/drilldown.py
"""RE-OPEN story → dev ticket → open bug drill-down. Rules: Examples_4 §8."""
from . import parse

def bug_candidates(story_links):
    """{bugId: devTicketId} from a story's nested links payload. Dedupe by bug id
    (first dev ticket wins)."""
    out = {}
    for lk in (story_links.get("links") or []):
        if (lk.get("linkType") or {}).get("name") == "Subtask" and lk.get("direction") == "OUTWARD":
            for dev in (lk.get("issues") or []):
                dev_id = dev.get("idReadable") or dev.get("id")
                for blk in (dev.get("links") or []):
                    if (blk.get("linkType") or {}).get("name") == "Bugs Reported" and blk.get("direction") == "OUTWARD":
                        for bug in (blk.get("issues") or []):
                            bid = bug.get("idReadable") or bug.get("id")
                            if bid and bid not in out:
                                out[bid] = dev_id
    return out

def resolve_bugs(candidates, fetch_bug):
    """candidates={bugId: devTicketId}; fetch_bug(id)->raw issue. Keep OPEN only."""
    kept = []
    for bid, dev_id in candidates.items():
        raw = fetch_bug(bid)
        state = parse.cf_name(raw, "State")
        if parse.is_done(state):
            continue
        kept.append({"bugId": bid, "summary": raw.get("summary") or "", "state": state,
                     "assignee": parse.cf_name(raw, "Assignee"),
                     "priority": parse.cf_name(raw, "Priority"), "devTicketId": dev_id})
    return kept

def attach_drilldown(ctx, yt, stories):
    """For each RE-OPEN story, fetch its links, resolve open bugs, attach as
    story['bugs']. Non-RE-OPEN stories get []. Mutates and returns stories."""
    LF = ("id,idReadable,links(direction,linkType(name),"
          "issues(id,idReadable,summary,links(direction,linkType(name),issues(id,idReadable))))")
    BF = "id,idReadable,summary,resolved,customFields(name,value(name,text))"
    seen_bug = {}
    def fetch_bug(bid):
        if bid not in seen_bug:
            res = yt.get_issues(ctx, "issue ID: %s" % bid, fields=BF, limit=1)
            seen_bug[bid] = res[0] if res else {"idReadable": bid, "customFields": []}
        return seen_bug[bid]
    for s in stories:
        if "re-open" not in (s.get("state") or "").lower():
            s["bugs"] = []
            continue
        links = yt.GET(ctx, "/api/issues/%s?fields=%s" % (s["storyId"], LF))
        s["bugs"] = resolve_bugs(bug_candidates(links or {}), fetch_bug)
    return stories
```

- [ ] **Step 4: Run to verify pass**

Run: `python -m pytest tests/reports/test_drilldown.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Add remaining coverage**

Add `Examples_4` **T9** (1 open + 1 fixed → exactly 1 bug row), **T10** (dev ticket with no `Bugs Reported` → empty, no crash), and the §12 duplicate-bug case (same bug under two dev tickets → fetched once).

- [ ] **Step 6: Commit**

```bash
git add scripts/reports/drilldown.py tests/reports/test_drilldown.py tests/reports/fixtures/reopen_links.json tests/reports/fixtures/drill_bug.json
git commit -m "feat(reports): RE-OPEN story bug drill-down (link-walk + open-only filter)"
```

---

## Task 6: Compose into the snapshot + TS types

**Files:**
- Modify: `scripts/snapshot.py` — `build_snapshot()` (around line 408–473) and imports (around line 54).
- Modify: `web/lib/types.ts` — add interfaces, extend `Snapshot`.
- Test: `tests/reports/test_compose.py`

- [ ] **Step 1: Write the failing integration test** (compose from fixtures, no network)

```python
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
```

- [ ] **Step 2: Run to verify failure**

Run: `python -m pytest tests/reports/test_compose.py -v`
Expected: FAIL (import path or key error before wiring)

- [ ] **Step 3: Wire into `build_snapshot`**

In `scripts/snapshot.py`, after the imports at line 54 (`import gamification as gam`), add:

```python
from reports.config import load_config      # scripts/ is already on sys.path (line 53)
from reports import bugs as rbugs, schedule as rsched, drilldown as rdrill
```

Inside `build_snapshot(...)`, after `insights = build_insights(...)` (line 450) and before `effort.pop("_sprint", None)`:

```python
    # 6) reports data foundation (Bug Analysis + schedule for Release/Weekly views)
    rcfg = load_config()
    now_ms = int(now.timestamp() * 1000)
    bugs_block = rbugs.build_bugs(ctx, yt, rcfg, now_ms)
    schedule_block = rsched.build_schedule(ctx, yt, rcfg)
    rdrill.attach_drilldown(ctx, yt, schedule_block["stories"])
    config_block = {
        "project": rcfg.project, "scope": rcfg.scope, "exclude_ids": rcfg.exclude_ids,
        "man_day_minutes": rcfg.man_day_minutes, "jun29_cutoff_iso": rcfg.jun29_cutoff_iso,
        "mtg_cutoff_iso": rcfg.mtg_cutoff_iso, "week1_anchor": rcfg.week1_anchor,
        "done_states": rcfg.done_states,
    }
```

And add to the returned dict (line 464–473):

```python
        "config": config_block,
        "bugs": bugs_block,
        "schedule": schedule_block,
```

- [ ] **Step 4: Extend `web/lib/types.ts`**

Append these interfaces and extend `Snapshot`:

```typescript
export interface ReportsConfigBlock {
  project: string; scope: string; exclude_ids: string[]; man_day_minutes: number;
  jun29_cutoff_iso: string; mtg_cutoff_iso: string; week1_anchor: string; done_states: string[];
}
export interface Bug {
  id: string; summary: string; created: number; state: string; priority: string;
  module: string | null; submodule: string | null; assignee: string; reporter: string;
}
export interface StateBreakdownRow { state: string; count: number; bar: number; pct: number; }
export interface ModuleInsight { module: string; count: number; submodules: { submodule: string; count: number }[]; }
export interface BugsBlock {
  window: { start_ms: number; end_ms: number; label: string };
  new_in_window: { High: Bug[]; Medium: Bug[]; Low: Bug[] };
  open_high_older: Bug[]; medium_by_state: StateBreakdownRow[]; low_by_state: StateBreakdownRow[];
  module_insights: ModuleInsight[];
  kpi: { new_high: number; new_medium: number; open_high: number; open_medium: number;
         open_low: number; total_open: number; modules_hit: number };
}
export interface DrillBug { bugId: string; summary: string; state: string; assignee: string; priority: string; devTicketId: string; }
export interface ScheduleStory {
  storyId: string; summary: string; state: string; done: boolean; assignee: string; scope: string;
  created: number | null; resolved: number | null;
  devEst: number; uiEst: number; qaEst: number; spent: number;
  ddTs: number | null; qaTs: number | null; sprint: string; parentId: string | null;
  epicId: string | null; bugs: DrillBug[];
}
export interface ScheduleEpic { id: string; summary: string; resolved: number | null; created: number | null; }
export interface ScheduleBlock { epics: ScheduleEpic[]; stories: ScheduleStory[]; orphan_count: number; }
```

Then extend the `Snapshot` interface (line 259) with:

```typescript
  config?: ReportsConfigBlock;
  bugs?: BugsBlock;
  schedule?: ScheduleBlock;
```
(Optional `?` so older snapshots still typecheck.)

- [ ] **Step 5: Run tests + typecheck**

Run: `python -m pytest tests/reports/ -v`
Expected: PASS (all reports tests)
Run: `cd web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add scripts/snapshot.py web/lib/types.ts tests/reports/test_compose.py
git commit -m "feat(reports): compose config/bugs/schedule blocks into the snapshot + TS types"
```

---

## Task 7: End-to-end verification against live YouTrack

**Goal:** prove the enriched snapshot matches reality before any UI depends on it. Requires a read-only `YT_TOKEN`.

- [ ] **Step 1: Run the producer**

```bash
set -a; . ~/.positrack-yt.env; set +a   # loads YT_TOKEN
python3 scripts/snapshot.py --project PXB1 --scope "PHASE 1"
```
Expected: `Wrote web/data/latest.json` and the existing effort/RED summary lines, with no traceback.

- [ ] **Step 2: Spot-check the new blocks**

```bash
python3 -c "import json; s=json.load(open('web/data/latest.json')); \
print('bugs.kpi', s['bugs']['kpi']); \
print('stories', len(s['schedule']['stories']), 'orphans', s['schedule']['orphan_count']); \
print('reopen w/ bugs', sum(1 for x in s['schedule']['stories'] if x['bugs']))"
```
Expected: `total_open` ≈ the count a manual YouTrack search for `project: PXB1 TaskType: BUG #Unresolved` shows; stories > 0; some RE-OPEN stories carry bugs.

- [ ] **Step 3: Cross-check one report against its example HTML**

Open `docs/reports-dashboard/reference/examples/PXB1_BugAnalysis_2026-07-10.html` and confirm the KPI ordering/labels match `bugs.kpi`. (Numbers differ by date; structure must match.) Note: PRD_1 acceptance criteria #2 requires Section-1 counts to match a manual search for the same window — verify with `created: {yesterday} .. Today #Unresolved`.

- [ ] **Step 4: Commit any fixture/threshold fixes, then update the plan index**

```bash
git add -A && git commit -m "test(reports): verify enriched snapshot against live PXB1 data"
```

---

## Self-Review (run after completing all tasks)

**1. Spec coverage** — map each Plan-1 responsibility to the spec:
- Bug data (spec §4 "new") → Task 3 ✅
- Deadline fields (spec §4) → Task 4 (`ddTs`/`qaTs`) ✅
- Bug drill-down (spec §4) → Task 5 ✅
- Config/baselines (spec §D4/§11) → Task 1 ✅
- Custom-field gotchas (spec §11) → Task 2 tests ✅
- Effort report (spec §6.4) → already in engine; composed unchanged. ✅
- Health/milestones/week-slots (spec §6.1/§6.3/§6.5) → **intentionally deferred to view plans** (client-side). ✅ (documented in Scope)

**2. Placeholder scan** — every code step has runnable code; every test step has real assertions; "add remaining coverage" steps name exact T-rows and the pattern to copy (not "write tests here"). ✅

**3. Type consistency** — `parse.cf_name/cf_minutes/cf_date_ms/sprint_max/is_done/submodule/ist_window` are the names used by `bugs.py`/`schedule.py`/`drilldown.py`. Snapshot keys `config`/`bugs`/`schedule` match the TS `Snapshot` extension. `ScheduleStory` fields match `parse_story` output. ✅

---

## Next plans (not in scope here)

- **Plan 2** — Next.js app shell (new folder), auth reuse, snapshot read path, global filter shell, "Refresh now" → `workflow_dispatch`, and the **Project Health** view (client-side composition of these blocks).
- **Plans 3–6** — Weekly Deadline → Release Schedule → Bug Analysis → Effort views (client-side grouping over `schedule`/`bugs`/`effort`).
- **Plan 7** — `CLAUDE.md`, "add a report" recipe, regression suite, Vercel cutover.
