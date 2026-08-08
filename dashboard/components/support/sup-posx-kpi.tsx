import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SupPosxBlock } from "@/lib/types";

/**
 * Top KPI strip for the Support Tickets page, same visual pattern as
 * bugs/bug-kpi.tsx: a row of tiles in one Card. Pending gets a `danger`
 * highlight when non-zero (the overall "there's a backlog" signal, same
 * convention BugKpi uses for Total Open); the rest are neutral counts/labels
 * — Priority is deliberately NOT a tile here, since none of the current
 * pending tickets have one set (2026-08-01), and a KPI that's always
 * "0 High / 0 Blocking" would just be noise.
 */
export function SupPosxKpi({ kpi }: { kpi: SupPosxBlock["kpi"] }) {
  const stats: { label: string; value: string; danger?: boolean }[] = [
    { label: "Pending", value: kpi.pending.toLocaleString(), danger: kpi.pending > 0 },
    { label: "Oldest ticket", value: kpi.oldest_days != null ? `${Math.round(kpi.oldest_days)}d` : "—" },
    { label: "Top state", value: kpi.top_state ?? "—" },
    { label: "Top location", value: kpi.top_location ?? "—" },
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
