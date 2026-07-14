import { Timer, AlertTriangle } from "lucide-react";
import { StatTile } from "@/components/health/stat-tile";

/**
 * Remaining effort — man-days + hours open (remainingEffort()), with RED
 * context from insights.red_counts (total_red, overshoot) so the raw
 * man-days figure isn't read in isolation from the epics driving it.
 */
export function EffortTile({
  manDays,
  hours,
  totalRed,
  overshoot,
}: {
  manDays: number;
  hours: number;
  totalRed: number;
  overshoot: number;
}) {
  return (
    <StatTile label="Remaining effort" icon={Timer} tone="violet" href="#" linkLabel="View Effort">
      <div className="tabular text-2xl font-bold leading-none text-fg">
        {manDays.toFixed(1)}
        <span className="ml-1 text-[12px] font-medium text-muted">md</span>
      </div>
      <p className="tabular mt-1 text-[11px] text-faint">
        {Math.round(hours).toLocaleString()}h open
      </p>
      {totalRed > 0 ? (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-warn">
          <AlertTriangle className="size-3 shrink-0" />
          {totalRed} total RED
          {overshoot > 0 ? ` · ${overshoot} overshooting` : ""}
        </p>
      ) : null}
    </StatTile>
  );
}
