"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Bug, ModuleInsight } from "@/lib/types";
import { BugTable } from "@/components/bugs/bug-table";

/** PRD_1 §5 Section 4: "top 8 per module by count". Sliced here too (not
 *  just trusted upstream) so the ≤8 acceptance criterion holds regardless
 *  of what the snapshot contains. */
const MAX_SUBMODULE_BADGES = 8;

type SortKey = "module" | "count";
type SortDir = "asc" | "desc";
interface SortState {
  key: SortKey;
  dir: SortDir;
}

/** Modules arrive pre-sorted by count descending — kept as the default so
 *  the list looks identical to before sorting existed until a header is
 *  clicked. */
const DEFAULT_SORT: SortState = { key: "count", dir: "desc" };

function sortModules(modules: ModuleInsight[], sort: SortState): ModuleInsight[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...modules].sort((a, b) => {
    const cmp = sort.key === "module" ? a.module.localeCompare(b.module) : a.count - b.count;
    return cmp !== 0 ? sign * cmp : a.module.localeCompare(b.module);
  });
}

function Th({
  label,
  sortKey,
  className,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  className?: string;
  sort: SortState;
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      aria-label={`Sort by ${label}${active ? ` (${sort.dir === "asc" ? "ascending" : "descending"})` : ""}`}
      className={cn(
        "inline-flex items-center gap-1 rounded text-[10px] font-semibold uppercase tracking-wide transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
        active ? "text-accent" : "text-faint",
        className,
      )}
    >
      {label}
      {active ? (
        sort.dir === "asc" ? (
          <ArrowUp className="size-3" />
        ) : (
          <ArrowDown className="size-3" />
        )
      ) : (
        <ArrowUpDown className="size-3 opacity-40" />
      )}
    </button>
  );
}

/**
 * §4 — Module Insights (7d) (docs/reports-dashboard/plans/05-bug-analysis.md
 * Task 2 / PRD_1 §5 Section 4): one row per module — name, a bug-count pill,
 * and up to 8 "submodule · count" badges. Module and Bug Count headers are
 * clickable (same re-sort-the-array pattern as weekly/story-table.tsx /
 * bugs/bug-table.tsx); submodule badges aren't a sortable column, so no
 * header is rendered for them. Default order (count descending) matches the
 * pre-sorted snapshot order, so nothing changes visually until a header is
 * clicked.
 *
 * `bugsByModule`, when supplied, makes each row expandable (chevron, same
 * expand/collapse pattern as weekly/story-table.tsx) to a nested BugTable of
 * the underlying tickets — e.g. "(No module)" expands to show exactly which
 * bugs have no Module set, instead of just the count.
 */
export function ModuleInsights({
  modules,
  bugsByModule,
}: {
  modules: ModuleInsight[];
  bugsByModule?: Map<string, Bug[]>;
}) {
  const [sort, setSort] = React.useState<SortState>(DEFAULT_SORT);
  const [sorted, setSorted] = React.useState<ModuleInsight[]>(() => sortModules(modules, DEFAULT_SORT));
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    setSorted(sortModules(modules, sort));
    setExpanded(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modules]);

  function handleSort(key: SortKey) {
    const dir: SortDir = sort.key === key && sort.dir === "asc" ? "desc" : "asc";
    const next: SortState = { key, dir };
    setSort(next);
    setSorted((prev) => sortModules(prev, next));
  }

  function toggleExpanded(module: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });
  }

  if (modules.length === 0) {
    return <div className="px-4 py-6 text-center text-[12px] text-faint">No module data.</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-4 border-b border-border/40 px-4 py-2">
        <Th label="Module" sortKey="module" sort={sort} onSort={handleSort} />
        <Th label="Bug Count" sortKey="count" sort={sort} onSort={handleSort} />
      </div>
      <div className="divide-y divide-border/40">
        {sorted.map((m) => {
          const bugs = bugsByModule?.get(m.module);
          const isExpanded = expanded.has(m.module);
          return (
            <div key={m.module}>
              <div
                className={cn(
                  "flex flex-wrap items-center gap-x-2 gap-y-1.5 px-4 py-2.5",
                  bugs ? "cursor-pointer hover:bg-elevated/40" : undefined,
                )}
                onClick={bugs ? () => toggleExpanded(m.module) : undefined}
              >
                {bugs ? (
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? "Collapse" : "Expand"} ${bugs.length} bug${bugs.length === 1 ? "" : "s"} for ${m.module}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpanded(m.module);
                    }}
                    className="text-faint hover:text-fg"
                  >
                    <ChevronRight className={cn("size-3.5 transition-transform", isExpanded && "rotate-90")} />
                  </button>
                ) : null}
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
              {bugs && isExpanded ? (
                <div className="border-t border-border/30 bg-elevated/20 py-2">
                  <BugTable rows={bugs} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
