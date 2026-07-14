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
