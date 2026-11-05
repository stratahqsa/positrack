# scripts/reports/android.py
"""Android Status Report data block (the Android epics -- PXB1-3295 "POS
(Android)" plus any others in ReportsConfig.android_epic_ids; PXB1-3295 is
deliberately EXCLUDED from every other PXB1 report via
ReportsConfig.exclude_ids, since Android has its own separate cadence/scope).
Every direct-subtask story under those epics, merged into ONE list,
each with ALL of its linked bugs (open AND resolved/done -- same as the
standalone skill report this mirrors, unlike Weekly Deadline's RE-OPEN
drill-down which keeps open-only) attached via the SAME Subtask -> "Bugs
Reported" chain drilldown.py already proved out -- applied here to EVERY
story (not just RE-OPEN ones), and resolving into APP-project bugs
(Android's own separate bug tracker, not PXB1's) since bug_candidates() is
already project-agnostic."""
from . import parse
from .schedule import parse_story
from .drilldown import bug_candidates

ANDROID_EPIC_IDS = ["PXB1-3295"]   # default; the live list is ReportsConfig.android_epic_ids
ANDROID_EPIC_ID = ANDROID_EPIC_IDS[0]


def _bulk(ctx, yt, ids, fields, chunk):
    """Same batched `issue ID:` chunking as bug_blocker.py/drilldown.py --
    ONE query per chunk instead of one GET per issue."""
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


def _resolve_all_bugs(candidates, fetch_bug):
    """Like drilldown.resolve_bugs(), but keeps EVERY candidate bug -- open
    AND resolved/done -- instead of dropping done ones, since the Android
    report shows a story's full bug history (skill-report parity), not just
    what's still blocking it. Adds `done`/`created`/`resolved` so the UI can
    render each bug row in the same column grid as a story row (Created/
    Resolved columns need real values, not just an open/done flag)."""
    out = []
    for bid, dev_id in candidates.items():
        raw = fetch_bug(bid)
        state = parse.cf_name(raw, "State")
        out.append({"bugId": bid, "summary": raw.get("summary") or "", "state": state,
                    "assignee": parse.cf_name(raw, "Assignee"),
                    "priority": parse.cf_name(raw, "Priority"), "devTicketId": dev_id,
                    "done": parse.is_done(state),
                    "created": raw.get("created"), "resolved": raw.get("resolved")})
    return out


def build_android(ctx, yt, epic_ids=None, chunk=40):
    """Run the underlying queries and shape the block. `yt` is the ytcore
    module. `epic_ids` is ReportsConfig.android_epic_ids (default: just
    PXB1-3295) -- the Android epics are NOT driven by the PXB1 phase/scope
    baseline every other report module reads cfg from. Stories from every
    epic are merged into one list, each keeping its own epicId."""
    EF = "id,idReadable,summary,links(direction,linkType(name),issues(id,idReadable))"
    epic_ids = list(epic_ids or ANDROID_EPIC_IDS)

    epics, story_ids, epic_of = [], [], {}
    for eid in epic_ids:
        epic_raw = yt.get_issues(ctx, "issue ID: %s" % eid, fields=EF, top=1)
        epic = epic_raw[0] if epic_raw else {}
        epics.append({"epicId": eid, "epicName": epic.get("summary") or eid})
        for lk in (epic.get("links") or []):
            if (lk.get("linkType") or {}).get("name") == "Subtask" and lk.get("direction") == "OUTWARD":
                for it in (lk.get("issues") or []):
                    sid = it.get("idReadable") or it.get("id")
                    if sid and sid not in epic_of:
                        epic_of[sid] = eid
                        story_ids.append(sid)

    SF = ("id,idReadable,summary,created,resolved,"
          "customFields(name,value(name,text,minutes,id)),"
          "links(direction,linkType(name),issues(id,idReadable))")
    LF = ("id,idReadable,links(direction,linkType(name),"
          "issues(id,idReadable,summary,links(direction,linkType(name),issues(id,idReadable))))")
    BF = "id,idReadable,summary,created,resolved,customFields(name,value(name,text))"

    stories_raw = _bulk(ctx, yt, story_ids, SF, chunk)
    stories = [parse_story(stories_raw[sid]) for sid in story_ids if sid in stories_raw]
    for s in stories:
        # These stories were fetched as an Android epic's own direct
        # Subtask-OUTWARD children, so epicId is that epic by construction;
        # parentId is kept as the fallback in case a story's own INWARD link
        # ever disagrees (mirrors schedule.py's epicId/parentId split).
        s["epicId"] = s["parentId"] or epic_of.get(s["storyId"])

    links_by_story = _bulk(ctx, yt, story_ids, LF, chunk)
    candidates_by_story = {sid: bug_candidates(links_by_story.get(sid) or {}) for sid in story_ids}
    all_bug_ids = {b for cand in candidates_by_story.values() for b in cand}
    bugs_by_id = _bulk(ctx, yt, sorted(all_bug_ids), BF, chunk)

    def fetch_bug(bid):
        return bugs_by_id.get(bid) or {"idReadable": bid, "customFields": []}

    for s in stories:
        s["bugs"] = _resolve_all_bugs(candidates_by_story.get(s["storyId"], {}), fetch_bug)

    done_count = sum(1 for s in stories if s["done"])
    open_bug_count = sum(1 for s in stories for b in s["bugs"] if not b["done"])

    return {
        "epicId": epics[0]["epicId"],      # first epic -- kept for snapshots/readers that predate `epics`
        "epicName": epics[0]["epicName"],
        "epics": epics,
        "stories": stories,
        "kpi": {
            "total_stories": len(stories),
            "done_stories": done_count,
            "open_stories": len(stories) - done_count,
            "open_bugs": open_bug_count,
        },
    }
