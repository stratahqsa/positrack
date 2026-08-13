"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Bug, StateBreakdownRow } from "@/lib/types";
import { stateVariant } from "@/components/weekly/badge-tone";
import { BugTable } from "@/components/bugs/bug-table";

type Tone = "info" | "good";

const BAR_FILL: Record<Tone, string> = {
  info: "bg-info",
  good: "bg-good",
};

type SortKey = "state" | "count";
type SortDir = "asc" | "desc";
interface SortState {
  key: SortKey;
  dir: SortDir;
}

/** Rows arrive pre-sorted by count descending — kept as the default so the
 *  panel looks identical to before sorting existed until a header is clicked. */
const DEFAULT_SORT: SortState = { key: "count", dir: "desc" };

function sortRows(rows: StateBreakdownRow[], sort: SortState): StateBreakdownRow[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const cmp =
      sort.key === "state" ? a.state.localeCompare(b.state) : a.count - b.count;
    return cmp !== 0 ? sign * cmp : a.state.localeCompare(b.state);
  });
}

/** Groups `bugs` by their `state` field — the per-row ticket list backing
 *  each state's click-to-expand (same BugTable-on-click pattern as
 *  AgingBugsPanel). Independent of `rows`/bar/pct, which stay
 *  server-computed via scripts/reports/bugs.py::state_breakdown() — this
 *  only needs to answer "which tickets are in state X". */
function groupByState(bugs: Bug[]): Map<string, Bug[]> {
  const out = new Map<string, Bug[]>();
  for (const b of bugs) {
    const key = b.state || "—";
    const list = out.get(key);
    if (list) list.push(b);
    else out.set(key, [b]);
  }
  return out;
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
        "inline-flex shrink-0 items-center gap-1 rounded text-[10px] font-semibold uppercase tracking-wide transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
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
 * One §3 panel (docs/reports-dashboard/plans/05-bug-analysis.md Task 2 /
 * PRD_1 §5 Section 3): state badge · count pill · horizontal bar
 * proportional to the panel's max count · percentage of this priority's
 * open total. `row.bar` (0..1) and `row.pct` arrive pre-computed from the
 * snapshot (Plan 1) — this just renders them. `tone` picks the bar fill
 * color: `info` for the Medium panel, `good` for Low, matching the same
 * priority -> color mapping bug-kpi.tsx uses (via priorityVariant's
 * High/Medium/Low -> warn/info/good convention) so the same hue means the
 * same priority everywhere on the page.
 *
 * State and Count headers are clickable (same re-sort-the-array pattern as
 * weekly/story-table.tsx / bugs/bug-table.tsx). Bar/Percentage stay
 * non-interactive — they're derived straight from Count, so sorting by
 * Count already orders them.
 *
 * Each row is also click-to-expand into that state's underlying tickets
 * (same BugTable-on-click interaction as AgingBugsPanel, one row open at a
 * time) — `bugs` is the full open-bug list for this priority (e.g. every
 * open Medium bug), grouped client-side by state purely to resolve each
 * row's ticket list; the displayed count/bar/% still come from `rows`
 * (server-computed), so this never becomes a second source of truth for
 * those numbers.
 */
export function StateBreakdown({
  title,
  rows,
  tone,
  bugs,
  tz,
}: {
  title: string;
  rows: StateBreakdownRow[];
  tone: Tone;
  bugs: Bug[];
  tz: string;
}) {
  const [sort, setSort] = React.useState<SortState>(DEFAULT_SORT);
  const [sorted, setSorted] = React.useState<StateBreakdownRow[]>(() => sortRows(rows, DEFAULT_SORT));
  const [expanded, setExpanded] = React.useState<string | null>(null);

  React.useEffect(() => {
    setSorted(sortRows(rows, sort));
    setExpanded(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  function handleSort(key: SortKey) {
    const dir: SortDir = sort.key === key && sort.dir === "asc" ? "desc" : "asc";
    const next: SortState = { key, dir };
    setSort(next);
    setSorted((prev) => sortRows(prev, next));
  }

  const byState = React.useMemo(() => groupByState(bugs), [bugs]);
  const total = rows.reduce((n, r) => n + r.count, 0);

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-[12.5px] font-semibold text-fg/90">{title}</h3>
        <span className="tabular text-[11px] text-faint">{total.toLocaleString()} open</span>
      </div>
      {rows.length === 0 ? (
        <div className="px-2 py-4 text-center text-[12px] text-faint">No data.</div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 px-0.5">
            <Th label="State" sortKey="state" className="w-[168px]" sort={sort} onSort={handleSort} />
            <Th label="Count" sortKey="count" className="w-7 justify-end text-right" sort={sort} onSort={handleSort} />
            <span className="flex-1 text-[10px] font-semibold uppercase tracking-wide text-faint">Bar</span>
            <span className="w-11 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wide text-faint">%</span>
          </div>
          {sorted.map((row) => {
            const stateBugs = byState.get(row.state) ?? [];
            const canExpand = stateBugs.length > 0;
            const isExpanded = expanded === row.state;
            return (
              <div key={row.state}>
                <div
                  className={cn(
                    "flex items-center gap-2 rounded px-0.5 py-0.5 transition-colors",
                    canExpand && "cursor-pointer hover:bg-elevated/40",
                  )}
                  onClick={canExpand ? () => setExpanded(isExpanded ? null : row.state) : undefined}
                >
                  <div className="flex w-[168px] shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={!canExpand}
                      aria-expanded={isExpanded}
                      aria-label={`${isExpanded ? "Collapse" : "Expand"} ${stateBugs.length} ticket${stateBugs.length === 1 ? "" : "s"} in ${row.state || "—"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (canExpand) setExpanded(isExpanded ? null : row.state);
                      }}
                      className={cn("shrink-0 text-faint", canExpand && "hover:text-fg")}
                    >
                      <ChevronRight className={cn("size-3 transition-transform", isExpanded && "rotate-90")} />
                    </button>
                    <Badge variant={stateVariant(row.state, false)} size="sm" className="flex-1 justify-center">
                      {row.state || "—"}
                    </Badge>
                  </div>
                  <span className="tabular w-7 shrink-0 text-right text-[11.5px] text-fg/80">{row.count}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-elevated">
                    <div
                      className={cn("h-full rounded-full", BAR_FILL[tone])}
                      style={{ width: `${Math.max(row.bar * 100, 2)}%` }}
                    />
                  </div>
                  <span className="tabular w-11 shrink-0 text-right text-[11px] text-faint">{row.pct}%</span>
                </div>
                {isExpanded && canExpand ? (
                  <div className="mt-1.5 border-t border-border/30 bg-elevated/20 py-2">
                    <BugTable rows={stateBugs} tz={tz} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
