import { Badge } from "@/components/ui/badge";
import type { ModuleInsight } from "@/lib/types";

/** PRD_1 §5 Section 4: "top 8 per module by count". Sliced here too (not
 *  just trusted upstream) so the ≤8 acceptance criterion holds regardless
 *  of what the snapshot contains. */
const MAX_SUBMODULE_BADGES = 8;

/**
 * §4 — Module Insights (7d) (docs/reports-dashboard/plans/05-bug-analysis.md
 * Task 2 / PRD_1 §5 Section 4): one row per module — name, a bug-count pill,
 * and up to 8 "submodule · count" badges. Modules arrive pre-sorted by count
 * descending from the snapshot (Plan 1); submodules within each module are
 * likewise pre-sorted by count descending, so slicing the first 8 keeps the
 * highest counts.
 */
export function ModuleInsights({ modules }: { modules: ModuleInsight[] }) {
  if (modules.length === 0) {
    return <div className="px-4 py-6 text-center text-[12px] text-faint">No module data.</div>;
  }

  return (
    <div className="divide-y divide-border/40">
      {modules.map((m) => (
        <div key={m.module} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-4 py-2.5">
          <span className="text-[12.5px] font-medium text-fg/90">{m.module}</span>
          <Badge variant="violet" size="sm">
            {m.count}
          </Badge>
          {m.submodules.slice(0, MAX_SUBMODULE_BADGES).map((sm) => (
            <Badge key={sm.submodule} variant="accent" size="sm">
              {sm.submodule} · {sm.count}
            </Badge>
          ))}
        </div>
      ))}
    </div>
  );
}
