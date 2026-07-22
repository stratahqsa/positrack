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
 * Comparison key for near-duplicate submodule matching — mirrors
 * scripts/reports/parse.py::submodule_fold_key() exactly (lowercase + a
 * conservative trailing-plural fold on the last word only, skipping short
 * words like the "POS" acronym and double-s endings) so the "All Open" tab's
 * client-side grouping merges the same casing/pluralization duplicates the
 * Python-computed 7-day view does, without needing a table entry for every
 * future pair (2026-07-22). Never rewrites a bug's own submodule text — only
 * used to detect a match, for both the count rollup below and the
 * submodule drill-down filter in module-insights.tsx.
 */
export function submoduleFoldKey(text: string): string {
  const key = text.trim().toLowerCase();
  if (!key) return key;
  const lastSpace = key.lastIndexOf(" ");
  const head = lastSpace === -1 ? "" : key.slice(0, lastSpace + 1);
  const last = lastSpace === -1 ? key : key.slice(lastSpace + 1);
  if (last.endsWith("s") && !last.endsWith("ss") && last.length > 4) {
    return head + last.slice(0, -1);
  }
  return key;
}

/**
 * Client-side equivalent of scripts/reports/bugs.py::module_insights(), used
 * to build the "All Open" Module Insights view from the raw open_bugs list
 * (the 7-day view is also computed this same way client-side now — see
 * module-insights-panel.tsx). Module/submodule strings arrive already
 * normalized for confirmed aliases (parse.submodule's alias table), but this
 * additionally groups by submoduleFoldKey() so not-yet-aliased
 * casing/pluralization duplicates still merge into one row, picking
 * whichever exact spelling is most common as the display (ties broken
 * alphabetically) — the same algorithm as module_insights() in Python.
 */
export function groupModuleInsights(bugs: Bug[]): ModuleInsight[] {
  const byModule = groupBugsByModule(bugs);
  const out: ModuleInsight[] = [];
  for (const [module, items] of byModule) {
    const groups = new Map<string, Map<string, number>>();
    for (const b of items) {
      if (!b.submodule) continue;
      const key = submoduleFoldKey(b.submodule);
      const variants = groups.get(key) ?? new Map<string, number>();
      variants.set(b.submodule, (variants.get(b.submodule) ?? 0) + 1);
      groups.set(key, variants);
    }
    const submodules = [...groups.values()]
      .map((variants) => {
        const count = [...variants.values()].reduce((a, c) => a + c, 0);
        const [submodule] = [...variants.entries()].sort(([sa, na], [sb, nb]) =>
          nb !== na ? nb - na : sa < sb ? -1 : sa > sb ? 1 : 0,
        )[0];
        return { submodule, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_SUBMODULES);
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
