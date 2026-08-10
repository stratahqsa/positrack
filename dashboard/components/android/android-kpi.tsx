import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AndroidBlock } from "@/lib/types";

/** Top KPI strip for the Android Status Report, same visual pattern as
 *  support/sup-posx-kpi.tsx: a row of tiles in one Card. Open Bugs gets the
 *  `danger` highlight when non-zero, matching the "there's a backlog" tile
 *  convention used elsewhere (Support Tickets' Pending, Bug Analysis' Total
 *  Open). */
export function AndroidKpi({ kpi }: { kpi: AndroidBlock["kpi"] }) {
  const stats: { label: string; value: string; danger?: boolean }[] = [
    { label: "Total Stories", value: kpi.total_stories.toLocaleString() },
    { label: "Open", value: kpi.open_stories.toLocaleString() },
    { label: "Done", value: kpi.done_stories.toLocaleString() },
    { label: "Open Bugs", value: kpi.open_bugs.toLocaleString(), danger: kpi.open_bugs > 0 },
  ];

  return (
    <Card>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border/60 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface/80 px-3 py-3 text-center">
            <div
              className={cn(
                "tabular truncate text-lg font-bold leading-none",
                s.danger ? "text-danger" : "text-fg",
              )}
              title={s.value}
            >
              {s.value}
            </div>
            <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-faint">{s.label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
