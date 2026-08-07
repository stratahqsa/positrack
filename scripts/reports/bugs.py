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
        # Same multi-value "Sprints" field + max-by-trailing-number rule as
        # schedule.py's parse_story() -- picks the highest sprint a bug was
        # ever moved into if it carried across more than one (2026-08-01).
        "sprint": parse.sprint_max(parse._cf_value(raw, "Sprints")),
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

# 4 whole-day buckets (label, lo, hi, severity), ascending, hi=None on the
# last meaning "more than the previous bucket's hi" (PM-confirmed,
# 2026-07-31). Every open bug in the priority group lands in exactly one
# bucket — unlike the pre-2026-07-31 3-bucket "citable" scheme, nothing is
# dropped for being too fresh; the leading "none"-severity bucket is what
# used to be excluded entirely. Medium's ranges are roughly double
# High/Urgent's, by the PM's own stated rule. Low priority stays excluded
# from aging entirely (aging is expected there by design, so per-ticket
# flagging wouldn't be actionable).
AGING_BUCKETS_HIGH_URGENT = [
    ("0-7", 0, 7, "none"),
    ("8-14", 8, 14, "low"),
    ("15-21", 15, 21, "medium"),
    ("21+", 22, None, "high"),
]
AGING_BUCKETS_MEDIUM = [
    ("0-15", 0, 15, "none"),
    ("16-30", 16, 30, "low"),
    ("31-60", 31, 60, "medium"),
    ("60+", 61, None, "high"),
]

def _age_days(bug, now_ms):
    """Age in days (float) since `bug["created"]`, or None if it has no created
    timestamp (defensive; every bug from a real YouTrack fetch has one)."""
    created = bug.get("created")
    if not created:
        return None
    return (now_ms - created) / 86400000.0

def aging_buckets(bugs, bucket_defs, now_ms):
    """Buckets `bugs` (already priority-filtered by the caller, e.g. all open
    High+Urgent, or all open Medium) by whole days since creation into the 4
    (label, lo, hi, severity) ranges in `bucket_defs` (ascending; hi=None on
    the last bucket means "more than the previous bucket's hi"). Every bug
    with a resolvable age lands in exactly one bucket — this shows the FULL
    age distribution for Bug Analysis's Aging Bugs section, not just a
    citable subset (the AI-brief evidence builder is what skips the
    "none"-severity bucket when picking bugs to cite, not this function).
    Each bucket's bugs are oldest-first, annotated with `age_days`."""
    out = []
    for label, lo, hi, severity in bucket_defs:
        items = []
        for b in bugs:
            age = _age_days(b, now_ms)
            if age is None:
                continue
            age_whole_days = int(age)
            if age_whole_days < lo:
                continue
            if hi is not None and age_whole_days > hi:
                continue
            entry = dict(b)
            entry["age_days"] = round(age, 1)
            items.append(entry)
        items.sort(key=lambda x: -x["age_days"])
        out.append({"range": label, "severity": severity, "count": len(items), "bugs": items})
    return out

def _with_urgent_counts(modules, bugs):
    """Attaches `urgent_count` to each module_insights() entry — the Urgent
    sub-count within that module's combined High+Urgent count, so callers
    (the AI-brief evidence, in particular) can state "N High/Urgent (M
    Urgent)" instead of blending the two into one ambiguous number
    (2026-07-31: with Urgent this rare — often just 1 ticket project-wide —
    folding it silently into "High" overstates how many are actually top
    severity)."""
    urgent_by_module = Counter((b.get("module") or "(No module)") for b in bugs if b.get("priority") == "Urgent")
    for m in modules:
        m["urgent_count"] = urgent_by_module.get(m["module"], 0)
    return modules

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
    # Same aggregation, over the CURRENT full open-bug list instead of the
    # rolling 7-day window -- a 7-day-old count can cite bugs already closed
    # by the time someone reads it (the AI Insights briefing's module-hotspot
    # evidence switched to this field for exactly that reason, 2026-07-31;
    # `module_insights` itself stays unchanged, since Health's "hottest
    # module" deliberately wants the stable 7-day recency signal, not the
    # full backlog — see dashboard/lib/health.ts's bugPressure() comment).
    modules_open = module_insights(q6)
    # Ranked/counted by High+Urgent bugs only, NOT total open count: a module
    # can look "hot" mostly from low-stakes Medium/Low tickets while a module
    # with fewer-but-nastier bugs ranks lower on the all-priority view. This
    # is what the AI-brief's module-hotspot evidence switched to (2026-07-31)
    # — `module_insights_open` (all priorities) stays for anything else that
    # wants the broader view.
    hu_open = [b for b in q6 if b["priority"] in ("High", "Urgent")]
    modules_high_urgent = _with_urgent_counts(module_insights(hu_open), hu_open)
    aging_high_urgent = aging_buckets(q2, AGING_BUCKETS_HIGH_URGENT, now_ms)
    aging_medium = aging_buckets(q3, AGING_BUCKETS_MEDIUM, now_ms)
    return {
        "window": {"start_ms": w["start_ms"], "end_ms": w["end_ms"], "label": w["label"]},
        "new_in_window": by_prio,
        "open_high_older": old_high,
        "medium_by_state": state_breakdown(q3),
        "low_by_state": state_breakdown(q4),
        "module_insights": modules,
        "module_insights_open": modules_open,   # same shape, but over ALL currently open bugs
        "module_insights_high_urgent": modules_high_urgent,   # same shape again, High+Urgent only,
                                                                # each entry also carrying urgent_count
        "aging_high_urgent": aging_high_urgent,   # 4 age buckets covering ALL open High+Urgent bugs
        "aging_medium": aging_medium,              # same, over ALL open Medium bugs (~double the ranges)
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
