"use client";

import * as React from "react";
import type {
  Effort,
  TimeSpent,
  Gamification,
  TrendPoint,
  RedCounts,
  RedDelta,
} from "@/lib/types";
import { FilterProvider } from "@/components/filter-context";
import { KpiStrip } from "@/components/kpi-strip";
import { DashboardTabs } from "@/components/dashboard-tabs";

/**
 * Single client boundary for the interactive dashboard. Wraps the KPI strip AND
 * the tabbed body in ONE <FilterProvider> so a click on a KPI card can both set
 * a RED filter and switch to the Effort tab. The server component (page.tsx)
 * stays server-only and just projects the primitives it needs down to here.
 *
 * A <Suspense> boundary is required because the provider reads the URL via
 * useSearchParams (for shareable filtered links). The fallback is a light
 * skeleton so the real KPI strip always mounts inside the provider and can use
 * the filter context for click-to-filter.
 */
function ShellFallback() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-[92px] animate-pulse rounded-lg bg-surface/60 ring-1 ring-border"
          />
        ))}
      </div>
      <div className="h-9 w-full max-w-md animate-pulse rounded-lg bg-surface/60" />
    </div>
  );
}
export function DashboardShell({
  kpi,
  effort,
  timespent,
  gamification,
  trend,
  sprintsAvailable,
  timespentBySprint,
  defaultSprint,
}: {
  kpi: {
    red: RedCounts;
    delta: RedDelta | null;
    openEpics: number;
    pendingMinutes: number;
    pendingMd: string;
  };
  effort: Effort;
  timespent: TimeSpent;
  gamification: Gamification;
  trend: TrendPoint[];
  sprintsAvailable?: string[];
  timespentBySprint?: Record<string, TimeSpent>;
  defaultSprint: string;
}) {
  return (
    <React.Suspense fallback={<ShellFallback />}>
      <FilterProvider defaultTab="effort">
        <div className="space-y-6">
          <KpiStrip {...kpi} />
          <DashboardTabs
            effort={effort}
            timespent={timespent}
            gamification={gamification}
            trend={trend}
            sprintsAvailable={sprintsAvailable}
            timespentBySprint={timespentBySprint}
            defaultSprint={defaultSprint}
          />
        </div>
      </FilterProvider>
    </React.Suspense>
  );
}
