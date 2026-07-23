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
