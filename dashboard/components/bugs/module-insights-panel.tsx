"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { Bug } from "@/lib/types";
import { filterByPriority, groupBugsByModule, groupModuleInsights, priorityOptions } from "@/lib/bug-modules";
import { ModuleInsights } from "@/components/bugs/module-insights";

type Tab = "7day" | "open";

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
        active ? "bg-violet/15 text-violet" : "text-faint hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function PriorityChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-accent/50 bg-accent/12 text-accent"
          : "border-border-strong bg-transparent text-faint hover:text-fg",
      )}
    >
      {label}
    </button>
  );
}

/**
 * Module Insights, tabbed between a 7-day view (bugs.seven_day_bugs — created
 * in the last 7 days) and an "All Open" view (bugs.open_bugs — every
 * currently-open bug), both grouped client-side via groupModuleInsights() so
 * they share one code path and one priority filter. The multi-select
 * priority chips apply to whichever tab is active (2026-07-21: previously
 * "All Open" only) — options are derived from whatever priority values are
 * actually present across both bug sets rather than hardcoded, so e.g.
 * "Urgent" shows up automatically if this instance's Priority bundle has it.
 * Every row is expandable to its underlying tickets via bugsByModule.
 *
 * At the default "every priority selected" state this reproduces the same
 * module/submodule grouping as the old server-precomputed 7-day view
 * (scripts/reports/bugs.py::module_insights): same grouping key, same
 * count-descending sort, same top-8-submodules cap, applied to the same
 * bug list — module_insights() itself is no longer threaded into the
 * dashboard, only its already-normalized inputs (submodule aliasing happens
 * once in parse.submodule(), so both server and client grouping see the same
 * canonical strings).
 */
export function ModuleInsightsPanel({
  sevenDayBugs,
  openBugs,
}: {
  sevenDayBugs: Bug[];
  openBugs: Bug[];
}) {
  const [tab, setTab] = React.useState<Tab>("7day");
  const options = React.useMemo(
    () => priorityOptions([...sevenDayBugs, ...openBugs]),
    [sevenDayBugs, openBugs],
  );
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(options));

  // Keep "all selected" in sync if the option set itself changes (new snapshot).
  React.useEffect(() => {
    setSelected(new Set(options));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sevenDayBugs, openBugs]);

  function toggle(opt: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(opt)) next.delete(opt);
      else next.add(opt);
      return next;
    });
  }

  const filteredSevenDay = React.useMemo(
    () => filterByPriority(sevenDayBugs, selected),
    [sevenDayBugs, selected],
  );
  const filteredOpen = React.useMemo(() => filterByPriority(openBugs, selected), [openBugs, selected]);
  const sevenDayModules = React.useMemo(() => groupModuleInsights(filteredSevenDay), [filteredSevenDay]);
  const openModules = React.useMemo(() => groupModuleInsights(filteredOpen), [filteredOpen]);
  const sevenDayByModule = React.useMemo(() => groupBugsByModule(filteredSevenDay), [filteredSevenDay]);
  const openByModule = React.useMemo(() => groupBugsByModule(filteredOpen), [filteredOpen]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 border-b border-border/40 px-4 py-2">
        <TabButton active={tab === "7day"} onClick={() => setTab("7day")}>
          Last 7 Days ({filteredSevenDay.length})
        </TabButton>
        <TabButton active={tab === "open"} onClick={() => setTab("open")}>
          All Open ({filteredOpen.length})
        </TabButton>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-border/40 px-4 py-2.5">
        {options.map((opt) => (
          <PriorityChip key={opt} label={opt} active={selected.has(opt)} onClick={() => toggle(opt)} />
        ))}
      </div>

      <ModuleInsights
        modules={tab === "7day" ? sevenDayModules : openModules}
        bugsByModule={tab === "7day" ? sevenDayByModule : openByModule}
      />
    </div>
  );
}
