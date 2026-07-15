import { Bug, Flame } from "lucide-react";
import { StatTile } from "@/components/health/stat-tile";

/** Bug pressure — open High, new High/Med today, hottest module (bugPressure()). */
export function BugPressureTile({
  openHigh,
  newHigh,
  newMedium,
  hottestModule,
}: {
  openHigh: number;
  newHigh: number;
  newMedium: number;
  hottestModule: string | null;
}) {
  return (
    <StatTile
      label="Bug pressure"
      icon={Bug}
      tone={openHigh > 0 ? "danger" : "info"}
      href="/bugs"
      linkLabel="View Bug Analysis"
    >
      <div className="tabular text-2xl font-bold leading-none text-fg">
        {openHigh}
        <span className="ml-1 text-[12px] font-medium text-muted">open High</span>
      </div>
      <p className="tabular mt-1.5 text-[11.5px] text-faint">
        +{newHigh} High · +{newMedium} Medium today
      </p>
      {hottestModule ? (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-warn">
          <Flame className="size-3 shrink-0" />
          hottest: {hottestModule}
        </p>
      ) : null}
    </StatTile>
  );
}
