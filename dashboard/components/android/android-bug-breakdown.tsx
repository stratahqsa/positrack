"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DrillBug, StateBreakdownRow } from "@/lib/types";
import { stateVariant } from "@/components/weekly/badge-tone";
import { AndroidBugTable } from "@/components/android/android-bug-table";

const BAR_FILL = "bg-danger";

/**
 * Horizontal bar-per-state breakdown of pending Android bugs, each row
 * click-to-expand into that state's actual tickets — same interaction as
 * support/expandable-breakdown.tsx and bugs/state-breakdown.tsx, ported for
 * DrillBug[] rather than SupTicket[]/Bug[] (a new component per ticket
 * type is this codebase's established convention here, not a shared
 * generic one — see expandable-breakdown.tsx's own doc comment). `rows`
 * (count/bar/%) and `bugs` (the full pending list, for resolving each row's
 * ticket list) are both derived from the SAME already-filtered pending-bug
 * list by the caller, so there's one source of truth for the counts.
 */
export function AndroidBugBreakdown({
  rows,
  bugs,
  tz,
}: {
  rows: StateBreakdownRow[];
  bugs: DrillBug[];
  tz: string;
}) {
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    setExpanded(new Set());
  }, [bugs]);

  const bugsByState = React.useMemo(() => {
    const map = new Map<string, DrillBug[]>();
    for (const b of bugs) {
      const key = b.state || "—";
      const list = map.get(key);
      if (list) list.push(b);
      else map.set(key, [b]);
    }
    return map;
  }, [bugs]);

  function toggle(state: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(state)) next.delete(state);
      else next.add(state);
      return next;
    });
  }

  if (rows.length === 0) {
    return <div className="px-4 py-6 text-center text-[12px] text-faint">No pending bugs.</div>;
  }

  return (
    <div className="divide-y divide-border/40">
      {rows.map((row) => {
        const isExpanded = expanded.has(row.state);
        const rowBugs = bugsByState.get(row.state) ?? [];
        return (
          <div key={row.state}>
            <div
              className="flex cursor-pointer items-center gap-2.5 px-1 py-2 hover:bg-elevated/40"
              onClick={() => toggle(row.state)}
            >
              <button
                type="button"
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? "Collapse" : "Expand"} ${row.count} ticket${row.count === 1 ? "" : "s"} in ${row.state || "—"}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(row.state);
                }}
                className="text-faint hover:text-fg"
              >
                <ChevronRight className={cn("size-3.5 transition-transform", isExpanded && "rotate-90")} />
              </button>
              <Badge variant={stateVariant(row.state, false)} size="sm" className="w-[168px] shrink-0 justify-center">
                {row.state || "—"}
              </Badge>
              <span className="tabular w-7 shrink-0 text-right text-[11.5px] text-fg/80">{row.count}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-elevated">
                <div className={cn("h-full rounded-full", BAR_FILL)} style={{ width: `${Math.max(row.bar * 100, 2)}%` }} />
              </div>
              <span className="tabular w-11 shrink-0 text-right text-[11px] text-faint">{row.pct}%</span>
            </div>
            {isExpanded ? (
              <div className="border-t border-border/30 bg-elevated/20 py-2">
                <AndroidBugTable rows={rowBugs} tz={tz} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
