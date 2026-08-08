# scripts/reports/sup_posx.py
"""Support Tickets data block (SUP project). SUP is a separate YouTrack
project from PXB1 with its own schema -- "Type" (not PXB1's "TaskType") is
the field that carries "POS X" as one of many enum values. Pending = Type:
POS X, State not in (Solved, Closed) -- YouTrack's built-in #Unresolved flag
is NOT equivalent here (it still included 21 already-"Solved" tickets when
checked live 2026-08-01), so the exclusion is explicit rather than relying
on that shortcut."""
from collections import Counter
from . import parse

SUP_PROJECT = "SUP"
EXCLUDED_STATES = ("Solved", "Closed")


def parse_ticket(raw):
    return {
        "id": raw.get("idReadable") or raw.get("id"),
        "summary": raw.get("summary") or "",
        "created": raw.get("created"),
        "state": parse.cf_name(raw, "State"),
        "location": parse.cf_name(raw, "Location") or None,
        "assignee": parse.cf_name(raw, "Assignee"),
    }


def _breakdown(tickets, key, blank_label):
    """Same {state,count,bar,pct} shape as reports.bugs.state_breakdown,
    generalized to any string-valued key -- used for both By State and By
    Location. The dashboard's StateBreakdownRow type/component is reused
    as-is for both panels, the same way it's already reused for the Medium
    and Low bug breakdowns on the Bug Analysis page."""
    counts = Counter((t.get(key) or blank_label) for t in tickets)
    total = sum(counts.values()) or 1
    mx = max(counts.values()) if counts else 1
    return [{"state": k, "count": n, "bar": round(n / mx, 3), "pct": round(100.0 * n / total, 1)}
            for k, n in counts.most_common()]


def _age_days(ticket, now_ms):
    """Age in days (float) since `ticket["created"]`, anchored to the
    snapshot's OWN generation time (never the viewer's clock) -- same
    convention as scripts/reports/bugs.py's aging-bug feature, so "17 days
    old" means the same thing everywhere on the dashboard regardless of when
    someone loads the page."""
    created = ticket.get("created")
    return round((now_ms - created) / 86400000.0, 1) if created else None


def build_sup_posx(ctx, yt, now_ms):
    """Run the underlying query and shape the block. `yt` is the ytcore
    module. Deliberately does NOT take a `cfg` (ReportsConfig) -- SUP is a
    hardcoded, genuinely different project than the PXB1 Phase-1 baseline
    every other report module reads `cfg.project`/`cfg.scope` from, so
    threading `cfg` through here would misleadingly imply it respects those
    baselines when it doesn't."""
    F = "id,idReadable,summary,created,customFields(name,value(name,text))"
    state_excl = "".join(" State: -%s" % s for s in EXCLUDED_STATES)
    query = "project: %s Type: {POS X}%s" % (SUP_PROJECT, state_excl)
    tickets = [parse_ticket(r) for r in yt.get_issues(ctx, query, fields=F)]
    for t in tickets:
        t["age_days"] = _age_days(t, now_ms)

    by_state = _breakdown(tickets, "state", "(No state)")
    by_location = _breakdown(tickets, "location", "(No location)")

    ages = [t["age_days"] for t in tickets if t["age_days"] is not None]
    oldest_days = max(ages) if ages else None

    return {
        "tickets": tickets,
        "by_state": by_state,
        "by_location": by_location,
        "kpi": {
            "pending": len(tickets),
            "oldest_days": oldest_days,
            "top_state": by_state[0]["state"] if by_state else None,
            "top_location": by_location[0]["state"] if by_location else None,
        },
    }
