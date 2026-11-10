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
    excludes configured ids. Returns ALL candidate PHASE-scope epics
    {idReadable: {id, summary}} — which of them are tracked is decided by
    `discover` (pinned list + auto-include)."""
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

def _qualifies(story):
    """A story that makes its epic worth tracking: at least one estimate AND at
    least one deadline filled in."""
    has_est = (story["devEst"] or 0) + (story["uiEst"] or 0) + (story["qaEst"] or 0) > 0
    has_deadline = story["ddTs"] is not None or story["qaTs"] is not None
    return has_est and has_deadline

def discover(ctx, yt, cfg):
    """Fetch epics + stories ONCE and decide which epics are tracked:
    pinned `include_epic_ids` PLUS (when `auto_include_epics`) every candidate
    epic with a qualifying story under it. `android_epic_ids` are never
    auto-added (they have their own report). With no pinned list and
    auto-include off, every candidate epic is tracked (legacy all-epics mode).
    Returns {candidates, stories, tracked, epics, auto_added}."""
    candidates = fetch_epic_ids(ctx, yt, cfg)
    F = ("id,idReadable,summary,created,resolved,"
         "customFields(name,value(name,text,minutes,id)),"
         "links(direction,linkType(name),issues(id,idReadable))")
    raw = yt.get_issues(ctx, "project: %s TaskType: Story Scope: {%s}" % (cfg.project, cfg.scope), fields=F)
    excluded = set(cfg.exclude_ids)
    # Drop stories whose direct parent is an EXCLUDED epic (e.g. PXB1-3295 POS
    # Android) so excluded work can't leak into any view.
    stories = [s for s in (parse_story(r) for r in raw) if s["parentId"] not in excluded]
    pinned = {e for e in cfg.include_epic_ids if e in candidates}
    if not cfg.include_epic_ids and not cfg.auto_include_epics:
        tracked = set(candidates)
    else:
        tracked = set(pinned)
        if cfg.auto_include_epics:
            matched, _ = match_epics(stories, candidates.keys())
            skip = set(cfg.android_epic_ids)
            for s in stories:
                eid = matched.get(s["storyId"])
                if eid and eid not in skip and _qualifies(s):
                    tracked.add(eid)
    return {"candidates": candidates, "stories": stories, "tracked": tracked,
            "epics": {rid: candidates[rid] for rid in tracked},
            "auto_added": sorted(tracked - pinned)}

def build_schedule(ctx, yt, cfg, discovered=None):
    """Parse + match stories to the tracked epics. Returns the enriched
    schedule block (epics + stories + orphan count). Pass `discovered` (from
    `discover`) to reuse an already-made fetch."""
    d = discovered or discover(ctx, yt, cfg)
    epics, stories = d["epics"], d["stories"]
    # Remaining orphans are stories under no TRACKED epic (unlinked, or under an
    # untracked epic) — the story-centric Weekly Deadline View still includes
    # them when no working-epic mode is active.
    matched, orphans = match_epics(stories, epics.keys())
    for s in stories:
        s["epicId"] = matched.get(s["storyId"])
    if cfg.include_epic_ids or cfg.auto_include_epics:   # working-epic mode: drop stories outside the tracked epics
        stories = [s for s in stories if s["epicId"]]
        orphans = []
    return {
        "epics": [{"id": rid, "summary": e.get("summary"), "resolved": e.get("resolved"),
                   "created": e.get("created")} for rid, e in epics.items()],
        "stories": stories,
        "orphan_count": len(orphans),
    }
