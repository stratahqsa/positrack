# scripts/reports/bug_blocker.py
"""Bug Blocker Dashboard data block (2026-07-22). RE-OPEN development tickets
(TaskType: Story — the same "dev ticket" level scripts/reports/drilldown.py
walks to via a parent Story's Subtask link) with unresolved bugs linked via an
OUTWARD "Bugs Reported" link. Urgent/High/Medium unresolved bugs BLOCK the
ticket from closing; unresolved Low-priority bugs are shown but don't block.

ASSUMPTION TO VERIFY: querying TaskType: Story directly (no live YouTrack
access was available to confirm the exact TaskType of the ticket level shown
in the mockup screenshots) — matches the existing convention in schedule.py /
release_schedule.py for "the dev-ticket level". If a real snapshot run comes
back with zero tickets where some are expected, check this first."""
from . import parse

BLOCKING_PRIORITIES = ("Urgent", "High", "Medium")


def linked_bug_ids(ticket_links):
    """OUTWARD "Bugs Reported" link targets from a ticket's own links payload
    (one hop — this ticket already IS the dev-ticket level, unlike
    drilldown.py's bug_candidates() which starts one level up at the story)."""
    out = []
    for lk in (ticket_links.get("links") or []):
        if (lk.get("linkType") or {}).get("name") == "Bugs Reported" and lk.get("direction") == "OUTWARD":
            for bug in (lk.get("issues") or []):
                bid = bug.get("idReadable") or bug.get("id")
                if bid:
                    out.append(bid)
    return out


def shape_bug(raw):
    return {
        "id": raw.get("idReadable") or raw.get("id"),
        "summary": raw.get("summary") or "",
        "state": parse.cf_name(raw, "State"),
        "priority": parse.cf_name(raw, "Priority"),
    }


def classify_bugs(bugs):
    """Split already-shaped, already-unresolved bugs into blocking
    (Urgent/High/Medium) vs low-priority (anything else, incl. no priority
    set — never blocking)."""
    blocking = [b for b in bugs if b["priority"] in BLOCKING_PRIORITIES]
    low_priority = [b for b in bugs if b["priority"] not in BLOCKING_PRIORITIES]
    return blocking, low_priority


def build_bug_blocker(ctx, yt, cfg):
    """RE-OPEN dev tickets + their unresolved linked bugs. `yt` is the ytcore
    module."""
    P = cfg.project
    LF = "id,idReadable,summary,links(direction,linkType(name),issues(id,idReadable))"
    BF = "id,idReadable,summary,customFields(name,value(name,text))"

    tickets_raw = yt.get_issues(ctx, "project: %s TaskType: Story State: RE-OPEN" % P, fields=LF)

    seen_bug = {}

    def fetch_bug(bid):
        if bid not in seen_bug:
            res = yt.get_issues(ctx, "issue ID: %s" % bid, fields=BF, limit=1)
            seen_bug[bid] = res[0] if res else {"idReadable": bid, "customFields": []}
        return seen_bug[bid]

    tickets = []
    for t in tickets_raw:
        tid = t.get("idReadable") or t.get("id")
        unresolved_bugs = []
        for bid in linked_bug_ids(t):
            raw = fetch_bug(bid)
            state = parse.cf_name(raw, "State")
            if parse.is_done(state):
                continue
            unresolved_bugs.append(shape_bug(raw))
        blocking, low_priority = classify_bugs(unresolved_bugs)
        tickets.append({
            "id": tid,
            "summary": t.get("summary") or "",
            "state": "RE-OPEN",
            "blockingBugs": blocking,
            "lowPriorityBugs": low_priority,
            "status": "blocked" if blocking else "ready",
        })

    return {
        "tickets": tickets,
        "kpi": {
            "total": len(tickets),
            "blocked": sum(1 for t in tickets if t["status"] == "blocked"),
            "ready": sum(1 for t in tickets if t["status"] == "ready"),
        },
    }
