"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AgingBucket } from "@/lib/types";
import { BugTable } from "@/components/bugs/bug-table";

const SEVERITY_BAR: Record<AgingBucket["severity"], string> = {
  low: "bg-info",
  medium: "bg-warn",
  high: "bg-danger",
};

const SEVERITY_BADGE: Record<AgingBucket["severity"], "info" | "warn" | "danger"> = {
  low: "info",
  medium: "warn",
  high: "danger",
};

/** Floor so a non-zero bucket always renders a visible sliver of bar, even
 *  when it's tiny next to the largest bucket. */
const MIN_BAR_PCT = 6;

/**
 * Bar-graph-per-age-bucket view (docs 2026-07-31: "a graph like view which
 * can expand from each ageing section"), one bar per severity bucket from
 * scripts/reports/bugs.py::aging_buckets() (low/medium/high, ascending —
 * e.g. "7-13d"/"14-29d"/"30+d" for High/Urgent, doubled day ranges for
 * Medium). Clicking a bar expands it into the exact same nested BugTable
 * used by ModuleInsights' row-expand (components/bugs/module-insights.tsx),
 * so the underlying ticket list looks and behaves identically to that
 * already-shipped pattern — only one bucket open at a time keeps the panel
 * compact (bars are meant to be scanned, not all expanded together).
 */
export function AgingBugsPanel({ buckets, tz }: { buckets: AgingBucket[]; tz: string }) {
  const [expanded, setExpanded] = React.useState<string | null>(null);

  React.useEffect(() => {
    setExpanded(null);
  }, [buckets]);

  const maxCount = Math.max(1, ...buckets.map((b) => b.count));
  const totalCount = buckets.reduce((sum, b) => sum + b.count, 0);

  if (totalCount === 0) {
    return (
      <div className="px-4 py-6 text-center text-[12px] text-faint">
        Nothing has crossed the citable age threshold.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/40">
      {buckets.map((bucket) => {
        const isExpanded = expanded === bucket.range;
        const hasBugs = bucket.count > 0;
        const widthPct = hasBugs ? Math.max((bucket.count / maxCount) * 100, MIN_BAR_PCT) : 0;
        return (
          <div key={bucket.range}>
            <div
              className={cn(
                "flex items-center gap-3 px-4 py-2.5",
                hasBugs ? "cursor-pointer hover:bg-elevated/40" : undefined,
              )}
              onClick={hasBugs ? () => setExpanded(isExpanded ? null : bucket.range) : undefined}
            >
              <button
                type="button"
                disabled={!hasBugs}
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? "Collapse" : "Expand"} ${bucket.count} bug${bucket.count === 1 ? "" : "s"} in the ${bucket.range} range`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasBugs) setExpanded(isExpanded ? null : bucket.range);
                }}
                className={cn("text-faint", hasBugs && "hover:text-fg")}
              >
                <ChevronRight className={cn("size-3.5 transition-transform", isExpanded && "rotate-90")} />
              </button>
              <span className="w-14 shrink-0 text-[11.5px] font-medium text-fg/90">{bucket.range}</span>
              <div className="h-5 min-w-0 flex-1 overflow-hidden rounded bg-elevated/40">
                <div
                  className={cn("h-full rounded transition-all", SEVERITY_BAR[bucket.severity])}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <Badge variant={SEVERITY_BADGE[bucket.severity]} size="sm" className="shrink-0">
                {bucket.count}
              </Badge>
            </div>
            {isExpanded && hasBugs ? (
              <div className="border-t border-border/30 bg-elevated/20 py-2">
                <BugTable rows={bucket.bugs} showPriority tz={tz} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
