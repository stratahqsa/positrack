# scripts/reports/bug_blocker.py
"""Bug Blocker Dashboard data block (2026-07-22). RE-OPEN development tickets
(TaskType: Development — user-confirmed against PXB1-7513, the "dev ticket"
level scripts/reports/drilldown.py walks to via a parent Story's Subtask
link) with unresolved bugs linked via an OUTWARD "Bugs Reported" link.
Urgent/High/Medium unresolved bugs BLOCK the ticket from closing; unresolved
Low-priority bugs are shown but don't block. A RE-OPEN ticket with NO bug
linked at all is not "ready" -- QA has yet to raise its bug -- so it is
"awaiting_bugs". Ready tickets carry `readySince` (epoch ms) for aging."""
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


def latest_reopen_ms(activities):
    """Epoch ms of the most recent State change INTO RE-OPEN, or None."""
    stamps = [
        a.get("timestamp") or 0
        for a in (activities or [])
        if (a.get("field") or {}).get("name") == "State"
        and any((x.get("name") or "").upper() == "RE-OPEN" for x in (a.get("added") or []))
    ]
    return max(stamps) if stamps else None


def ready_since_ms(reopened_ms, resolved_bug_ms):
    """A ticket became ready at the later of: it entering RE-OPEN, and its
    last linked bug being resolved. None when neither moment is known."""
    known = [m for m in [reopened_ms] + list(resolved_bug_ms) if m]
    return max(known) if known else None


def classify_bugs(bugs):
    """Split already-shaped, already-unresolved bugs into blocking
    (Urgent/High/Medium) vs low-priority (anything else, incl. no priority
    set — never blocking)."""
    blocking = [b for b in bugs if b["priority"] in BLOCKING_PRIORITIES]
    low_priority = [b for b in bugs if b["priority"] not in BLOCKING_PRIORITIES]
    return blocking, low_priority


def build_bug_blocker(ctx, yt, cfg, chunk=40):
    """RE-OPEN dev tickets + their unresolved linked bugs. `yt` is the ytcore
    module. Batched (2026-07-23 load cut): ONE query lists the tickets and ONE
    chunked `issue ID:` bulk query fetches every linked bug — was a GET per
    bug, the same N+1 shape drilldown.py used to have."""
    P = cfg.project
    LF = "id,idReadable,summary,links(direction,linkType(name),issues(id,idReadable))"
    BF = "id,idReadable,summary,resolved,customFields(name,value(name,text))"

    tickets_raw = yt.get_issues(ctx, "project: %s TaskType: Development State: RE-OPEN" % P, fields=LF)

    all_bug_ids, seen = [], set()
    for t in tickets_raw:
        for bid in linked_bug_ids(t):
            if bid not in seen:
                seen.add(bid)
                all_bug_ids.append(bid)
    bugs_by_id = {}
    for start in range(0, len(all_bug_ids), chunk):
        batch = all_bug_ids[start:start + chunk]
        for it in yt.get_issues(ctx, "issue ID: " + ", ".join(batch),
                                fields=BF, top=max(len(batch), 50)):
            rid = it.get("idReadable")
            if rid:
                bugs_by_id[rid] = it

    def fetch_bug(bid):
        return bugs_by_id.get(bid) or {"idReadable": bid, "customFields": []}

    tickets = []
    for t in tickets_raw:
        tid = t.get("idReadable") or t.get("id")
        unresolved_bugs, resolved_ms = [], []
        linked = linked_bug_ids(t)
        for bid in linked:
            raw = fetch_bug(bid)
            state = parse.cf_name(raw, "State")
            if parse.is_done(state):
                resolved_ms.append(raw.get("resolved") or 0)
                continue
            unresolved_bugs.append(shape_bug(raw))
        blocking, low_priority = classify_bugs(unresolved_bugs)
        if blocking:
            status = "blocked"
        elif not linked:
            status = "awaiting_bugs"
        else:
            status = "ready"
        ready_since = None
        if status == "ready":
            try:
                acts = yt.GET(ctx, "/api/issues/%s/activities?categories=CustomFieldCategory"
                                   "&fields=timestamp,field(name),added(name)&$top=200" % tid)
            except Exception:  # aging is auxiliary -- never fail the snapshot over it
                acts = []
            ready_since = ready_since_ms(latest_reopen_ms(acts), resolved_ms)
        tickets.append({
            "id": tid,
            "summary": t.get("summary") or "",
            "state": "RE-OPEN",
            "blockingBugs": blocking,
            "lowPriorityBugs": low_priority,
            "status": status,
            "readySince": ready_since,
        })

    return {
        "tickets": tickets,
        "kpi": {
            "total": len(tickets),
            "blocked": sum(1 for t in tickets if t["status"] == "blocked"),
            "ready": sum(1 for t in tickets if t["status"] == "ready"),
            "awaiting_bugs": sum(1 for t in tickets if t["status"] == "awaiting_bugs"),
        },
    }
