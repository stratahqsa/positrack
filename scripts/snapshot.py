#!/usr/bin/env python3
"""
snapshot.py — the POSX Control Tower snapshot PRODUCER (Phase B data layer).

WHY PRECOMPUTE, NOT LIVE: a full effort_report takes ~285s against YouTrack, which
blows the 60s ceiling of a Vercel Hobby function. So the data path is: this producer
runs ONCE (nightly in GitHub Actions, or locally), composes a single JSON snapshot,
and commits it under web/data/. The Next.js UI reads that JSON SERVER-SIDE — no
Python on Vercel, no raw-data endpoints, no token in the browser.

It composes ONE snapshot dict from the shared engine (core/ytcore.py):
  * effort         — full effort_report(project, scope) output (the report shape).
  * timespent      — time_spent(group_by="author") for the latest active sprint
                     (propagated time excluded; the exclusion disclosure is kept).
  * hygiene        — board hygiene via report(rtype="hygiene", project=...).
  * gamification   — per-person + per-team HYGIENE scores (scripts/gamification.py,
                     a provably-not-a-scorecard pure function; see Consensus Rev #4).
  * insights       — absolute RED counts (unowned/unestimated/stale/blocked/overshoot)
                     from the effort data + day-over-day delta vs the most recent
                     prior snapshot (Consensus Rev #8).
  * meta           — generated_at + project/scope/sprint + as-of HH:MM + engine_version.

Output: web/data/snapshot-<UTCdate>.json (kept for history) AND web/data/latest.json
(overwritten each run). These are read server-side by the UI; they are NOT in
web/public and are never shipped to the browser.

Run:
    set -a; . ~/.positrack-yt.env; set +a
    python3 scripts/snapshot.py --project PXB1 --scope "PHASE 1" [--sprint NAME]

On any YouTrack 401/403/429 or missing token, this STOPS and prints
"BLOCKED on <reason>" — it never fabricates snapshot data.

This script runs in CI/local (Python 3.9+), NOT on Vercel, so it may use richer
Python than the stdlib-only engine — but here it stays stdlib-only anyway.
"""
import argparse
import datetime
import glob
import json
import os
import re
import sys

# Import the shared engine from core/ (canonical) whether we're run from the repo
# root or scripts/. The engine is the SINGLE SOURCE OF TRUTH; we never re-derive.
_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_HERE)
for _p in (os.path.join(_ROOT, "core"), _HERE):
    if os.path.isfile(os.path.join(_p, "ytcore.py")):
        sys.path.insert(0, _p)
        break
sys.path.insert(0, _HERE)  # for gamification.py
import ytcore as yt  # noqa: E402
import gamification as gam  # noqa: E402
from reports.config import load_config  # scripts/ is already on sys.path (line 53)
from reports import bugs as rbugs, schedule as rsched, drilldown as rdrill  # noqa: E402

ENGINE_VERSION = "control-tower-b1"
DATA_DIR = os.path.join(_ROOT, "web", "data")
STALE_DAYS = 30          # engine hygiene precedent (Rev #8 default)
LOGGING_WINDOW_DAYS = 7  # "on-time logging" / "moving" recency window
FALLBACK_SPRINT = "beta1-19"

# Role/system placeholder accounts that "own" work but are NOT individuals — epics
# parked on "Dev Lead"/"UIX Lead"/"QX Lead"/system support. A role owner means NO
# person is accountable, so such epics count as needs-a-real-owner and these accounts
# are kept OFF the per-person leaderboard. Extend via web/config/roster.json
# {"non_human": ["login or full name", ...]}.
_ROLE_NAME_RE = re.compile(r"\blead\b|system\s+support", re.I)
_ROLE_LOGINS = {"Devxleads", "UIX_Lead", "QX_Lead"}
_NON_HUMAN_EXTRA = set()  # loaded from roster.json "non_human" at runtime


def is_role_account(name="", login=""):
    """True if this owner is a role/system placeholder, not an individual contributor."""
    name = (name or "").strip()
    login = (login or "").strip()
    if login and (login in _ROLE_LOGINS or login in _NON_HUMAN_EXTRA):
        return True
    if name and name in _NON_HUMAN_EXTRA:
        return True
    return bool(name and _ROLE_NAME_RE.search(name))


def _needs_owner(epic):
    """An open epic needs a real owner when its assignee is blank OR a role placeholder."""
    a = (epic.get("assignee") or "").strip()
    return (not a) or is_role_account(name=a)


# ---------------------------------------------------------------- helpers
def _brace(v):
    """YouTrack query token: brace values containing spaces (e.g. {PHASE 1})."""
    v = str(v)
    return "{%s}" % v if (" " in v or "-" in v) else v


def _frac(numer, denom):
    """A clamped health fraction numer/denom in [0,1]; denom<=0 -> 1.0 (a person
    with no open work is not 'unhealthy' — nothing is stale/unestimated)."""
    if not denom or denom <= 0:
        return 1.0
    if numer < 0:
        numer = 0
    f = numer / float(denom)
    return 0.0 if f < 0 else (1.0 if f > 1 else f)


def _now():
    return datetime.datetime.now(datetime.timezone.utc)


def latest_active_sprint(ctx, project, fallback=FALLBACK_SPRINT):
    """The latest active (non-archived) sprint for `project` from boards(), by finish
    date when available, else last listed. Falls back to `fallback` if none found."""
    try:
        bs = yt.boards(ctx, project)
    except yt.YTError:
        return fallback
    names = []
    for b in bs:
        for s in b.get("sprints") or []:
            if s:
                names.append(s)
    if not names:
        return fallback
    # boards() returns live (non-archived) sprint names already ordered as YouTrack
    # lists them; the last one is the most recent active sprint.
    return names[-1]


def recent_sprints(ctx, project, n=4, fallback=FALLBACK_SPRINT):
    """The last `n` sprint names for `project` (most-recent last), INCLUDING archived
    ones so the UI picker can review past sprints. Sorted by finish/start date."""
    try:
        ags = yt.GET(ctx, "/api/agiles?fields=name,projects(shortName),"
                          "sprints(name,archived,start,finish)&$top=100")
    except yt.YTError:
        return [fallback]
    want = (project or "").upper()
    by_name = {}  # name -> latest finish/start ms (0 if undated)
    for ag in (ags or []):
        codes = [(p.get("shortName") or "").upper() for p in (ag.get("projects") or [])]
        if want not in codes:
            continue
        for s in (ag.get("sprints") or []):
            nm = s.get("name")
            if not nm:
                continue
            key = s.get("finish") or s.get("start") or 0
            by_name[nm] = max(by_name.get(nm, 0), key)
    if not by_name:
        return [fallback]
    ordered = sorted(by_name, key=lambda nm: by_name[nm])  # ascending by date
    return ordered[-n:]


# ---------------------------------------------------------------- RED counts (insights)
def _red_counts_from_effort(effort):
    """Absolute RED counts derived from the effort_report data (Consensus Rev #8):
      * unowned      — open epics (pending/mixed/no_stories) with a blank assignee
      * unestimated  — open epics flagged missing_est (Dev=0 AND UI=0) OR QA=0
      * stale        — open epics not updated within STALE_DAYS (by 'created' proxy is
                       wrong; effort epics carry no 'updated', so we approximate stale
                       from the report as epics with NO spend AND NO estimate movement —
                       here we count epics whose 'created' age > STALE_DAYS as a floor)
      * blocked      — epics whose state matches block/hold
      * overshoot    — epics where true spend > estimate (overshoot flag)
    These come straight from the committed effort data so the UI and the snapshot
    agree by construction. `stale` is intentionally conservative; the live hygiene
    block carries the authoritative board-wide stale number."""
    open_secs = ["pending", "mixed", "no_stories"]
    epics = []
    for sec in open_secs:
        epics.extend(effort.get("sections", {}).get(sec, []))
    # "unowned" = needs a REAL owner: blank assignee OR a role/system placeholder
    # (an epic parked on "Dev Lead"/"UIX Lead" has no individual accountable).
    unowned = sum(1 for e in epics if _needs_owner(e))
    role_owned = sum(1 for e in epics
                     if (e.get("assignee") or "").strip() and is_role_account(name=e["assignee"]))
    deferred = sum(1 for e in epics if e.get("has_p2"))  # P1 epics with stories pushed to P2
    unestimated = sum(1 for e in epics if e.get("missing_est"))
    blocked = sum(1 for e in epics
                  if re.search(r"block|hold", (e.get("epic_state") or ""), re.I))
    overshoot = sum(1 for e in epics if e.get("overshoot"))
    now_ms = _now().timestamp() * 1000
    stale = sum(1 for e in epics
                if e.get("created") and (now_ms - e["created"]) / 86400000.0 > STALE_DAYS
                and (e.get("spent") or 0) == 0)
    return {
        "unowned": unowned,
        "unestimated": unestimated,
        "stale": stale,
        "blocked": blocked,
        "overshoot": overshoot,
        "role_owned": role_owned,
        "deferred": deferred,
        "total_red": unowned + unestimated + stale + blocked + overshoot,
        "stale_days": STALE_DAYS,
    }


def _prior_snapshot_red(project, scope):
    """The most recent PRIOR snapshot-*.json (not latest.json) for the same
    project+scope, and its RED counts, for a day-over-day delta. Returns
    (path, red_dict) or (None, None)."""
    paths = sorted(glob.glob(os.path.join(DATA_DIR, "snapshot-*.json")))
    for p in reversed(paths):
        try:
            with open(p, encoding="utf-8") as f:
                prev = json.load(f)
        except Exception:
            continue
        m = prev.get("meta") or {}
        if m.get("project") == project and m.get("scope") == scope:
            red = (prev.get("insights") or {}).get("red_counts")
            if red:
                return p, red
    return None, None


def build_insights(effort, project, scope):
    """RED counts + day-over-day delta vs the most recent prior snapshot (Rev #8)."""
    red = _red_counts_from_effort(effort)
    prior_path, prior_red = _prior_snapshot_red(project, scope)
    delta = None
    if prior_red:
        delta = {k: red[k] - prior_red.get(k, 0)
                 for k in ("unowned", "unestimated", "stale", "blocked", "overshoot", "total_red")}
    return {
        "red_counts": red,
        "red_delta": delta,                       # None until a prior snapshot exists
        "compared_to": os.path.basename(prior_path) if prior_path else None,
    }


# ---------------------------------------------------------------- gamification
def _person_signals(ctx, project, login, worklog_authors):
    """Derive the FROZEN hygiene signals for one assignee from ytcore counts.

    Signals (all health fractions in [0,1]):
      stale_free       = 1 - stale/open        (open work touched within STALE_DAYS)
      estimated        = 1 - unestimated/open  (open work carrying an estimate)
      moving           = updated_recent/open   (open work updated within the window)
      on_time_logging  = 1.0 if the person logged worklog time within the window else 0
    No output metric (hours/closures) is ever an input — see gamification.py.
    """
    q = "project: %s #Unresolved Assignee: %s" % (project, login)
    open_n = yt.count_soft(ctx, q)
    if not isinstance(open_n, int) or open_n < 0:
        open_n = 0
    stale_n = yt.count_soft(ctx, q + " updated: * .. {minus %dd}" % STALE_DAYS)
    unest_n = yt.count_soft(ctx, q + " has: -{Estimate}")
    moved_n = yt.count_soft(ctx, q + " updated: {minus %dd} .. Today" % LOGGING_WINDOW_DAYS)
    stale_n = stale_n if isinstance(stale_n, int) and stale_n >= 0 else 0
    unest_n = unest_n if isinstance(unest_n, int) and unest_n >= 0 else 0
    moved_n = moved_n if isinstance(moved_n, int) and moved_n >= 0 else 0
    return {
        "stale_free": _frac(open_n - stale_n, open_n),
        "estimated": _frac(open_n - unest_n, open_n),
        "moving": _frac(moved_n, open_n),
        "on_time_logging": 1.0 if login in worklog_authors else 0.0,
    }, {"open": open_n, "stale": stale_n, "unestimated": unest_n, "moved": moved_n}


def _recent_worklog_authors(ctx, project, sprint):
    """Set of logins who logged worklog time within LOGGING_WINDOW_DAYS (for the
    on_time_logging signal). Uses a windowed time_spent sweep grouped by author."""
    start = (_now() - datetime.timedelta(days=LOGGING_WINDOW_DAYS)).strftime("%Y-%m-%d")
    try:
        ws = yt.time_spent(ctx, project=project, sprint=sprint, start=start,
                           group_by="author", with_items=True)
    except yt.YTError:
        return set(), {}
    logins = set()
    fullname_by_login = {}
    for it in ws.get("items", []):
        lg = it.get("login")
        if lg:
            logins.add(lg)
            fullname_by_login[lg] = it.get("author") or lg
    return logins, fullname_by_login


def _assignee_logins(ctx, project, effort):
    """Logins that own open work in-scope. We derive assignee display names from the
    effort epics and resolve them to logins via a single open-work sweep so per-owner
    hygiene queries (which key on login) are exact. Returns {login: fullName}."""
    # Pull open issues with assignee login+name once; build name->login and the login
    # set for everyone who currently owns open work in the project.
    issues = yt.get_issues(
        ctx, "project: %s #Unresolved" % project,
        fields="idReadable,customFields(name,value(login,fullName))", limit=5000)
    out = {}
    for it in issues:
        for cf in it.get("customFields", []):
            if cf.get("name") == "Assignee":
                v = cf.get("value")
                if (isinstance(v, dict) and v.get("login")
                        and not is_role_account(name=v.get("fullName"), login=v.get("login"))):
                    out[v["login"]] = v.get("fullName") or v["login"]
    return out


def build_gamification(ctx, project, effort, roster=None):
    """Per-person + per-team hygiene scores (Consensus Rev #4).

    Per-person hygiene is computed ONLY for logins that own open work (assignees).
    Because most epics have blank assignees, we ALSO surface:
      * an ENGAGEMENT view derived from worklog authorship (who is actually logging
        time this window) — labelled as engagement, ranked by hygiene where known;
      * an explicit `owner_gap` disclosure: how many open epics have NO assignee, so
        the UI can say per-owner hygiene "grows as assignees are filled" instead of
        faking coverage.
    Leaderboards rank on HYGIENE (and red-count reduction), NEVER hours/closures.
    Teams come from an optional roster {team: [logins]}; without one we emit a single
    "All" team over every scored person.
    """
    sprint = effort.get("_sprint")  # threaded in by build_snapshot
    worklog_authors, worklog_names = _recent_worklog_authors(ctx, project, sprint)
    owners = _assignee_logins(ctx, project, effort)

    people = []
    for login in sorted(owners):
        signals, raw = _person_signals(ctx, project, login, worklog_authors)
        # red_reduction placeholder is 0 here (no prior per-person snapshot in this
        # producer pass); the leaderboard still ranks on hygiene first.
        people.append({
            "key": login,
            "name": owners.get(login) or worklog_names.get(login) or login,
            "score": gam.hygiene_score(signals),
            "signals": {k: round(v, 3) for k, v in signals.items()},
            "counts": raw,
            "logged_recently": login in worklog_authors,
            "red_reduction": 0,
        })
    people_ranked = gam.rank_by_hygiene(people)

    # Engagement view: everyone who logged time this window (may include non-assignees
    # and epic-owners with blank assignee fields). This is the honest signal when
    # ownership is sparse. It is NOT a productivity ranking — it is presence.
    engagement = [{"key": lg, "name": worklog_names.get(lg, lg)}
                  for lg in sorted(worklog_authors)]

    # Teams: aggregate member hygiene into a team score (mean of member scores).
    score_by_login = {p["key"]: p["score"] for p in people}
    teams = []
    roster = roster or {}
    if roster:
        for team, members in roster.items():
            member_scores = [score_by_login[m] for m in members if m in score_by_login]
            covered = len(member_scores)
            team_signals_mean = _team_signal_mean(people, members)
            teams.append({
                "key": team,
                "score": int(round(sum(member_scores) / covered)) if covered else 0,
                "signals": team_signals_mean,
                "members": list(members),
                "members_scored": covered,
                "red_reduction": 0,
            })
    else:
        all_scores = [p["score"] for p in people]
        teams.append({
            "key": "All",
            "score": int(round(sum(all_scores) / len(all_scores))) if all_scores else 0,
            "signals": _team_signal_mean(people, [p["key"] for p in people]),
            "members": [p["key"] for p in people],
            "members_scored": len(people),
            "red_reduction": 0,
        })
    teams_ranked = gam.rank_by_hygiene(teams)

    open_secs = ["pending", "mixed", "no_stories"]
    open_epics = sum(len(effort.get("sections", {}).get(s, [])) for s in open_secs)
    unowned_epics = sum(
        1 for s in open_secs for e in effort.get("sections", {}).get(s, [])
        if _needs_owner(e))

    return {
        "signals_allowlist": list(gam.HYGIENE_SIGNALS),
        "signal_labels": dict(gam.SIGNAL_LABELS),
        "ranking_basis": "hygiene score, then red-count reduction — never hours logged or issues closed",
        "window_days": LOGGING_WINDOW_DAYS,
        "stale_days": STALE_DAYS,
        "people": people_ranked,
        "teams": teams_ranked,
        "engagement": engagement,
        "owner_gap": {
            "open_epics": open_epics,
            "unowned_epics": unowned_epics,
            "note": ("%d of %d open epics have no individual owner (blank or parked on a "
                     "role placeholder like Dev Lead/UIX Lead) — assign a person so "
                     "someone is accountable." % (unowned_epics, open_epics)),
        },
    }


def _team_signal_mean(people, members):
    """Mean of each hygiene signal across a team's scored members (pure)."""
    rows = [p for p in people if p["key"] in set(members)]
    if not rows:
        return {k: 0.0 for k in gam.HYGIENE_SIGNALS}
    return {k: round(sum(p["signals"].get(k, 0.0) for p in rows) / len(rows), 3)
            for k in gam.HYGIENE_SIGNALS}


# ---------------------------------------------------------------- compose
def build_snapshot(ctx, project, scope, sprint=None, roster=None):
    """Compose the ONE snapshot dict. Raises yt.YTError upward (caller maps to a
    BLOCKED report). Every heavy call is the engine's; nothing is re-derived here."""
    now = _now()

    # 1) effort — the full report (this is the ~285s sweep).
    effort = yt.effort_report(ctx, project=project, scope=scope)
    # Owner-accountability flags for the UI: a role/system placeholder (e.g. "Dev Lead")
    # owning an epic means no individual is accountable -> treat as needs_owner.
    for _sec in ("pending", "mixed", "no_stories", "done", "p2_backlog"):
        for e in effort.get("sections", {}).get(_sec, []):
            _a = (e.get("assignee") or "").strip()
            e["role_owner"] = bool(_a) and is_role_account(name=_a)
            e["needs_owner"] = (not _a) or e["role_owner"]

    # 2) timespent — latest active sprint (fallback beta1-19), propagated-excluded.
    sprint = sprint or latest_active_sprint(ctx, project)
    timespent = yt.time_spent(ctx, project=project, sprint=sprint, group_by="author")
    effort["_sprint"] = sprint  # thread the sprint to gamification's worklog window

    # 2b) per-sprint time for the UI sprint picker (last few active sprints).
    sprints_available = recent_sprints(ctx, project, n=4)
    if sprint not in sprints_available:
        sprints_available = sprints_available + [sprint]
    timespent_by_sprint = {}
    for sp in sprints_available:
        if sp == sprint:
            timespent_by_sprint[sp] = timespent  # reuse the sweep we already did
            continue
        try:
            timespent_by_sprint[sp] = yt.time_spent(ctx, project=project, sprint=sp,
                                                     group_by="author")
        except yt.YTError:
            pass

    # 3) hygiene — board hygiene blocks (report shape) for the project.
    hygiene_blocks = yt.report(ctx, "hygiene", project=project)

    # 4) gamification — per-person + per-team hygiene (pure scorer).
    gamification = build_gamification(ctx, project, effort, roster=roster)

    # 5) insights — RED counts + day-over-day delta.
    insights = build_insights(effort, project, scope)

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
    }

    effort.pop("_sprint", None)  # keep it out of the serialized effort block

    meta = {
        "generated_at_iso": now.isoformat(),
        "generated_at_ms": int(now.timestamp() * 1000),
        "project": project,
        "scope": scope,
        "sprint": sprint,
        "as_of_hhmm": now.strftime("%H:%M"),
        "engine_version": ENGINE_VERSION,
    }

    return {
        "meta": meta,
        "effort": effort,
        "timespent": timespent,
        "timespent_by_sprint": timespent_by_sprint,
        "sprints_available": sprints_available,
        "hygiene": {"blocks": hygiene_blocks},
        "gamification": gamification,
        "insights": insights,
        "config": config_block,
        "bugs": bugs_block,
        "schedule": schedule_block,
    }


def _load_roster():
    """Optional team roster from web/config/roster.json: {team: [logins]}.
    Absent -> None (a single 'All' team is emitted)."""
    path = os.path.join(_ROOT, "web", "config", "roster.json")
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            # accept either {team:[logins]} or {"teams":{team:[logins]}}
            return data.get("teams", data)
    except Exception:
        return None
    return None


def write_snapshot(snapshot):
    """Write web/data/snapshot-<UTCdate>.json (history) AND overwrite latest.json.
    Returns the two paths."""
    os.makedirs(DATA_DIR, exist_ok=True)
    date = snapshot["meta"]["generated_at_iso"][:10]  # UTC YYYY-MM-DD
    dated = os.path.join(DATA_DIR, "snapshot-%s.json" % date)
    latest = os.path.join(DATA_DIR, "latest.json")
    blob = json.dumps(snapshot, indent=1, ensure_ascii=False)
    with open(dated, "w", encoding="utf-8") as f:
        f.write(blob)
    with open(latest, "w", encoding="utf-8") as f:
        f.write(blob)
    return dated, latest


# ---------------------------------------------------------------- CLI
def main(argv=None):
    ap = argparse.ArgumentParser(description="POSX Control Tower snapshot producer")
    ap.add_argument("--project", default="PXB1")
    ap.add_argument("--scope", default="PHASE 1")
    ap.add_argument("--sprint", default="", help="override the sprint for timespent "
                                                 "(default: latest active, fallback %s)" % FALLBACK_SPRINT)
    ap.add_argument("--base", default="", help="YouTrack base URL override")
    a = ap.parse_args(argv)

    token = os.environ.get("YT_TOKEN", "").strip()
    if not token:
        print("BLOCKED on missing token: set $YT_TOKEN (e.g. `set -a; . ~/.positrack-yt.env; set +a`).",
              file=sys.stderr)
        return 3

    ctx = yt.Ctx(token, a.base or os.environ.get("YT_BASE") or yt.DEFAULT_BASE)
    # role/system accounts to exclude from the per-person leaderboard (roster "non_human")
    try:
        with open(os.path.join(_ROOT, "web", "config", "roster.json"), encoding="utf-8") as _f:
            for _x in (json.load(_f).get("non_human") or []):
                _NON_HUMAN_EXTRA.add(str(_x))
    except Exception:
        pass
    try:
        # fail fast + clearly on an auth problem before the long sweep
        yt.whoami(ctx)
        snapshot = build_snapshot(ctx, a.project, a.scope,
                                  sprint=(a.sprint or None), roster=_load_roster())
    except yt.YTError as e:
        code = e.status_code
        if code in (401, 403, 429):
            print("BLOCKED on YouTrack %s: %s" % (code, e.friendly_message), file=sys.stderr)
            return 4
        print("BLOCKED on engine error: %s" % e.friendly_message, file=sys.stderr)
        return 5

    dated, latest = write_snapshot(snapshot)
    c = snapshot["effort"]["counts"]
    g = snapshot["effort"]["totals"]["grand_total"]
    red = snapshot["insights"]["red_counts"]
    print("Wrote %s" % dated)
    print("Wrote %s" % latest)
    print("effort: done %d · pending %d · mixed %d · no_stories %d · p2 %d (of %d epics)"
          % (c["done"], c["pending"], c["mixed"], c["no_stories"], c["p2_backlog"],
             c["epics_discovered"]))
    print("grand total: %.1f man-days estimate · %.1f man-days spent"
          % (g["total_md"], g["spent_md"]))
    print("RED: unowned %d · unestimated %d · stale %d · blocked %d · overshoot %d (total %d)"
          % (red["unowned"], red["unestimated"], red["stale"], red["blocked"],
             red["overshoot"], red["total_red"]))
    print("gamification: %d people scored · %d team(s) · sprint %s"
          % (len(snapshot["gamification"]["people"]),
             len(snapshot["gamification"]["teams"]), snapshot["meta"]["sprint"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
