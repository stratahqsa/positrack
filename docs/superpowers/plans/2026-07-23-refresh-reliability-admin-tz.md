# Refresh Reliability + YouTrack Load Cut + Admin Panel + Per-Browser TZ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Punctual, admin-manageable snapshot refreshes (Vercel Cron tick → config gate → `workflow_dispatch`), a ~10× cut in YouTrack API load per snapshot, a per-browser timezone preference, and a snappier dashboard.

**Architecture:** Python producer keeps its shape but batches N+1 sweeps into bulk/chunked queries and derives signal counts locally from data already fetched. The dashboard gains `/api/cron/refresh` (15-min Vercel tick consulting a Blob-stored `schedule.json`), an ADMIN_CODE-gated `/admin` panel (schedule editor + Refresh Now + run history), and cookie-driven SSR timezone resolution.

**Tech Stack:** Python 3.9+ stdlib (core/ytcore.py engine), Next.js 15 App Router + TS (dashboard/), Vitest, pytest, GitHub Actions, Vercel Cron/Blob, `@vercel/blob`.

**Spec:** `docs/superpowers/specs/2026-07-23-refresh-reliability-admin-tz-design.md`

**Verification baseline (measured 2026-07-23):** GH `schedule` runs drift 1–3.5 h; one snapshot ≈300–450 sequential YT requests over ~285 s. Success: ≤70 requests, ≤2.5 min, runs start ≤15 min after slot.

---

## Part 1 — Python: YouTrack load cut (spec C)

### Task 1: ytcore plumbing — request counter + optional throttle

**Files:**
- Modify: `core/ytcore.py` (imports block at top; `_req` at :73)

- [ ] **Step 1: Add counter + throttle to `_req`**

At the top of `core/ytcore.py`, confirm `import os` and `import time` exist (both are used already; add `import os` if absent). Below the `Ctx` class (after line ~65), add:

```python
# Observability + gentleness knobs for bulk sweeps (snapshot producer):
# REQUEST_COUNT counts every YouTrack HTTP call in-process; YT_THROTTLE_MS
# (env, default 0) sleeps briefly before each call so a sweep never bursts.
REQUEST_COUNT = 0
_THROTTLE_MS = float(os.environ.get("YT_THROTTLE_MS", "0") or 0)
```

In `_req(...)` (line ~73), immediately before the `urllib.request.urlopen` call, add:

```python
    global REQUEST_COUNT
    REQUEST_COUNT += 1
    if _THROTTLE_MS > 0:
        time.sleep(_THROTTLE_MS / 1000.0)
```

- [ ] **Step 2: Smoke check**

Run: `python3 -c "import sys; sys.path.insert(0,'core'); import ytcore; print(ytcore.REQUEST_COUNT)"`
Expected: `0`

- [ ] **Step 3: Commit** — `perf(engine): request counter + optional YT_THROTTLE_MS pacing`

### Task 2: `get_issues_by_ids` bulk helper + effort_report N+1 removals

**Files:**
- Modify: `core/ytcore.py` (near `get_issues` :166; `effort_report` :575–679)
- Test: `tests/test_ytcore_unit.py` (append)

- [ ] **Step 1: Write failing tests** (append to `tests/test_ytcore_unit.py`, matching its existing import style):

```python
def test_get_issues_by_ids_chunks_and_preserves_order(monkeypatch):
    import ytcore as yt
    calls = []
    def fake_get_issues(ctx, query, fields="", top=200, limit=None):
        calls.append(query)
        ids = [t.strip() for t in query.replace("issue ID:", "").split(",")]
        return [{"idReadable": i} for i in reversed(ids)]  # scrambled on purpose
    monkeypatch.setattr(yt, "get_issues", fake_get_issues)
    ids = ["A-%d" % i for i in range(70)]
    out = yt.get_issues_by_ids(None, ids, fields="idReadable", chunk=30)
    assert [o["idReadable"] for o in out] == ids          # original order restored
    assert len(calls) == 3                                 # 30+30+10 → 3 chunks

def test_get_issues_by_ids_skips_missing(monkeypatch):
    import ytcore as yt
    monkeypatch.setattr(yt, "get_issues",
                        lambda ctx, q, fields="", top=200, limit=None: [{"idReadable": "A-1"}])
    out = yt.get_issues_by_ids(None, ["A-1", "A-2"], fields="idReadable")
    assert [o["idReadable"] for o in out] == ["A-1"]
```

- [ ] **Step 2: Run to verify failure** — `python3 -m pytest tests/test_ytcore_unit.py -k by_ids -q` → FAIL (`AttributeError: get_issues_by_ids`)

- [ ] **Step 3: Implement** — in `core/ytcore.py` directly below `get_issues`:

```python
def get_issues_by_ids(ctx, ids, fields, chunk=30):
    """Bulk-fetch issues by idReadable via chunked `issue ID:` queries, returned in
    the SAME order as `ids`. Replaces per-issue GET loops (N+1) with ~N/chunk paged
    queries; chunk stays small because `fields` is often a heavy nested set. Ids the
    server doesn't return (deleted/inaccessible) are skipped rather than raising."""
    by_id = {}
    ids = [i for i in ids if i]
    for start in range(0, len(ids), chunk):
        batch = ids[start:start + chunk]
        q = "issue ID: " + ", ".join(batch)
        for it in get_issues(ctx, q, fields=fields, top=max(len(batch), 50)):
            rid = it.get("idReadable")
            if rid:
                by_id[rid] = it
    return [by_id[i] for i in ids if i in by_id]
```

- [ ] **Step 4: Rewire `effort_report`** — replace the per-epic loop (`:632–635`):

```python
    cats = [categorize_epic(raw)
            for raw in get_issues_by_ids(ctx, epic_ids, epic_sf)]
```

and replace the P2 candidates block (`:665–679`) so the second per-epic meta GET disappears — widen the candidates query fields and read from the row itself:

```python
    p2_candidates = get_issues(
        ctx, "project: %s TaskType: EPIC Scope: {PHASE 2} #Unresolved" % project,
        fields="idReadable,summary,created,customFields(name,value(name))", top=300)
    p2_backlog = []
    for e in p2_candidates:
        pid = e.get("idReadable")
        if not pid or pid in exclude:
            continue
        act = GET(ctx, "/api/issues/%s/activities?categories=CustomFieldCategory"
                       "&fields=timestamp,added(name),removed(name),field(name)" % pid)
        matched, changed_at = _scope_changed_p1_to_p2(act if isinstance(act, list) else [], cutoff_ms)
        if matched:
            p2_backlog.append({"id": pid, "summary": e.get("summary") or "",
                               "assignee": _cf_str(e, "Assignee"),
                               "created": e.get("created"), "changed_at": changed_at})
```

- [ ] **Step 5: Run tests** — `python3 -m pytest tests/test_ytcore_unit.py -q` → all PASS
- [ ] **Step 6: Commit** — `perf(engine): bulk epic fetch + P2 candidate field widening (kills 2 N+1 loops)`

### Task 3: single work-item pool + pure timespent rebuild

**Files:**
- Modify: `core/ytcore.py` (below `time_spent` :1108–1133)
- Test: `tests/test_ytcore_unit.py` (append)

- [ ] **Step 1: Failing tests:**

```python
def _wi(issue, login, minutes, date=1, text=""):
    return {"issue": issue, "project": "PXB1", "login": login, "author": login,
            "minutes": minutes, "type": "(none)", "date": date, "text": text}

def test_timespent_from_items_matches_time_spent_shape():
    import ytcore as yt
    kept = [_wi("A-1", "amy", 60), _wi("A-2", "bob", 30)]
    dropped = [_wi("A-1", "amy", 60, text="Propagated from Bug A-9")]
    out = yt.timespent_from_items(kept, dropped, "project: PXB1")
    assert out["group_by"] == "author" and out["count"] == 2
    assert out["scope"] == "project: PXB1"
    assert out["excluded"] == {"entries": 1, "minutes": 60, "total": yt.fmt_minutes(60)}
    assert [g["key"] for g in out["groups"]] == ["amy", "bob"]

def test_timespent_from_items_no_dropped_no_excluded_key():
    import ytcore as yt
    out = yt.timespent_from_items([_wi("A-1", "amy", 10)], [], "s")
    assert "excluded" not in out and "window" not in out
```

- [ ] **Step 2: Verify failure** — `python3 -m pytest tests/test_ytcore_unit.py -k from_items -q` → FAIL

- [ ] **Step 3: Implement** in `core/ytcore.py` below `time_spent`:

```python
def wi_scope(query="", project="", location="", sprint=""):
    """Public alias of the work-item scope-query builder, so callers rebuilding
    time_spent-shaped blocks from a shared pool label them identically."""
    return _wi_query(query, project, location, sprint)

def work_item_pool(ctx, project="", top=1000, limit=20000):
    """ONE project-wide work-item fetch, normalized and split by the standard
    propagated-time rule. The snapshot producer reuses this single pool for the
    effort spend join, every per-sprint picker block, and the recent-worklog
    window — replacing five separate full sweeps (the whole point: YouTrack is
    hit once for work items per snapshot, not five times)."""
    scoped = _wi_query(project=project)
    raw = [_wi_norm(w) for w in work_items(ctx, query=scoped, limit=limit, top=top)]
    kept, dropped = _split_by_type(raw, True, None)
    return {"scope": scoped, "items": kept, "dropped": dropped}

def timespent_from_items(kept, dropped, scope, group_by="author", window=None):
    """Pure: rebuild a time_spent()-shaped block from pre-fetched pool items,
    including the propagated-time exclusion disclosure. No network."""
    out = aggregate_work(kept, group_by)
    out["scope"] = scope
    if dropped:
        dmin = sum(it["minutes"] for it in dropped)
        out["excluded"] = {"entries": len(dropped), "minutes": dmin,
                          "total": fmt_minutes(dmin)}
    if window:
        out["window"] = window
    return out
```

Also add an optional preloaded-sweep param to `effort_report` (signature at :575 — CLI/MCP callers unaffected):

```python
def effort_report(ctx, project="PXB1", scope="PHASE 1",
                  cutoff_iso=EFFORT_CUTOFF_DEFAULT, exclude_ids=("PXB1-3295",),
                  sweep_items=None):
```

and where it sweeps (`:645–646`):

```python
    if sweep_items is None:
        sweep = time_spent(ctx, project=project, group_by="issue", with_items=True, top=1000)
        sweep_items = sweep.get("items", [])
    items = sweep_items
```

- [ ] **Step 4: Run** — `python3 -m pytest tests/test_ytcore_unit.py -q` → PASS
- [ ] **Step 5: Commit** — `perf(engine): shared work-item pool + pure timespent rebuild + effort sweep injection`

### Task 4: snapshot.py — wire the single pool (5 sweeps → 1)

**Files:**
- Modify: `scripts/snapshot.py` (`build_snapshot` :420–500, `_recent_worklog_authors` :277–293)
- Test: `tests/test_snapshot.py` (append)

- [ ] **Step 1: Failing tests** (pure — pool-subset helpers):

```python
def _wi(issue, login, minutes, date_ms=0, text=""):
    return {"issue": issue, "project": "PXB1", "login": login, "author": login,
            "minutes": minutes, "type": "(none)", "date": date_ms, "text": text}

def test_sprint_block_filters_pool_by_issue_ids():
    pool = {"scope": "project: PXB1",
            "items": [_wi("A-1", "amy", 60), _wi("B-1", "bob", 30)],
            "dropped": [_wi("A-1", "amy", 60, text="Propagated from Bug A-9")]}
    out = snap._timespent_for_issue_ids(pool, {"A-1"}, "project: PXB1 Sprints: {s1}")
    assert out["count"] == 1 and out["groups"][0]["key"] == "amy"
    assert out["excluded"]["entries"] == 1          # dropped subset follows the filter
    assert out["scope"] == "project: PXB1 Sprints: {s1}"

def test_worklog_authors_from_pool_windows_by_date():
    now_ms = 1_000_000_000_000
    week = 7 * 86400000
    pool = {"items": [_wi("A-1", "amy", 60, date_ms=now_ms - week + 60_000),
                      _wi("B-1", "bob", 30, date_ms=now_ms - week - 60_000)],
            "dropped": []}
    logins, names = snap._worklog_authors_from_pool(pool, now_ms)
    assert logins == {"amy"} and names == {"amy": "amy"}
```

- [ ] **Step 2: Verify failure** — `python3 -m pytest tests/test_snapshot.py -k pool -q` → FAIL

- [ ] **Step 3: Implement** in `scripts/snapshot.py`. Add the two pure helpers (near `_recent_worklog_authors`), then delete `_recent_worklog_authors`:

```python
def _timespent_for_issue_ids(pool, issue_ids, scope):
    """time_spent-shaped block for the pool items whose issue is in `issue_ids`
    (a sprint's membership set). Pure — the sprint's issue ids are the only
    network cost, fetched by the caller with a cheap id-only query."""
    kept = [it for it in pool["items"] if it["issue"] in issue_ids]
    dropped = [it for it in pool["dropped"] if it["issue"] in issue_ids]
    return yt.timespent_from_items(kept, dropped, scope)


def _worklog_authors_from_pool(pool, now_ms):
    """Logins (and display names) who logged time within LOGGING_WINDOW_DAYS,
    derived locally from the shared pool's entry dates (was: its own windowed
    time_spent sweep). Propagated copies are already excluded from pool items."""
    cutoff = now_ms - LOGGING_WINDOW_DAYS * 86400000
    logins, names = set(), {}
    for it in pool["items"]:
        lg = it.get("login")
        if lg and (it.get("date") or 0) >= cutoff:
            logins.add(lg)
            names[lg] = it.get("author") or lg
    return logins, names
```

Rewire `build_snapshot` — replace steps 1/2/2b (`:425–453`) with:

```python
    # 0) ONE project-wide work-item pool — reused by effort spend, the active-
    #    sprint block, every sprint-picker block, and the worklog window.
    pool = yt.work_item_pool(ctx, project=project)

    # 1) effort — the full report, spend joined from the shared pool.
    effort = yt.effort_report(ctx, project=project, scope=scope, sweep_items=pool["items"])
```

(keep the existing role-owner flag loop unchanged), then:

```python
    # 2) timespent — latest active sprint, rebuilt from the pool. The only
    #    network cost per sprint is an id-only membership query.
    sprint = sprint or latest_active_sprint(ctx, project)
    effort["_sprint"] = sprint

    def _sprint_ids(sp):
        return {i.get("idReadable") for i in yt.get_issues(
            ctx, "project: %s Sprints: {%s}" % (project, sp),
            fields="idReadable", top=500)}

    timespent = _timespent_for_issue_ids(pool, _sprint_ids(sprint),
                                         yt.wi_scope(project=project, sprint=sprint))

    # 2b) per-sprint time for the UI sprint picker (last few active sprints).
    sprints_available = recent_sprints(ctx, project, n=4)
    if sprint not in sprints_available:
        sprints_available = sprints_available + [sprint]
    timespent_by_sprint = {}
    for sp in sprints_available:
        if sp == sprint:
            timespent_by_sprint[sp] = timespent
            continue
        try:
            timespent_by_sprint[sp] = _timespent_for_issue_ids(
                pool, _sprint_ids(sp), yt.wi_scope(project=project, sprint=sp))
        except yt.YTError:
            pass
```

Thread the pool + a `now_ms` into gamification (full rewire lands in Task 5; for THIS task keep `build_gamification`'s body working by replacing its `_recent_worklog_authors(ctx, project, sprint)` call with `_worklog_authors_from_pool(pool, int(now.timestamp() * 1000))` — pass `pool` as a new parameter: `build_gamification(ctx, project, effort, roster=roster, pool=pool, now_ms=int(now.timestamp() * 1000))`).

- [ ] **Step 4: Run** — `python3 -m pytest tests/test_snapshot.py -q` → PASS
- [ ] **Step 5: Commit** — `perf(snapshot): single work-item pool feeds effort, sprint picker, worklog window`

### Task 5: snapshot.py — local gamification signals + local hygiene (kills ~120 polled counts)

**Files:**
- Modify: `scripts/snapshot.py` (`_person_signals` :249–274 deleted, `_assignee_logins` :296–313 replaced, `build_gamification` :316–407, `build_snapshot` hygiene step :456)
- Test: `tests/test_snapshot.py` (append)

- [ ] **Step 1: Failing tests:**

```python
def _issue(iid, login=None, updated=None, est_minutes=None):
    cfs = []
    if login is not None:
        cfs.append({"name": "Assignee", "value": {"login": login, "fullName": login.title()}})
    cfs.append({"name": "Estimate",
                "value": ({"minutes": est_minutes} if est_minutes is not None else None)})
    return {"idReadable": iid, "updated": updated, "customFields": cfs}

def test_signals_from_issues_counts():
    now_ms = 100 * 86400000
    stale_cut_ok = now_ms - 5 * 86400000       # updated 5d ago: fresh + moving
    very_old = now_ms - 40 * 86400000          # updated 40d ago: stale, not moving
    issues = [_issue("A-1", "amy", stale_cut_ok, est_minutes=60),
              _issue("A-2", "amy", very_old, est_minutes=None),
              _issue("A-3", "bob", very_old, est_minutes=120),
              _issue("A-4", None, stale_cut_ok)]          # unassigned → no login bucket
    per = snap._signals_from_issues(issues, now_ms)
    assert per["amy"] == {"open": 2, "stale": 1, "unestimated": 1, "moved": 1}
    assert per["bob"] == {"open": 1, "stale": 1, "unestimated": 0, "moved": 0}
    assert None not in per and "A-4" not in per

def test_hygiene_blocks_local_shape():
    now_ms = 100 * 86400000
    issues = [_issue("A-1", "amy", now_ms - 86400000, est_minutes=60),
              _issue("A-2", None, now_ms - 40 * 86400000, est_minutes=None)]
    blocks = snap._hygiene_blocks_local("PXB1", issues, now_ms)
    assert [b["kind"] for b in blocks] == ["raw", "table", "raw"]
    headers = blocks[1]["headers"]
    assert headers == ["Proj", "Open", "Stale", "Unassigned", "No-est", "Hygiene", "▕"]
    row = blocks[1]["rows"][0]
    assert row[0] == "PXB1" and row[5] == "50%"    # 1 of 2 stale → 50% hygiene

def test_owners_from_issues_excludes_role_accounts():
    issues = [_issue("A-1", "amy"), _issue("A-2", "Devxleads")]
    owners = snap._owners_from_issues(issues)
    assert owners == {"amy": "Amy"}
```

- [ ] **Step 2: Verify failure** — `python3 -m pytest tests/test_snapshot.py -k "signals or hygiene_blocks or owners_from" -q` → FAIL

- [ ] **Step 3: Implement.** Delete `_person_signals` and `_assignee_logins`; add:

```python
# The ONE unresolved-issues sweep every local derivation below shares. Fields
# carry the assignee (login+name), the update stamp, and the Estimate value so
# per-person signals, owner resolution, AND board hygiene all come from a single
# paged query — this replaced 4 polled count queries PER PERSON plus 4 more for
# hygiene (~120 requests/run at 29 assignees).
OPEN_SWEEP_FIELDS = "idReadable,updated,customFields(name,value(login,fullName,minutes))"


def _fetch_open_issues(ctx, project):
    return yt.get_issues(ctx, "project: %s #Unresolved" % project,
                         fields=OPEN_SWEEP_FIELDS, top=500, limit=5000)


def _issue_cf(it, name):
    for cf in it.get("customFields", []):
        if cf.get("name") == name:
            return cf.get("value")
    return None


def _signals_from_issues(issues, now_ms):
    """Per-login hygiene signal COUNTS from the shared unresolved sweep. Mirrors
    the retired per-person YouTrack queries: stale = not updated within
    STALE_DAYS; moved = updated within LOGGING_WINDOW_DAYS; unestimated =
    Estimate EMPTY (has: -{Estimate}). Local ms comparison vs the server's
    day-granular date math can differ ±1 on exact-boundary items — accepted for
    these signals (documented in the design spec)."""
    stale_cut = now_ms - STALE_DAYS * 86400000
    moved_cut = now_ms - LOGGING_WINDOW_DAYS * 86400000
    per = {}
    for it in issues:
        a = _issue_cf(it, "Assignee")
        login = a.get("login") if isinstance(a, dict) else None
        if not login:
            continue
        est = _issue_cf(it, "Estimate")
        rec = per.setdefault(login, {"open": 0, "stale": 0, "unestimated": 0, "moved": 0})
        rec["open"] += 1
        upd = it.get("updated") or 0
        if upd < stale_cut:
            rec["stale"] += 1
        if upd >= moved_cut:
            rec["moved"] += 1
        if not (isinstance(est, dict) and est.get("minutes") is not None):
            rec["unestimated"] += 1
    return per


def _owners_from_issues(issues):
    """{login: fullName} for real (non-role) owners of open work, from the same
    sweep (was `_assignee_logins`, its own query)."""
    out = {}
    for it in issues:
        v = _issue_cf(it, "Assignee")
        if (isinstance(v, dict) and v.get("login")
                and not is_role_account(name=v.get("fullName"), login=v.get("login"))):
            out[v["login"]] = v.get("fullName") or v["login"]
    return out


def _hygiene_blocks_local(project, issues, now_ms):
    """Board-hygiene blocks in the exact shape of yt.report(rtype='hygiene')
    (single-project case), computed locally from the shared sweep."""
    stale_cut = now_ms - STALE_DAYS * 86400000
    op, st, un, ue = len(issues), 0, 0, 0
    for it in issues:
        a = _issue_cf(it, "Assignee")
        est = _issue_cf(it, "Estimate")
        if (it.get("updated") or 0) < stale_cut:
            st += 1
        if not (isinstance(a, dict) and a.get("login")):
            un += 1
        if not (isinstance(est, dict) and est.get("minutes") is not None):
            ue += 1
    score = round(100 * (op - st) / op) if op else 100
    attention = st + un + ue
    rows = [[project, op, st, un, ue, "%d%%" % score, yt.bar(score, 100)]]
    return [{"kind": "raw", "s": "# Board hygiene\n"},
            {"kind": "table",
             "headers": ["Proj", "Open", "Stale", "Unassigned", "No-est", "Hygiene", "▕"],
             "rows": rows},
            {"kind": "raw", "s": "\n**%d item(s) need attention (stale / unassigned / "
                                 "unestimated) — clear them to push hygiene toward 100%%.**" % attention}]
```

> `yt.report("hygiene")` renders counts through `yt._cell()`, which passes non-negative ints straight through — locally the counts are always ints ≥ 0, so plain ints match. Confirm against `core/ytcore.py:294` while implementing; if `_cell` does more than int-passthrough/`"?"`, mirror it exactly.

Rewire `build_gamification` to be network-free (signature `build_gamification(project, effort, open_issues, pool, now_ms, roster=None)`); inside, replace the old worklog/owners/signals calls:

```python
    worklog_authors, worklog_names = _worklog_authors_from_pool(pool, now_ms)
    owners = _owners_from_issues(open_issues)
    per_login = _signals_from_issues(open_issues, now_ms)

    people = []
    for login in sorted(owners):
        raw = per_login.get(login) or {"open": 0, "stale": 0, "unestimated": 0, "moved": 0}
        signals = {
            "stale_free": _frac(raw["open"] - raw["stale"], raw["open"]),
            "estimated": _frac(raw["open"] - raw["unestimated"], raw["open"]),
            "moving": _frac(raw["moved"], raw["open"]),
            "on_time_logging": 1.0 if login in worklog_authors else 0.0,
        }
        people.append({
            "key": login,
            "name": owners.get(login) or worklog_names.get(login) or login,
            "score": gam.hygiene_score(signals),
            "signals": {k: round(v, 3) for k, v in signals.items()},
            "counts": raw,
            "logged_recently": login in worklog_authors,
            "red_reduction": 0,
        })
```

(the rest of `build_gamification` — ranking, engagement, teams, owner_gap — is unchanged). In `build_snapshot`, replace steps 3+4:

```python
    # 3+4) ONE unresolved-issues sweep powers hygiene AND gamification locally.
    now_ms = int(now.timestamp() * 1000)
    open_issues = _fetch_open_issues(ctx, project)
    hygiene_blocks = _hygiene_blocks_local(project, open_issues, now_ms)
    gamification = build_gamification(project, effort, open_issues, pool, now_ms,
                                      roster=roster)
```

(and remove `effort["_sprint"] = sprint` threading if nothing reads it anymore — `build_gamification` no longer does; keep the later `effort.pop("_sprint", None)` guard harmless or drop both.)

- [ ] **Step 4: Run** — `python3 -m pytest tests/test_snapshot.py tests/test_gamification.py -q` → PASS (update any test that called the old signatures)
- [ ] **Step 5: Commit** — `perf(snapshot): derive gamification + hygiene locally from one unresolved sweep`

### Task 6: drilldown — bulk story links + bulk bug fetch

**Files:**
- Modify: `scripts/reports/drilldown.py` (`attach_drilldown` :34–52)
- Test: `tests/test_snapshot.py` (append; the pure resolvers already have coverage via existing tests)

- [ ] **Step 1: Failing test:**

```python
def test_attach_drilldown_batches_queries():
    from reports import drilldown

    class FakeYt:
        def __init__(self):
            self.queries = []
        def get_issues(self, ctx, query, fields="", top=200, limit=None):
            self.queries.append(query)
            if query.startswith("issue ID: S-"):
                return [{"idReadable": "S-1", "links": [
                    {"linkType": {"name": "Subtask"}, "direction": "OUTWARD",
                     "issues": [{"idReadable": "D-1", "links": [
                         {"linkType": {"name": "Bugs Reported"}, "direction": "OUTWARD",
                          "issues": [{"idReadable": "B-1"}]}]}]}]}]
            return [{"idReadable": "B-1", "summary": "bug", "customFields": [
                {"name": "State", "value": {"name": "Open"}},
                {"name": "Assignee", "value": {"name": "Amy"}},
                {"name": "Priority", "value": {"name": "High"}}]}]

    fake = FakeYt()
    stories = [{"storyId": "S-1", "state": "RE-OPEN"},
               {"storyId": "S-2", "state": "RE-OPEN"},
               {"storyId": "S-3", "state": "Done"}]
    drilldown.attach_drilldown(None, fake, stories)
    assert stories[2]["bugs"] == []
    assert stories[0]["bugs"][0]["bugId"] == "B-1"
    # ONE links query covering both re-open stories + ONE bug query — not per-story GETs
    assert len(fake.queries) == 2
    assert "S-1" in fake.queries[0] and "S-2" in fake.queries[0]
```

- [ ] **Step 2: Verify failure** — `python3 -m pytest tests/test_snapshot.py -k drilldown -q` → FAIL (per-story GET path issues ≥3 calls)

- [ ] **Step 3: Reimplement `attach_drilldown`** (pure resolvers `bug_candidates`/`resolve_bugs` unchanged):

```python
def attach_drilldown(ctx, yt, stories, chunk=40):
    """For each RE-OPEN story, resolve open bugs via its dev-ticket links and
    attach as story['bugs']; others get []. Batched: ONE chunked `issue ID:`
    query fetches every re-open story's nested links, then ONE more fetches all
    candidate bugs (was: a GET per story + a GET per bug). Mutates + returns."""
    LF = ("id,idReadable,links(direction,linkType(name),"
          "issues(id,idReadable,summary,links(direction,linkType(name),issues(id,idReadable))))")
    BF = "id,idReadable,summary,resolved,customFields(name,value(name,text))"
    reopen = [s for s in stories if "re-open" in (s.get("state") or "").lower()]
    for s in stories:
        s["bugs"] = []
    if not reopen:
        return stories

    def bulk(ids, fields):
        out = {}
        ids = [i for i in ids if i]
        for start in range(0, len(ids), chunk):
            batch = ids[start:start + chunk]
            for it in yt.get_issues(ctx, "issue ID: " + ", ".join(batch),
                                    fields=fields, top=max(len(batch), 50)):
                rid = it.get("idReadable")
                if rid:
                    out[rid] = it
        return out

    links_by_story = bulk([s["storyId"] for s in reopen], LF)
    candidates_by_story = {
        s["storyId"]: bug_candidates(links_by_story.get(s["storyId"]) or {})
        for s in reopen}
    all_bug_ids = {b for cand in candidates_by_story.values() for b in cand}
    bugs_by_id = bulk(sorted(all_bug_ids), BF)

    def fetch_bug(bid):
        return bugs_by_id.get(bid) or {"idReadable": bid, "customFields": []}

    for s in reopen:
        s["bugs"] = resolve_bugs(candidates_by_story[s["storyId"]], fetch_bug)
    return stories
```

- [ ] **Step 4: Run** — `python3 -m pytest tests/test_snapshot.py -q` → PASS
- [ ] **Step 5: Commit** — `perf(reports): batch drill-down links + bug fetches (2 queries, was per-story/per-bug)`

### Task 7: request-count reporting + LIVE old-vs-new verification

**Files:**
- Modify: `scripts/snapshot.py` (`main` :578–595)

- [ ] **Step 1: Print the counter** — at the end of `main` before `return 0`:

```python
    print("YouTrack requests this run: %d" % yt.REQUEST_COUNT)
```

- [ ] **Step 2: Baseline (OLD code)** — `git stash` the working tree? No — run the OLD pipeline from `master`'s copy in a temp dir instead, so both runs are minutes apart:

```bash
cd /Users/strata/Dev/positrack
set -a; . ~/.positrack-yt.env; set +a
git worktree add /tmp/pt-old origin/master
cd /tmp/pt-old && time python3 scripts/snapshot.py --project PXB1 --scope "PHASE 1" && cd -
```

Note: the old code has no counter — capture only wall-time + the printed summary lines.

- [ ] **Step 3: New run** — `time python3 scripts/snapshot.py --project PXB1 --scope "PHASE 1"` (repo root). Expected: `YouTrack requests this run:` ≤ 70; wall ≤ ~150 s.

- [ ] **Step 4: Diff the snapshots**

```bash
python3 - <<'EOF'
import json
old = json.load(open('/tmp/pt-old/web/data/latest.json'))
new = json.load(open('web/data/latest.json'))
IGNORE = {"generated_at_iso", "generated_at_ms", "as_of_hhmm"}
old["meta"] = {k: v for k, v in old["meta"].items() if k not in IGNORE}
new["meta"] = {k: v for k, v in new["meta"].items() if k not in IGNORE}
def walk(a, b, path="$"):
    if type(a) != type(b):
        print("TYPE", path, type(a), type(b)); return
    if isinstance(a, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a: print("ONLY-NEW", f"{path}.{k}")
            elif k not in b: print("ONLY-OLD", f"{path}.{k}")
            else: walk(a[k], b[k], f"{path}.{k}")
    elif isinstance(a, list):
        if len(a) != len(b): print("LEN", path, len(a), len(b))
        for i, (x, y) in enumerate(zip(a, b)): walk(x, y, f"{path}[{i}]")
    elif a != b:
        print("DIFF", path, repr(a)[:80], repr(b)[:80])
walk(old, new)
print("diff walk complete")
EOF
```

Expected: differences ONLY in live-data drift between the two runs' minutes-apart timing (spent minutes, updated-driven signal counts) and the documented ±1 boundary nuance on hygiene/gamification signal counts. Any effort rollup/bug list/schedule structure diff = a bug — STOP and fix before proceeding.

- [ ] **Step 5: Clean up + commit** — `git worktree remove /tmp/pt-old --force`; commit `perf(snapshot): report per-run YouTrack request count` and record the measured numbers in the commit body.

---

## Part 2 — Trigger + schedule config (spec A)

### Task 8: pure schedule rules (`dashboard/lib/schedule-rules.ts`)

**Files:**
- Create: `dashboard/lib/schedule-rules.ts`
- Test: `dashboard/tests/schedule-rules.test.ts`

- [ ] **Step 1: Failing tests:**

```ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCHEDULE, dueSlot, istParts, normalizeSchedule, parseSlot,
} from "../lib/schedule-rules";

// 2026-07-23 02:30:00 UTC == 08:00 IST (Thursday)
const T_0800_IST = Date.UTC(2026, 6, 23, 2, 30, 0);

describe("istParts", () => {
  it("converts UTC to IST wall-clock", () => {
    const p = istParts(T_0800_IST);
    expect(p).toEqual({ day: "thu", minutes: 8 * 60, date: "2026-07-23" });
  });
});

describe("parseSlot", () => {
  it("accepts HH:MM and rejects junk", () => {
    expect(parseSlot("09:45")).toBe(585);
    expect(parseSlot("8:00")).toBe(480);
    expect(parseSlot("24:00")).toBeNull();
    expect(parseSlot("nope")).toBeNull();
  });
});

describe("dueSlot", () => {
  it("fires a slot inside [tick, tick+15)", () => {
    expect(dueSlot(DEFAULT_SCHEDULE, T_0800_IST)).toBe("08:00");
    expect(dueSlot(DEFAULT_SCHEDULE, T_0800_IST - 15 * 60_000)).toBeNull();  // 07:45 tick
    expect(dueSlot(DEFAULT_SCHEDULE, T_0800_IST + 105 * 60_000)).toBe("09:45");
  });
  it("respects enabled / day mask / pause", () => {
    expect(dueSlot({ ...DEFAULT_SCHEDULE, enabled: false }, T_0800_IST)).toBeNull();
    expect(dueSlot({ ...DEFAULT_SCHEDULE, days: { ...DEFAULT_SCHEDULE.days, thu: false } },
                   T_0800_IST)).toBeNull();
    expect(dueSlot({ ...DEFAULT_SCHEDULE, paused_until: "2026-07-23" }, T_0800_IST)).toBeNull();
    expect(dueSlot({ ...DEFAULT_SCHEDULE, paused_until: "2026-07-22" }, T_0800_IST)).toBe("08:00");
  });
});

describe("normalizeSchedule", () => {
  it("sorts + dedupes + zero-pads slots, drops invalid", () => {
    const cfg = normalizeSchedule({ slots_ist: ["9:45", "08:00", "09:45", "bad"] });
    expect(cfg?.slots_ist).toEqual(["08:00", "09:45"]);
  });
  it("rejects empty slot lists and non-objects", () => {
    expect(normalizeSchedule({ slots_ist: [] })).toBeNull();
    expect(normalizeSchedule("x")).toBeNull();
  });
});
```

- [ ] **Step 2: Verify failure** — `cd dashboard && npx vitest run tests/schedule-rules.test.ts` → FAIL (module missing)

- [ ] **Step 3: Implement `dashboard/lib/schedule-rules.ts`** (pure, no I/O — the admin panel client imports it too):

```ts
/**
 * Admin-managed refresh schedule: pure types + rules. The Vercel Cron tick
 * (app/api/cron/refresh) asks dueSlot() whether a configured IST slot falls in
 * this 15-min window; the admin panel edits and normalizeSchedule() validates.
 * Times are IST wall-clock ("HH:MM") — the team's shared meeting reference.
 */

export interface ScheduleConfig {
  enabled: boolean;
  days: Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", boolean>;
  slots_ist: string[];
  /** "YYYY-MM-DD" (IST date), inclusive — refreshes resume the day after. */
  paused_until: string | null;
  updated_at?: string;
  updated_by?: string;
}

export const DEFAULT_SCHEDULE: ScheduleConfig = {
  enabled: true,
  days: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true },
  slots_ist: ["08:00", "09:45", "12:00", "16:00", "19:00"],
  paused_until: null,
};

const IST_OFFSET_MIN = 330;
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** IST wall-clock parts for a UTC instant (fixed +05:30, never the runner TZ). */
export function istParts(utcMs: number): {
  day: (typeof DAY_KEYS)[number]; minutes: number; date: string;
} {
  const d = new Date(utcMs + IST_OFFSET_MIN * 60_000);
  return {
    day: DAY_KEYS[d.getUTCDay()],
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
    date: d.toISOString().slice(0, 10),
  };
}

/** "HH:MM" (24h) → minutes-since-midnight, or null if invalid. */
export function parseSlot(s: string): number | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(s.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/**
 * The slot due in [now, now+windowMin), or null. Slots very close to IST
 * midnight interact with the day mask of the day they START in — keep slots
 * inside working hours (the panel's use case) and this never matters.
 */
export function dueSlot(cfg: ScheduleConfig, nowUtcMs: number, windowMin = 15): string | null {
  if (!cfg.enabled) return null;
  const p = istParts(nowUtcMs);
  if (cfg.paused_until && p.date <= cfg.paused_until) return null;
  if (!cfg.days[p.day]) return null;
  for (const s of cfg.slots_ist) {
    const m = parseSlot(s);
    if (m !== null && m >= p.minutes && m < p.minutes + windowMin) return s;
  }
  return null;
}

/** Validate + canonicalize untrusted input into a ScheduleConfig (null = reject). */
export function normalizeSchedule(input: unknown): ScheduleConfig | null {
  if (typeof input !== "object" || input === null) return null;
  const o = input as Record<string, unknown>;
  const days = { ...DEFAULT_SCHEDULE.days };
  if (typeof o.days === "object" && o.days !== null) {
    for (const k of Object.keys(days) as (keyof ScheduleConfig["days"])[]) {
      const v = (o.days as Record<string, unknown>)[k];
      if (typeof v === "boolean") days[k] = v;
    }
  }
  const raw = Array.isArray(o.slots_ist) ? o.slots_ist : DEFAULT_SCHEDULE.slots_ist;
  const canon = raw
    .filter((s): s is string => typeof s === "string" && parseSlot(s) !== null)
    .map((s) => {
      const m = parseSlot(s)!;
      return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    });
  const slots = [...new Set(canon)].sort((a, b) => parseSlot(a)! - parseSlot(b)!);
  if (slots.length === 0 || slots.length > 24) return null;
  const paused =
    typeof o.paused_until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.paused_until)
      ? o.paused_until
      : null;
  return { enabled: o.enabled !== false, days, slots_ist: slots, paused_until: paused };
}
```

- [ ] **Step 4: Run** — `npx vitest run tests/schedule-rules.test.ts` → PASS
- [ ] **Step 5: Commit** — `feat(reports): pure schedule rules for the cron tick + admin panel`

### Task 9: schedule config I/O (`dashboard/lib/schedule-config.ts`) + `@vercel/blob` dep

**Files:**
- Create: `dashboard/lib/schedule-config.ts`
- Modify: `dashboard/package.json` (dep add)

- [ ] **Step 1:** `cd dashboard && npm install @vercel/blob@1`

- [ ] **Step 2: Implement** (I/O layer — no unit tests; exercised by the admin round-trip in Task 21):

```ts
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";
import { DEFAULT_SCHEDULE, normalizeSchedule, type ScheduleConfig } from "./schedule-rules";

/**
 * schedule.json lives beside the snapshot in the SECRET Blob path (same
 * unguessable-prefix posture — see lib/data.ts). Reads use the public URL via
 * SNAPSHOT_DATA_URL; writes need BLOB_READ_WRITE_TOKEN (store connected to the
 * Vercel project). Dev without SNAPSHOT_DATA_URL falls back to
 * dashboard/data/schedule.json, mirroring loadSnapshot()'s local-file pattern.
 */
const BASE = process.env.SNAPSHOT_DATA_URL;

function localPath(): string {
  return path.join(process.cwd(), "data", "schedule.json");
}

/** The Blob pathname — the secret prefix is SNAPSHOT_DATA_URL's path part. */
function blobPathname(): string | null {
  if (!BASE) return null;
  try {
    const prefix = new URL(BASE).pathname.replace(/^\/+|\/+$/g, "");
    return prefix ? `${prefix}/schedule.json` : null;
  } catch {
    return null;
  }
}

export async function readSchedule(): Promise<ScheduleConfig> {
  if (!BASE) {
    try {
      if (fs.existsSync(localPath())) {
        return normalizeSchedule(JSON.parse(fs.readFileSync(localPath(), "utf-8")))
          ?? DEFAULT_SCHEDULE;
      }
    } catch { /* fall through to defaults */ }
    return DEFAULT_SCHEDULE;
  }
  try {
    const res = await fetch(`${BASE}/schedule.json`, { cache: "no-store" });
    if (!res.ok) return DEFAULT_SCHEDULE;   // not created yet → seeded defaults
    return normalizeSchedule(await res.json()) ?? DEFAULT_SCHEDULE;
  } catch {
    return DEFAULT_SCHEDULE;
  }
}

export async function writeSchedule(cfg: ScheduleConfig, updatedBy = "admin"): Promise<void> {
  const body = JSON.stringify(
    { ...cfg, updated_at: new Date().toISOString(), updated_by: updatedBy }, null, 1);
  const pathname = blobPathname();
  if (!pathname) {
    fs.mkdirSync(path.dirname(localPath()), { recursive: true });
    fs.writeFileSync(localPath(), body);
    return;
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is not set — connect the Blob store to this Vercel project.");
  }
  await put(pathname, body, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
    contentType: "application/json",
  });
}
```

- [ ] **Step 3:** `npx tsc --noEmit` → clean
- [ ] **Step 4: Commit** — `feat(reports): schedule.json read/write on the secret Blob path`

### Task 10: GitHub dispatch client (`dashboard/lib/github.ts`)

**Files:**
- Create: `dashboard/lib/github.ts`

- [ ] **Step 1: Implement:**

```ts
import "server-only";

/**
 * Minimal GitHub Actions client for the snapshot workflow. GH's own `schedule:`
 * trigger drifts 1–3.5 h (measured Jul 2026), while workflow_dispatch runs
 * start within seconds — so the punctual path is Vercel Cron → our route →
 * these calls. Auth: GH_DISPATCH_TOKEN (fine-grained PAT, Actions r/w on
 * stratahqsa/positrack only).
 */
const REPO = "stratahqsa/positrack";
const WORKFLOW = "snapshot.yml";
const API = "https://api.github.com";

function ghHeaders(): Record<string, string> {
  const token = process.env.GH_DISPATCH_TOKEN;
  if (!token) throw new Error("GH_DISPATCH_TOKEN is not set");
  return {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
  };
}

export async function dispatchSnapshot(): Promise<void> {
  const res = await fetch(`${API}/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: ghHeaders(),
    body: JSON.stringify({ ref: "master" }),
    cache: "no-store",
  });
  if (res.status !== 204) {
    throw new Error(`workflow dispatch failed (${res.status}): ${await res.text()}`);
  }
}

export interface RunInfo {
  id: number;
  event: string;
  status: string;               // queued | in_progress | completed
  conclusion: string | null;    // success | failure | ... (null while running)
  created_at: string;
  updated_at: string;
  html_url: string;
}

export async function listSnapshotRuns(limit = 10): Promise<RunInfo[]> {
  const res = await fetch(
    `${API}/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=${limit}`,
    { headers: ghHeaders(), cache: "no-store" },
  );
  if (!res.ok) throw new Error(`runs fetch failed (${res.status})`);
  const data = (await res.json()) as { workflow_runs?: RunInfo[] };
  return (data.workflow_runs ?? []).map((r) => ({
    id: r.id,
    event: r.event,
    status: r.status,
    conclusion: r.conclusion,
    created_at: r.created_at,
    updated_at: r.updated_at,
    html_url: r.html_url,
  }));
}
```

- [ ] **Step 2:** `npx tsc --noEmit` → clean
- [ ] **Step 3: Commit** — `feat(reports): GitHub workflow dispatch + run-list client`

### Task 11: cron tick route + middleware exemption + vercel.json cron

**Files:**
- Create: `dashboard/app/api/cron/refresh/route.ts`
- Modify: `dashboard/middleware.ts:17` (public paths), `dashboard/vercel.json`

- [ ] **Step 1: Route:**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { readSchedule } from "@/lib/schedule-config";
import { dueSlot } from "@/lib/schedule-rules";
import { dispatchSnapshot } from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Vercel Cron TICK (every 15 min — vercel.json). Consults the
 * admin-managed schedule and dispatches the GitHub snapshot workflow when an
 * IST slot falls inside this tick's window; otherwise a cheap no-op. Auth:
 * Vercel injects `Authorization: Bearer ${CRON_SECRET}` on cron invocations.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const cfg = await readSchedule();
  const slot = dueSlot(cfg, Date.now());
  if (!slot) {
    return NextResponse.json({
      ok: true,
      action: "no-op",
      reason: !cfg.enabled ? "disabled" : "no slot due in this window",
    });
  }
  try {
    await dispatchSnapshot();
    console.log(`cron/refresh: dispatched snapshot for IST slot ${slot}`);
    return NextResponse.json({ ok: true, action: "dispatched", slot });
  } catch (e) {
    console.error("cron/refresh: dispatch failed", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}
```

- [ ] **Step 2: Middleware** — in `middleware.ts`, extend the public-paths check:

```ts
  // Public paths: login + its handler, and the cron tick (self-guarded by
  // CRON_SECRET — Vercel Cron sends no session cookie).
  if (
    pathname === "/login" ||
    pathname === "/api/login" ||
    pathname === "/api/cron/refresh"
  ) {
    return NextResponse.next();
  }
```

- [ ] **Step 3: vercel.json:**

```json
{
  "framework": "nextjs",
  "crons": [{ "path": "/api/cron/refresh", "schedule": "*/15 * * * *" }]
}
```

- [ ] **Step 4:** `npm run build` → green. Local auth check: `npm run dev` then `curl -s localhost:3000/api/cron/refresh | head -c 120` → `{"ok":false,"error":"unauthorized"}` (no CRON_SECRET locally → 401 path).
- [ ] **Step 5: Commit** — `feat(reports): Vercel Cron tick route — schedule-gated snapshot dispatch`

### Task 12: workflow — fallback-only schedule + config gate job + throttle env

**Files:**
- Create: `scripts/schedule_gate.mjs`
- Modify: `.github/workflows/snapshot.yml`

- [ ] **Step 1: Gate script** `scripts/schedule_gate.mjs`:

```js
#!/usr/bin/env node
/**
 * Schedule gate for the GitHub `schedule:` FALLBACK trigger only (the workflow
 * skips this for workflow_dispatch — explicit intent always runs). Reads the
 * admin-managed schedule.json from the secret Blob path and decides whether
 * today's fallback should run: enabled, not paused, today's IST weekday on.
 * FAIL-OPEN: any fetch/parse problem lets the fallback run — a stale-data
 * outage is worse than one extra snapshot.
 *
 * Writes `run=true|false` to $GITHUB_OUTPUT (job output `gate.outputs.run`).
 */
import fs from "node:fs";
import { list } from "@vercel/blob";

function out(run, reason) {
  console.log(`gate: run=${run} — ${reason}`);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `run=${run}\n`);
  }
  process.exit(0);
}

const secret = (process.env.SNAPSHOT_SECRET || "").replace(/\/+$/, "");
if (!secret || !process.env.BLOB_READ_WRITE_TOKEN) {
  out(true, "no blob credentials — fail-open");
}

try {
  const { blobs } = await list({ prefix: `${secret}/schedule.json` });
  const hit = blobs.find((b) => b.pathname === `${secret}/schedule.json`);
  if (!hit) out(true, "no schedule.json yet — fail-open");
  const res = await fetch(hit.url, { cache: "no-store" });
  const cfg = await res.json();
  if (cfg.enabled === false) out(false, "schedule disabled in the admin panel");
  const ist = new Date(Date.now() + 330 * 60_000);
  const date = ist.toISOString().slice(0, 10);
  if (typeof cfg.paused_until === "string" && date <= cfg.paused_until) {
    out(false, `paused until ${cfg.paused_until}`);
  }
  const day = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][ist.getUTCDay()];
  if (cfg.days && cfg.days[day] === false) out(false, `${day} disabled`);
  out(true, "fallback due");
} catch (e) {
  out(true, `gate error (${e && e.message}) — fail-open`);
}
```

- [ ] **Step 2: Workflow edits** in `.github/workflows/snapshot.yml`:
  1. Replace the `schedule:` block:

```yaml
on:
  schedule:
    # FALLBACK ONLY (5am IST): punctual runs come from Vercel Cron →
    # dashboard /api/cron/refresh → workflow_dispatch (GH `schedule` drifts
    # 1-3.5h — measured Jul 2026). This nightly net means data can never go
    # >24h stale even if the Vercel side breaks; it respects the admin panel's
    # schedule config via the `gate` job below.
    - cron: "30 23 * * *"
  workflow_dispatch:
    # ... (inputs unchanged)
```

  2. Restructure `jobs:` — add a `gate` job and make `snapshot` depend on it:

```yaml
jobs:
  gate:
    runs-on: ubuntu-latest
    outputs:
      run: ${{ steps.gate.outputs.run }}
    steps:
      - uses: actions/checkout@v7
      - name: Schedule gate (fallback runs respect the admin config)
        id: gate
        env:
          BLOB_READ_WRITE_TOKEN: ${{ secrets.BLOB_READ_WRITE_TOKEN }}
          SNAPSHOT_SECRET: ${{ secrets.SNAPSHOT_SECRET }}
        run: |
          if [ "${{ github.event_name }}" != "schedule" ]; then
            echo "run=true" >> "$GITHUB_OUTPUT"
            echo "gate: run=true — workflow_dispatch always runs"
          else
            npm install --no-save @vercel/blob@1
            node scripts/schedule_gate.mjs
          fi

  snapshot:
    needs: gate
    if: needs.gate.outputs.run == 'true'
    runs-on: ubuntu-latest
    steps:
      # ... (all existing steps unchanged, except:)
```

  3. In the `Produce snapshot` step's `env:` block, add `YT_THROTTLE_MS: "150"`.
  4. Update the top-of-file comment block: hourly → "5 slots via Vercel Cron + nightly fallback", and note the request-count drop.

- [ ] **Step 3: Validate YAML** — `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/snapshot.yml')); print('yaml ok')"` (pyyaml is available in the venv; if not, `npx yaml-lint` or careful review).
- [ ] **Step 4: Commit** — `feat(ci): schedule→fallback-only + admin-config gate; punctual runs move to Vercel Cron`

---

## Part 3 — Admin panel (spec B)

### Task 13: admin auth (cookie + login route/page + middleware)

**Files:**
- Modify: `dashboard/lib/auth.ts` (one export), `dashboard/middleware.ts`
- Create: `dashboard/app/api/admin/login/route.ts`, `dashboard/app/admin/login/page.tsx`, `dashboard/components/admin/admin-login-form.tsx`

- [ ] **Step 1:** In `lib/auth.ts`, below `SESSION_COOKIE`:

```ts
/** Separate admin session — signed with ADMIN_CODE, so the viewer PIN can
 *  never mint it and rotating either code invalidates only its own sessions. */
export const ADMIN_COOKIE = "posx_admin_session";
```

- [ ] **Step 2: Admin login route** `app/api/admin/login/route.ts` — mirror of `app/api/login/route.ts` with three substitutions: `ACCESS_CODE`→`ADMIN_CODE`, `SESSION_COOKIE`→`ADMIN_COOKIE`, error text `"Incorrect admin code."`; 503 text `"ADMIN_CODE not configured on the server."`. Full file:

```ts
import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_COOKIE,
  SESSION_MAX_AGE,
  codeMatches,
  createSessionToken,
} from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/admin/login { code } → sets the ADMIN session cookie (separate
 *  code + cookie from the viewer gate; see lib/auth.ts). */
export async function POST(req: NextRequest) {
  const adminCode = process.env.ADMIN_CODE;
  if (!adminCode) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_CODE not configured on the server." },
      { status: 503 },
    );
  }
  let code = "";
  try {
    const body = await req.json();
    code = typeof body?.code === "string" ? body.code : "";
  } catch {
    try {
      const form = await req.formData();
      code = String(form.get("code") ?? "");
    } catch {
      code = "";
    }
  }
  if (!codeMatches(code.trim(), adminCode)) {
    return NextResponse.json({ ok: false, error: "Incorrect admin code." }, { status: 401 });
  }
  const token = await createSessionToken(adminCode);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}

/** DELETE /api/admin/login → clear the admin session. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
```

- [ ] **Step 3: Middleware** — after the existing viewer-gate logic's public-path block, add the admin branch BEFORE the viewer check (admin paths need the admin cookie, not just the viewer one):

```ts
  // Admin surface: /admin* pages + /api/admin/* need the ADMIN session
  // (separate ADMIN_CODE — the shared viewer PIN must not manage schedules).
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (pathname === "/admin/login" || pathname === "/api/admin/login") {
      return NextResponse.next();
    }
    const adminCode = process.env.ADMIN_CODE;
    if (!adminCode) return NextResponse.next(); // page renders a config notice
    const adminTok = req.cookies.get(ADMIN_COOKIE)?.value;
    if (await verifySessionToken(adminTok, adminCode)) return NextResponse.next();
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: "admin session required" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
```

(import `ADMIN_COOKIE` alongside the existing auth imports.)

- [ ] **Step 4: Admin login page + form.** `components/admin/admin-login-form.tsx` = copy of `components/login-form.tsx` with: POST target `/api/admin/login`, success `router.replace("/admin")`, heading "POSX Reports — Admin", icon `ShieldCheck` (lucide), input placeholder "Admin code". `app/admin/login/page.tsx` mirrors `app/login/page.tsx` (read it first; same structure, renders `<AdminLoginForm configured={Boolean(process.env.ADMIN_CODE)} />`).

- [ ] **Step 5:** `npm run build` → green. Manual: `ADMIN_CODE=test npm run dev`, visit `/admin` → redirected to `/admin/login`; wrong code → error; right code → lands on `/admin` (404 for now — page comes in Task 15).
- [ ] **Step 6: Commit** — `feat(reports): ADMIN_CODE-gated admin session (separate cookie + login)`

### Task 14: admin APIs — schedule GET/PUT, refresh-now, runs

**Files:**
- Create: `dashboard/app/api/admin/schedule/route.ts`, `dashboard/app/api/admin/refresh/route.ts`, `dashboard/app/api/admin/runs/route.ts`

- [ ] **Step 1: schedule route:**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { readSchedule, writeSchedule } from "@/lib/schedule-config";
import { normalizeSchedule } from "@/lib/schedule-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET → current schedule config; PUT → validate + persist. Auth: middleware
 *  requires the admin session for every /api/admin/* path. */
export async function GET() {
  return NextResponse.json({ ok: true, config: await readSchedule() });
}

export async function PUT(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  const cfg = normalizeSchedule(body);
  if (!cfg) {
    return NextResponse.json(
      { ok: false, error: "invalid schedule (need ≥1 valid HH:MM slot)" },
      { status: 400 },
    );
  }
  try {
    await writeSchedule(cfg);
    return NextResponse.json({ ok: true, config: cfg });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}
```

- [ ] **Step 2: refresh route** (the debounced Refresh Now):

```ts
import { NextResponse } from "next/server";
import { dispatchSnapshot, listSnapshotRuns } from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECENT_MS = 15 * 60_000;

/** POST → dispatch a snapshot run now, UNLESS one is already running or
 *  finished <15 min ago (returns that instead — keeps a shared button from
 *  hammering YouTrack). Manual GitHub-UI dispatch stays available regardless. */
export async function POST() {
  try {
    const [latest] = await listSnapshotRuns(1);
    if (latest && (latest.status === "queued" || latest.status === "in_progress")) {
      return NextResponse.json({ ok: true, action: "already-running", run: latest });
    }
    if (latest && Date.now() - new Date(latest.created_at).getTime() < RECENT_MS) {
      return NextResponse.json({ ok: true, action: "recently-completed", run: latest });
    }
    await dispatchSnapshot();
    return NextResponse.json({ ok: true, action: "dispatched" });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}
```

- [ ] **Step 3: runs route:**

```ts
import { NextResponse } from "next/server";
import { listSnapshotRuns } from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET → the last 10 snapshot workflow runs for the admin panel's history. */
export async function GET() {
  try {
    return NextResponse.json({ ok: true, runs: await listSnapshotRuns(10) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}
```

- [ ] **Step 4:** `npm run build` → green; `npx tsc --noEmit` → clean.
- [ ] **Step 5: Commit** — `feat(reports): admin APIs — schedule read/write, debounced refresh-now, run history`

### Task 15: admin panel UI (`/admin`)

**Files:**
- Create: `dashboard/app/admin/page.tsx`, `dashboard/components/admin/admin-panel.tsx`
- Modify: `dashboard/components/shell/header.tsx` (gear link)

- [ ] **Step 1: Page** `app/admin/page.tsx` (server component; read `app/effort/page.tsx` first for the Header/layout skeleton and copy its outer chrome):

```tsx
import { Header } from "@/components/shell/header";
import { Nav } from "@/components/shell/nav";
import { AdminPanel } from "@/components/admin/admin-panel";
import { loadSnapshot } from "@/lib/data";
import { readSchedule } from "@/lib/schedule-config";
import { listSnapshotRuns, type RunInfo } from "@/lib/github";
import { currentTz } from "@/lib/tz-server";

export const dynamic = "force-dynamic";

/** /admin — schedule editor + Refresh Now + run history (ADMIN_CODE-gated by
 *  middleware). Run history is best-effort: a GH API hiccup renders the panel
 *  without it rather than failing the page. */
export default async function AdminPage() {
  const snap = await loadSnapshot();
  const cfg = await readSchedule();
  const tz = await currentTz();
  let runs: RunInfo[] = [];
  let runsError: string | null = null;
  try {
    runs = await listSnapshotRuns(10);
  } catch (e) {
    runsError = String(e);
  }
  return (
    <div className="min-h-screen">
      <Header
        project={snap.meta.project}
        scope={snap.meta.scope}
        asOf={snap.meta.as_of_hhmm}
        generatedAtIso={snap.meta.generated_at_iso}
      />
      <Nav />
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        <AdminPanel initial={cfg} runs={runs} runsError={runsError} tz={tz} />
      </main>
    </div>
  );
}
```

(If Task 17 isn't done yet, stub `currentTz` usage with `"Asia/Kolkata"` and wire it properly in Task 18 — build must stay green at every commit. Check `app/effort/page.tsx` for the exact `<Nav />` usage/props before copying.)

- [ ] **Step 2: Panel client component** `components/admin/admin-panel.tsx` — one file, four sections (uses `Card`, `Badge`, `cn`, `fmtDateTime` once Task 16 lands — until then use `new Date(...).toLocaleString()` and swap in Task 18):

```tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarOff, Clock, Loader2, Play, Plus, RefreshCw, Save, Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DEFAULT_SCHEDULE, parseSlot, type ScheduleConfig,
} from "@/lib/schedule-rules";
import type { RunInfo } from "@/lib/github";
import { fmtDateTime } from "@/lib/format";

const DAY_LABELS: [keyof ScheduleConfig["days"], string][] = [
  ["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"],
  ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"],
];

export function AdminPanel({
  initial, runs, runsError, tz,
}: {
  initial: ScheduleConfig;
  runs: RunInfo[];
  runsError: string | null;
  tz: string;
}) {
  const router = useRouter();
  const [cfg, setCfg] = React.useState<ScheduleConfig>(initial);
  const [newSlot, setNewSlot] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [savedMsg, setSavedMsg] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [refreshMsg, setRefreshMsg] = React.useState<string | null>(null);

  function addSlot() {
    const m = parseSlot(newSlot);
    if (m === null) { setSavedMsg("Invalid time — use HH:MM (24h, IST)"); return; }
    const canon = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    if (!cfg.slots_ist.includes(canon)) {
      setCfg({ ...cfg, slots_ist: [...cfg.slots_ist, canon].sort(
        (a, b) => parseSlot(a)! - parseSlot(b)!) });
    }
    setNewSlot("");
    setSavedMsg(null);
  }

  async function save() {
    setSaving(true); setSavedMsg(null);
    try {
      const res = await fetch("/api/admin/schedule", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const data = await res.json().catch(() => ({}));
      setSavedMsg(res.ok ? "Saved — takes effect on the next 15-min tick."
                         : (data?.error || "Save failed"));
      if (res.ok && data?.config) setCfg(data.config);
    } catch {
      setSavedMsg("Network error — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function refreshNow() {
    setRefreshing(true); setRefreshMsg(null);
    try {
      const res = await fetch("/api/admin/refresh", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setRefreshMsg(data?.error || "Trigger failed");
      else if (data.action === "dispatched")
        setRefreshMsg("Refresh started — new data lands in ~2-3 minutes.");
      else if (data.action === "already-running")
        setRefreshMsg("A refresh is already running — hang tight.");
      else setRefreshMsg("A refresh finished under 15 minutes ago — data is fresh.");
      router.refresh();
    } catch {
      setRefreshMsg("Network error — try again.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* ---- Refresh now + status ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="size-4 text-accent" /> Refresh now
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[12.5px] text-muted">
            Triggers a full snapshot immediately (finishes in ~2–3 min). Guarded:
            won&apos;t double-fire if a run is active or just finished.
          </p>
          <button
            onClick={refreshNow}
            disabled={refreshing}
            className={cn(
              "inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2",
              "text-[13px] font-semibold text-bg transition hover:opacity-90",
              refreshing && "opacity-60",
            )}
          >
            {refreshing ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            Refresh data now
          </button>
          {refreshMsg ? <p className="text-[12.5px] text-fg/90">{refreshMsg}</p> : null}
        </CardContent>
      </Card>

      {/* ---- Run history ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-4 text-accent" /> Recent refresh runs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {runsError ? (
            <p className="text-[12.5px] text-muted">Run history unavailable ({runsError}).</p>
          ) : (
            <table className="w-full text-[12.5px]">
              <thead className="text-left text-faint">
                <tr><th className="pb-1 font-medium">Started</th>
                    <th className="pb-1 font-medium">Trigger</th>
                    <th className="pb-1 font-medium">Status</th></tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-t border-border/60">
                    <td className="py-1.5 tabular">
                      {fmtDateTime(new Date(r.created_at).getTime(), tz)}
                    </td>
                    <td className="py-1.5">
                      {r.event === "workflow_dispatch" ? "manual / cron" : "fallback"}
                    </td>
                    <td className="py-1.5">
                      <Badge
                        variant={
                          r.status !== "completed" ? "info"
                          : r.conclusion === "success" ? "good" : "danger"
                        }
                      >
                        {r.status !== "completed" ? r.status : r.conclusion}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* ---- Schedule editor ---- */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarOff className="size-4 text-accent" /> Refresh schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-[13px] text-fg">
            <input
              type="checkbox"
              checked={cfg.enabled}
              onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}
            />
            Scheduled refreshes enabled
          </label>

          <div>
            <p className="mb-1.5 text-[12px] font-medium text-muted">Days (IST)</p>
            <div className="flex flex-wrap gap-1.5">
              {DAY_LABELS.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setCfg({ ...cfg, days: { ...cfg.days, [key]: !cfg.days[key] } })}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[12px] font-medium transition",
                    cfg.days[key]
                      ? "border-accent/50 bg-accent/15 text-accent"
                      : "border-border bg-surface text-faint line-through",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[12px] font-medium text-muted">
              Refresh times (IST) — each run takes ~2–3 min
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {cfg.slots_ist.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[12.5px] tabular text-fg">
                  {s}
                  <button
                    onClick={() => setCfg({ ...cfg, slots_ist: cfg.slots_ist.filter((x) => x !== s) })}
                    aria-label={`Remove ${s}`}
                    className="text-faint hover:text-danger"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              ))}
              <input
                value={newSlot}
                onChange={(e) => setNewSlot(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSlot()}
                placeholder="HH:MM"
                className="w-20 rounded-md border border-border bg-surface px-2 py-1 text-[12.5px] tabular text-fg placeholder:text-faint"
              />
              <button
                onClick={addSlot}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[12px] text-muted hover:text-fg"
              >
                <Plus className="size-3.5" /> Add
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[12px] font-medium text-muted" htmlFor="pause">
              Pause until (inclusive, IST date)
            </label>
            <input
              id="pause"
              type="date"
              value={cfg.paused_until ?? ""}
              onChange={(e) => setCfg({ ...cfg, paused_until: e.target.value || null })}
              className="rounded-md border border-border bg-surface px-2 py-1 text-[12.5px] text-fg"
            />
            {cfg.paused_until ? (
              <button
                onClick={() => setCfg({ ...cfg, paused_until: null })}
                className="text-[12px] text-accent hover:underline"
              >
                clear
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-3 border-t border-border/60 pt-3">
            <button
              onClick={save}
              disabled={saving || cfg.slots_ist.length === 0}
              className={cn(
                "inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2",
                "text-[13px] font-semibold text-bg transition hover:opacity-90",
                (saving || cfg.slots_ist.length === 0) && "opacity-60",
              )}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save schedule
            </button>
            <button
              onClick={() => setCfg(DEFAULT_SCHEDULE)}
              className="text-[12.5px] text-muted hover:text-fg"
            >
              Reset to defaults
            </button>
            {savedMsg ? <span className="text-[12.5px] text-fg/90">{savedMsg}</span> : null}
          </div>
          <p className="text-[11.5px] text-faint">
            A nightly 5am IST fallback run also respects these settings. Manual
            triggers (this page&apos;s button or the GitHub UI) always run.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

Before writing, read `components/ui/badge.tsx` to confirm the exact `variant` names (`good`/`danger`/`info` per badge-tone conventions) and adjust if they differ.

- [ ] **Step 2: Header gear** — in `components/shell/header.tsx`, next to `<ThemeToggle />` add:

```tsx
import Link from "next/link";
import { Radar, Settings } from "lucide-react";
// ... in the right-hand cluster, before <ThemeToggle />:
          <Link
            href="/admin"
            aria-label="Admin"
            className="flex size-8 items-center justify-center rounded-md border border-border bg-surface/60 text-muted transition hover:text-fg"
          >
            <Settings className="size-4" />
          </Link>
```

- [ ] **Step 3: Verify** — `ADMIN_CODE=test npm run dev`: log in at `/admin/login`, toggle a day off, add slot `21:15`, Save → check `dashboard/data/schedule.json` written (dev fallback); Refresh Now → without `GH_DISPATCH_TOKEN` locally expect the error surfaced gracefully. `npm run build` → green.
- [ ] **Step 4: Commit** — `feat(reports): /admin panel — schedule editor, refresh-now, run history`

---

## Part 4 — Timezone (spec D) + snappiness (spec E)

### Task 16: tz core + `fmtDateTime`

**Files:**
- Create: `dashboard/lib/tz.ts`, `dashboard/lib/tz-server.ts`
- Modify: `dashboard/lib/format.ts`
- Test: `dashboard/tests/tz.test.ts`, `dashboard/tests/format.test.ts` (append)

- [ ] **Step 1: Failing tests** — `tests/tz.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { IST, SAST, resolveTz } from "../lib/tz";

describe("resolveTz", () => {
  it("explicit pref wins", () => {
    expect(resolveTz(SAST, "Asia/Dubai")).toBe(SAST);
    expect(resolveTz(IST, undefined)).toBe(IST);
  });
  it("auto uses detected when valid", () => {
    expect(resolveTz("auto", "Asia/Dubai")).toBe("Asia/Dubai");
    expect(resolveTz(undefined, "Asia/Dubai")).toBe("Asia/Dubai");
  });
  it("falls back to IST on junk", () => {
    expect(resolveTz("auto", "Not/AZone")).toBe(IST);
    expect(resolveTz(undefined, undefined)).toBe(IST);
    expect(resolveTz("<script>", undefined)).toBe(IST);
  });
});
```

Append to `tests/format.test.ts`:

```ts
import { fmtDateTime, fmtTimeShort, tzLabel } from "../lib/format";

describe("fmtDateTime (tz-aware)", () => {
  it("matches fmtDateTimeIst exactly for IST", () => {
    for (const ms of [1751971500000, 1783941449646, 1783953000000]) {
      expect(fmtDateTime(ms, "Asia/Kolkata")).toBe(fmtDateTimeIst(ms));
    }
  });
  it("renders SAST 3.5h behind IST", () => {
    // 1783941449646 = 13 Jul 2026, 4:47 PM IST → 1:17 PM SAST
    expect(fmtDateTime(1783941449646, "Africa/Johannesburg")).toBe("13 Jul 2026, 1:17 PM");
  });
  it("null → em dash", () => {
    expect(fmtDateTime(null, "Asia/Kolkata")).toBe("—");
  });
});

describe("fmtTimeShort / tzLabel", () => {
  it("HH:mm in the target zone", () => {
    expect(fmtTimeShort(1783941449646, "Asia/Kolkata")).toBe("16:47");
    expect(fmtTimeShort(null, "Asia/Kolkata")).toBe("—");
  });
  it("labels the team zones, falls back to short name", () => {
    expect(tzLabel("Asia/Kolkata")).toBe("IST");
    expect(tzLabel("Africa/Johannesburg")).toBe("SAST");
    expect(typeof tzLabel("Asia/Dubai")).toBe("string");
  });
});
```

- [ ] **Step 2: Verify failure** — `npx vitest run tests/tz.test.ts tests/format.test.ts` → FAIL

- [ ] **Step 3: Implement.** `lib/tz.ts` (pure — client-importable):

```ts
/**
 * Per-BROWSER timezone preference (the access PIN is shared, so this must
 * never be global): a `posx_tz` cookie holds the explicit choice (or "auto"),
 * and `posx_tz_detected` carries the browser's own IANA zone (written by
 * TzInit) so the SERVER can render "auto" correctly. Pages are force-dynamic,
 * so cookie-driven SSR means no hydration mismatch and no client reformatting.
 */
export const TZ_COOKIE = "posx_tz";
export const TZ_DETECTED_COOKIE = "posx_tz_detected";
export const IST = "Asia/Kolkata";
export const SAST = "Africa/Johannesburg";
export type TzPref = "auto" | typeof IST | typeof SAST;

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Effective IANA zone from (preference cookie, detected cookie). IST fallback. */
export function resolveTz(pref: string | undefined, detected: string | undefined): string {
  if (pref === IST || pref === SAST) return pref;
  if (detected && isValidTimeZone(detected)) return detected;
  return IST;
}
```

`lib/tz-server.ts`:

```ts
import "server-only";
import { cookies } from "next/headers";
import { IST, SAST, TZ_COOKIE, TZ_DETECTED_COOKIE, resolveTz, type TzPref } from "./tz";

/** The resolved IANA zone for this request (cookie-driven; IST fallback). */
export async function currentTz(): Promise<string> {
  const c = await cookies();
  return resolveTz(c.get(TZ_COOKIE)?.value, c.get(TZ_DETECTED_COOKIE)?.value);
}

/** The raw preference ("auto" unless explicitly IST/SAST) for the toggle UI. */
export async function currentTzPref(): Promise<TzPref> {
  const c = await cookies();
  const v = c.get(TZ_COOKIE)?.value;
  return v === IST || v === SAST ? v : "auto";
}
```

Append to `lib/format.ts`:

```ts
/**
 * Epoch ms -> "DD Mon YYYY, h:mm AM/PM" in an arbitrary IANA zone via Intl —
 * the tz-aware generalization of fmtDateTimeIst (kept above: same output for
 * tz="Asia/Kolkata", proven by tests). Falls back to the IST formatter if the
 * zone string is somehow invalid at render time.
 */
export function fmtDateTime(ms: number | null, tz: string): string {
  if (ms == null) return "—";
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(ms);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const period = get("dayPeriod").replace(/\./g, "").toUpperCase();
    return `${get("day")} ${get("month")} ${get("year")}, ${get("hour")}:${get("minute")} ${period}`;
  } catch {
    return fmtDateTimeIst(ms);
  }
}

/** Epoch ms -> "HH:mm" (24h) in an IANA zone; null/invalid -> "—". */
export function fmtTimeShort(ms: number | null, tz: string): string {
  if (ms == null) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(ms);
  } catch {
    return "—";
  }
}

/** Short display label for a zone: the team zones get their familiar names. */
export function tzLabel(tz: string): string {
  if (tz === "Asia/Kolkata") return "IST";
  if (tz === "Africa/Johannesburg") return "SAST";
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, timeZoneName: "short",
    }).formatToParts(Date.now());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
  } catch {
    return tz;
  }
}
```

- [ ] **Step 4: Run** — `npx vitest run` → ALL PASS (156 existing + new)
- [ ] **Step 5: Commit** — `feat(reports): tz resolution core + Intl-based fmtDateTime/fmtTimeShort/tzLabel`

### Task 17: TzInit + TzToggle + Header (as-of in viewer tz, staleness chip, admin gear)

**Files:**
- Create: `dashboard/components/shell/tz-init.tsx`, `dashboard/components/shell/tz-toggle.tsx`
- Modify: `dashboard/app/layout.tsx`, `dashboard/components/shell/header.tsx`

- [ ] **Step 1: TzInit** `components/shell/tz-init.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TZ_DETECTED_COOKIE } from "@/lib/tz";

/**
 * Writes the browser's detected IANA zone to a cookie so the SERVER renders
 * "auto" timestamps in the viewer's zone. One router.refresh() the first time
 * the value appears/changes — pages are force-dynamic, so the refresh
 * re-renders with the cookie applied (no full reload, no flicker loop).
 */
export function TzInit() {
  const router = useRouter();
  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!detected) return;
      const current = document.cookie
        .split("; ")
        .find((c) => c.startsWith(`${TZ_DETECTED_COOKIE}=`))
        ?.split("=")[1];
      if (decodeURIComponent(current ?? "") !== detected) {
        document.cookie =
          `${TZ_DETECTED_COOKIE}=${encodeURIComponent(detected)}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }
    } catch {
      /* IST fallback keeps working */
    }
  }, [router]);
  return null;
}
```

Mount it in `app/layout.tsx` body: `<body ...>{children}<TzInit /></body>` (import at top).

- [ ] **Step 2: TzToggle** `components/shell/tz-toggle.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { IST, SAST, TZ_COOKIE, type TzPref } from "@/lib/tz";

const NEXT: Record<TzPref, TzPref> = { auto: IST, [IST]: SAST, [SAST]: "auto" };

/**
 * Cycles the per-browser timezone preference: Auto → IST → SAST → Auto.
 * Cookie + router.refresh() → the server re-renders every timestamp in the
 * new zone (no client-side reformatting anywhere).
 */
export function TzToggle({ pref, resolvedLabel }: { pref: TzPref; resolvedLabel: string }) {
  const router = useRouter();
  const label = pref === "auto" ? `Auto · ${resolvedLabel}` : resolvedLabel;
  function cycle() {
    document.cookie =
      `${TZ_COOKIE}=${encodeURIComponent(NEXT[pref])}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }
  return (
    <button
      onClick={cycle}
      title="Timezone for timestamps (saved in this browser)"
      className="hidden items-center gap-1.5 rounded-md border border-border bg-surface/60 px-2.5 py-1.5 text-[11px] font-medium text-muted transition hover:text-fg sm:flex"
    >
      <Globe className="size-3.5 text-accent" />
      {label}
    </button>
  );
}
```

- [ ] **Step 3: Header** — make it async, read tz itself (pages don't change their call sites), swap the "as of" UTC string for viewer-tz time, add the staleness chip + gear + toggle:

```tsx
import Link from "next/link";
import { AlertTriangle, Radar, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { DualClock } from "@/components/shell/dual-clock";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { TzToggle } from "@/components/shell/tz-toggle";
import { fmtTimeShort, tzLabel } from "@/lib/format";
import { currentTz, currentTzPref } from "@/lib/tz-server";

const STALE_MS = 3.5 * 60 * 60 * 1000; // > slot gap + run time + margin

/**
 * Sticky app header (async server component: reads the tz cookies itself so
 * all six pages keep their existing <Header .../> call sites). "as of" now
 * renders in the viewer's zone (was a raw UTC HH:MM); a staleness chip appears
 * when the snapshot is older than 3.5h so stale data announces itself.
 */
export async function Header({
  project,
  scope,
  asOf,
  generatedAtIso,
}: {
  project: string;
  scope: string;
  asOf: string;
  generatedAtIso: string;
}) {
  const tz = await currentTz();
  const pref = await currentTzPref();
  const genMs = Number.isFinite(new Date(generatedAtIso).getTime())
    ? new Date(generatedAtIso).getTime()
    : null;
  const asOfLocal = genMs != null ? `${fmtTimeShort(genMs, tz)} ${tzLabel(tz)}` : asOf;
  const ageMs = genMs != null ? Date.now() - genMs : null;
  const staleHours = ageMs != null && ageMs > STALE_MS ? Math.round(ageMs / 3_600_000) : null;

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 glass">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/12 ring-1 ring-accent/30">
          <Radar className="size-5 text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[15px] font-semibold tracking-tight text-fg">
              POSX Reports
            </h1>
            <span className="hidden rounded bg-elevated px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-faint sm:inline">
              Beta
            </span>
            {staleHours != null ? (
              <span className="inline-flex items-center gap-1 rounded bg-warn/15 px-1.5 py-0.5 text-[10px] font-semibold text-warn ring-1 ring-warn/30">
                <AlertTriangle className="size-3" />
                data {staleHours}h old
              </span>
            ) : null}
          </div>
          <p className="truncate text-[11.5px] text-muted">
            <span className="font-medium text-fg/90">{project}</span>
            <span className="mx-1 text-faint">·</span>
            {scope}
            <span className="mx-1 text-faint">·</span>
            as of <span className="tabular font-medium text-fg/90">{asOfLocal}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DualClock generatedAtIso={generatedAtIso} asOf={asOf} />
          <TzToggle pref={pref} resolvedLabel={tzLabel(tz)} />
          <Link
            href="/admin"
            aria-label="Admin"
            className="flex size-8 items-center justify-center rounded-md border border-border bg-surface/60 text-muted transition hover:text-fg"
          >
            <Settings className="size-4" />
          </Link>
          <ThemeToggle />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
```

(Confirm `warn` tone classes exist in `app/globals.css` — CLAUDE.md documents the tone set; if the exact `bg-warn/15`/`ring-warn/30` utilities don't resolve, use the closest documented warn classes found in `components/weekly/badge-tone.ts` usage.)

- [ ] **Step 4: Verify** — `npm run dev`: header shows "as of HH:MM IST" (or your zone), toggle cycles Auto→IST→SAST and timestamps move; no hydration warnings in the browser console. `npm run build` → green.
- [ ] **Step 5: Commit** — `feat(reports): per-browser timezone (auto-detect + toggle) + staleness chip in header`

### Task 18: thread tz into bug tables + AI briefing

**Files:**
- Modify: `dashboard/app/bugs/page.tsx`, `dashboard/components/bugs/bug-table.tsx`, `dashboard/app/insights/page.tsx`, `dashboard/components/insights/briefing.tsx`, `dashboard/app/admin/page.tsx` (drop the Task-15 stub if used)

- [ ] **Step 1:** `app/bugs/page.tsx`: add `const tz = await currentTz();` (import from `@/lib/tz-server`) and pass `tz={tz}` to every `<BugTable ...>` usage (read the page first — it may render tables via `components/bugs/section.tsx`; thread the prop through whatever the actual chain is).
- [ ] **Step 2:** `components/bugs/bug-table.tsx`: add `tz: string` to props; replace `fmtDateTimeIst(bug.created)` with `fmtDateTime(bug.created, tz)` (swap the import); if any column header hardcodes "IST", render `tzLabel(tz)` instead.
- [ ] **Step 3:** `app/insights/page.tsx` + `components/insights/briefing.tsx`: same pattern — pass `tz`; replace line 55's `{fmtDateTimeIst(brief.generated_at)} IST` with `{fmtDateTime(brief.generated_at, tz)} {tzLabel(tz)}`.
- [ ] **Step 4:** `npx vitest run && npx tsc --noEmit && npm run build` → all green. Manual: /bugs timestamps follow the toggle.
- [ ] **Step 5: Commit** — `feat(reports): bug tables + AI briefing timestamps follow the viewer timezone`

### Task 19: snapshot cache (60s TTL + stale-on-error)

**Files:**
- Modify: `dashboard/lib/data.ts`

- [ ] **Step 1: Implement** — replace the prod fetch path in `loadSnapshot()`:

```ts
// Module-level cache: Pro's warm instances keep this across requests, cutting
// a 380KB fetch+parse per page view to at most one per minute. Blob changes
// ≤5×/day, so 60s worst-case staleness is invisible; a transient Blob error
// serves the last good snapshot instead of a 500.
let cached: { at: number; snap: Snapshot } | null = null;
const TTL_MS = 60_000;

export async function loadSnapshot(): Promise<Snapshot> {
  const local = path.join(process.cwd(), "data", "latest.json");
  if (fs.existsSync(local)) {
    return JSON.parse(fs.readFileSync(local, "utf-8")) as Snapshot;
  }
  if (!SNAPSHOT_BASE) {
    throw new Error("SNAPSHOT_DATA_URL is not set (the secret Vercel Blob base for the snapshot)");
  }
  if (cached && Date.now() - cached.at < TTL_MS) return cached.snap;
  try {
    const res = await fetch(`${SNAPSHOT_BASE}/latest.json`, { cache: "no-store" });
    if (!res.ok) throw new Error(`snapshot fetch failed (${res.status})`);
    const snap = (await res.json()) as Snapshot;
    cached = { at: Date.now(), snap };
    return snap;
  } catch (e) {
    if (cached) return cached.snap;
    throw e;
  }
}
```

- [ ] **Step 2:** `npm run build` → green.
- [ ] **Step 3: Commit** — `perf(reports): 60s in-memory snapshot cache with stale-on-error fallback`

---

## Part 5 — Docs, full verification, deploy (spec F)

### Task 20: docs + env examples + full local gate

**Files:**
- Modify: `dashboard/CLAUDE.md` (data-flow + env sections), `.env.example`, `dashboard/.env.example`
- Verify: full test suites

- [ ] **Step 1:** `dashboard/CLAUDE.md`: update the architecture diagram (GitHub Release → Blob was already stale — reflect: snapshot → Blob secret path; Vercel Cron tick → /api/cron/refresh → workflow_dispatch; nightly GH fallback + gate; /admin + ADMIN_CODE; tz cookies; 60s snapshot cache). Add `/admin` to the surfaces table.
- [ ] **Step 2:** `.env.example` (repo root): document `YT_THROTTLE_MS`. `dashboard/.env.example`: add `ADMIN_CODE=`, `GH_DISPATCH_TOKEN=`, `CRON_SECRET=`, `BLOB_READ_WRITE_TOKEN=` with one-line comments.
- [ ] **Step 3: Full gate:**

```bash
cd /Users/strata/Dev/positrack && python3 -m pytest tests/ -q
cd dashboard && npx vitest run && npx tsc --noEmit && npm run build
```

Expected: all green (pytest live-marked tests may skip without YT_TOKEN — fine).
- [ ] **Step 4: Commit** — `docs: dashboard CLAUDE.md + env examples for cron/admin/tz architecture`

### Task 21: deploy + live end-to-end verification + handoff

- [ ] **Step 1:** Push branch; `cd dashboard && vercel deploy --prod` (project already linked). Confirm the cron appears: `vercel crons ls` (or project → Settings → Cron Jobs).
- [ ] **Step 2:** Live checks:
  1. `curl -s https://<prod-domain>/api/cron/refresh` → 401 (no bearer) — route deployed + guarded.
  2. Log into `/admin` (needs ADMIN_CODE env set — if Mohamed hasn't provided it, generate one, add via `vercel env add ADMIN_CODE production`, tell him). Save the seeded schedule → verify `schedule.json` appears in Blob (requires the store-connect click — coordinate with Mohamed).
  3. Press **Refresh Now** → confirm a `workflow_dispatch` run starts within seconds (`gh run list --workflow=snapshot.yml --limit 3`) and the panel reports it.
  4. After the run: dashboard shows fresh "as of"; run duration ≤ ~2.5 min; run log line `YouTrack requests this run: N` with N ≤ 70.
  5. Wait for the next quarter-hour tick and `vercel logs` the cron route → `no-op` or `dispatched` per schedule.
  6. TZ: toggle Auto/IST/SAST on the live site from two different browsers — preferences independent.
- [ ] **Step 3:** Update memory (`reports-dashboard-rebuild.md` + new refresh-architecture memory), message Mohamed the go-live summary + the one remaining click (Blob store → Connect Project) if still pending.
- [ ] **Step 4: Final commit + PR** — `gh pr create` against master per repo convention (or hand to Mohamed if he merges via UI).

---

## Self-review notes

- **Spec coverage:** A→Tasks 8–12+17(chip); B→13–15; C→1–7; D→16–18; E→19; F→20–21. Env setup (GH_DISPATCH_TOKEN/CRON_SECRET) done pre-plan; ADMIN_CODE + Blob connect land in Task 21.
- **Consistency:** `sweep_items` param name used in Tasks 3+4; `_timespent_for_issue_ids`/`_worklog_authors_from_pool` names match between Tasks 4 tests and impl; `ScheduleConfig`/`dueSlot`/`normalizeSchedule` names consistent across 8/9/11/14/15; `fmtDateTime(ms, tz)` signature consistent across 15/16/18; `RunInfo` shape consistent 10/14/15.
- **Known judgment calls at execution:** Badge variant names (Task 15), warn tone utilities (Task 17), `_cell` behavior (Task 5), `<Nav />` props (Task 15) — each has an explicit "read first, adjust" instruction with the file to check.
