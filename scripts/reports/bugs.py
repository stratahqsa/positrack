# scripts/reports/bugs.py
"""Bug Analysis data block. Pure shaping fns are unit-tested; build_bugs() wires
the underlying queries (Urgent folds into High — see build_bugs). Rules: PRD_1
§4, Examples_1. TaskType: BUG only; explicit dates."""
from collections import Counter, defaultdict
from . import parse

def parse_bug(raw):
    return {
        "id": raw.get("idReadable") or raw.get("id"),
        "summary": raw.get("summary") or "",
        "created": raw.get("created"),
        "state": parse.cf_name(raw, "State"),
        "priority": parse.cf_name(raw, "Priority"),
        "module": parse.cf_name(raw, "Module") or None,
        "submodule": parse.submodule(raw.get("summary") or ""),
        "assignee": parse.cf_name(raw, "Assignee"),
        "reporter": ((raw.get("reporter") or {}).get("fullName")
                     or (raw.get("reporter") or {}).get("login") or ""),
    }

def in_window(created_ms, win_start_ms, win_end_ms):
    """Client-side re-filter for Q1 (Examples_1 §2 Example 3): compare epoch ms
    directly, never UTC calendar-date strings — a bug created 8 Jul 00:15 IST has
    UTC calendar date 7 Jul but must still count as inside the window."""
    return win_start_ms <= (created_ms or 0) <= win_end_ms

def split_high(q2_bugs, win_start_ms):
    """Section 1 (in window) vs Section 2 (older). Invariant: union == input."""
    old = [b for b in q2_bugs if (b.get("created") or 0) < win_start_ms]
    new = [b for b in q2_bugs if (b.get("created") or 0) >= win_start_ms]
    return old, new

def state_breakdown(open_bugs):
    counts = Counter((b.get("state") or "—") for b in open_bugs)
    total = sum(counts.values()) or 1
    mx = max(counts.values()) if counts else 1
    return [{"state": st, "count": n, "bar": round(n / mx, 3), "pct": round(100.0 * n / total, 1)}
            for st, n in counts.most_common()]

def module_insights(seven_day_bugs, top_submodules=8):
    by_mod = defaultdict(list)
    for b in seven_day_bugs:
        by_mod[b.get("module") or "(No module)"].append(b)
    out = []
    for mod, items in sorted(by_mod.items(), key=lambda kv: -len(kv[1])):
        raw_subs = [s for s in (parse.submodule(i.get("summary") or "") for i in items) if s]
        # Group by fold-key so casing/pluralization duplicates NOT YET in
        # parse._SUBMODULE_ALIASES (not yet reported) still collapse into one
        # row (2026-07-22) — display is whichever exact spelling is most
        # common within the group; ties broken alphabetically, which (thanks
        # to ASCII ordering putting uppercase before lowercase) tends to
        # prefer a Title Case spelling over an all-lowercase one.
        groups = defaultdict(Counter)
        for s in raw_subs:
            groups[parse.submodule_fold_key(s)][s] += 1
        merged = Counter({key: sum(variants.values()) for key, variants in groups.items()})
        display_for_key = {key: min(variants.items(), key=lambda kv: (-kv[1], kv[0]))[0]
                            for key, variants in groups.items()}
        out.append({"module": mod, "count": len(items),
                    "submodules": [{"submodule": display_for_key[k], "count": n}
                                   for k, n in merged.most_common(top_submodules)]})
    return out

def _dedupe(raw_list):
    seen, out = set(), []
    for r in raw_list:
        k = r.get("idReadable") or r.get("id")
        if k and k not in seen:
            seen.add(k); out.append(r)
    return out

def build_bugs(ctx, yt, cfg, now_ms):
    """Run the underlying queries and shape the block. `yt` is the ytcore module."""
    w = parse.ist_window(now_ms)
    P = cfg.project
    F = "id,idReadable,summary,created,resolved,reporter(fullName,login),customFields(name,value(name,text))"
    def q(query):
        return [parse_bug(r) for r in _dedupe(yt.get_issues(ctx, query, fields=F))]
    q1 = [b for b in q("project: %s TaskType: BUG created: %s .. Today #Unresolved" % (P, w["window_start_str"]))
          if in_window(b["created"], w["start_ms"], w["end_ms"])]   # client-side window (Examples_1 §2 Ex3)
    # "Urgent" (this instance's top severity, above High) folds into the "High"
    # bucket everywhere in this report — no separate Urgent section, just one
    # combined count under the existing High label (2026-07-21). Two disjoint
    # #Unresolved priority queries, concatenated rather than one OR query, to
    # avoid relying on YouTrack multi-value query syntax this codebase has no
    # existing precedent for.
    q2_high = q("project: %s TaskType: BUG Priority: {High} #Unresolved" % P)
    q2_urgent = q("project: %s TaskType: BUG Priority: {Urgent} #Unresolved" % P)
    q2 = q2_high + q2_urgent
    q3 = q("project: %s TaskType: BUG Priority: {Medium} #Unresolved" % P)
    q4 = q("project: %s TaskType: BUG Priority: {Low} #Unresolved" % P)
    q5 = q("project: %s TaskType: BUG created: %s .. Today" % (P, w["seven_days_str"]))
    q6 = q("project: %s TaskType: BUG #Unresolved" % P)   # every open bug, any/no priority
    old_high, new_high = split_high(q2, w["start_ms"])
    by_prio = {
        "High": [b for b in q1 if b["priority"] in ("High", "Urgent")],
        "Medium": [b for b in q1 if b["priority"] == "Medium"],
        "Low": [b for b in q1 if b["priority"] == "Low"],
    }
    new_urgent = sum(1 for b in by_prio["High"] if b["priority"] == "Urgent")
    modules = module_insights(q5)
    return {
        "window": {"start_ms": w["start_ms"], "end_ms": w["end_ms"], "label": w["label"]},
        "new_in_window": by_prio,
        "open_high_older": old_high,
        "medium_by_state": state_breakdown(q3),
        "low_by_state": state_breakdown(q4),
        "module_insights": modules,
        "seven_day_bugs": q5,   # full 7-day bug list, so the dashboard can expand a Module
                                 # Insights row to show the underlying tickets
        "open_bugs": q6,   # full open-bug list (module/submodule/priority per bug), for the
                            # dashboard's "All Open" Module Insights view + priority filter
        "kpi": {
            "new_high": len(by_prio["High"]), "new_medium": len(by_prio["Medium"]),
            "open_high": len(q2), "open_medium": len(q3), "open_low": len(q4),
            "total_open": len(q2) + len(q3) + len(q4),      # sum of 3 priority buckets (Examples_1 §7); q2 = High+Urgent
            "new_urgent": new_urgent, "open_urgent": len(q2_urgent),   # Urgent sub-count within
                                                                        # the combined "High" bucket
                                                                        # above, for a "· N Urgent"
                                                                        # annotation on the High tiles
            "modules_hit": len(modules),
        },
    }
