import type { Bug, ModuleInsight } from "./types";

/** PRD_1 §5 Section 4 cap, mirrored here (see components/bugs/module-insights.tsx). */
const TOP_SUBMODULES = 8;

/** Groups bugs by module ("(No module)" for unset), preserving the full Bug
 *  records — the basis for both the Module Insights count/submodule rollup
 *  and the per-row "expand to see tickets" drill-down. */
export function groupBugsByModule(bugs: Bug[]): Map<string, Bug[]> {
  const byModule = new Map<string, Bug[]>();
  for (const b of bugs) {
    const key = b.module || "(No module)";
    const list = byModule.get(key);
    if (list) list.push(b);
    else byModule.set(key, [b]);
  }
  return byModule;
}

/**
 * Client-side equivalent of scripts/reports/bugs.py::module_insights(), used
 * to build the "All Open" Module Insights view from the raw open_bugs list
 * (the 7-day view stays server-computed and untouched). Module/submodule
 * strings arrive already-normalized from the Python layer (parse.submodule's
 * alias table), so this is a plain group-and-count — no dedup logic here.
 */
export function groupModuleInsights(bugs: Bug[]): ModuleInsight[] {
  const byModule = groupBugsByModule(bugs);
  const out: ModuleInsight[] = [];
  for (const [module, items] of byModule) {
    const subCounts = new Map<string, number>();
    for (const b of items) {
      if (!b.submodule) continue;
      subCounts.set(b.submodule, (subCounts.get(b.submodule) ?? 0) + 1);
    }
    const submodules = [...subCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_SUBMODULES)
      .map(([submodule, count]) => ({ submodule, count }));
    out.push({ module, count: items.length, submodules });
  }
  return out.sort((a, b) => b.count - a.count);
}

/** Priority filter options, derived from whatever values are actually present
 *  in the data rather than a hardcoded list — so it adapts to this instance's
 *  real Priority bundle (e.g. if "Urgent" exists) without a code change. Bugs
 *  with an empty Priority field are grouped under "No Priority". */
export function priorityOptions(bugs: Bug[]): string[] {
  const seen = new Set<string>();
  let hasNoPriority = false;
  for (const b of bugs) {
    if (b.priority) seen.add(b.priority);
    else hasNoPriority = true;
  }
  const known = ["Urgent", "High", "Medium", "Low"].filter((p) => seen.has(p));
  const rest = [...seen].filter((p) => !known.includes(p)).sort();
  return [...known, ...rest, ...(hasNoPriority ? ["No Priority"] : [])];
}

export function filterByPriority(bugs: Bug[], selected: Set<string>): Bug[] {
  return bugs.filter((b) => selected.has(b.priority || "No Priority"));
}
