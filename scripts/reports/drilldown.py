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
