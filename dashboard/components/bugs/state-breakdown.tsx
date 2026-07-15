import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StateBreakdownRow } from "@/lib/types";
import { stateVariant } from "@/components/weekly/badge-tone";

type Tone = "info" | "good";

const BAR_FILL: Record<Tone, string> = {
  info: "bg-info",
  good: "bg-good",
};

/**
 * One §3 panel (docs/reports-dashboard/plans/05-bug-analysis.md Task 2 /
 * PRD_1 §5 Section 3): state badge · count pill · horizontal bar
 * proportional to the panel's max count · percentage of this priority's
 * open total. `row.bar` (0..1) and `row.pct` arrive pre-computed from the
 * snapshot (Plan 1) — this just renders them; rows are already sorted by
 * count descending upstream. `tone` picks the bar fill color: `info` for
 * the Medium panel, `good` for Low, matching the same priority -> color
 * mapping bug-kpi.tsx uses (via priorityVariant's High/Medium/Low ->
 * warn/info/good convention) so the same hue means the same priority
 * everywhere on the page.
 */
export function StateBreakdown({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: StateBreakdownRow[];
  tone: Tone;
}) {
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
          {rows.map((row) => (
            <div key={row.state} className="flex items-center gap-2">
              <Badge variant={stateVariant(row.state, false)} size="sm" className="w-[168px] shrink-0 justify-center">
                {row.state || "—"}
              </Badge>
              <span className="tabular w-7 shrink-0 text-right text-[11.5px] text-fg/80">{row.count}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-elevated">
                <div
                  className={cn("h-full rounded-full", BAR_FILL[tone])}
                  style={{ width: `${Math.max(row.bar * 100, 2)}%` }}
                />
              </div>
              <span className="tabular w-11 shrink-0 text-right text-[11px] text-faint">{row.pct}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
