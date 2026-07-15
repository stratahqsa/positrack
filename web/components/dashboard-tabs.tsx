"use client";

import * as React from "react";
import {
  LayoutGrid,
  Clock,
  Users,
  Trophy,
  TrendingUp,
  Rocket,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import type {
  Effort,
  TimeSpent,
  Gamification,
  TrendPoint,
} from "@/lib/types";
import { selectEpics } from "@/lib/filter";
import { useFilters } from "@/components/filter-context";
import { FilterBar } from "@/components/filter-bar";
import { TabEffort } from "@/components/tab-effort";
import { TabTime } from "@/components/tab-time";
import { TabTeams } from "@/components/tab-teams";
import { TabLeaderboard } from "@/components/tab-leaderboard";
import { TabTrends } from "@/components/tab-trends";

function Count({ n }: { n: number }) {
  return (
    <span className="tabular rounded bg-elevated px-1 text-[10px] font-semibold text-faint">
      {n}
    </span>
  );
}

interface DashboardData {
  effort: Effort;
  timespent: TimeSpent;
  gamification: Gamification;
  trend: TrendPoint[];
  sprintsAvailable?: string[];
  timespentBySprint?: Record<string, TimeSpent>;
  defaultSprint: string;
}

/**
 * Inner shell — lives inside <FilterProvider> so it can drive the controlled
 * <Tabs> from filter context (click-a-KPI jumps here) and compute the live
 * filtered result count for the sticky filter bar.
 */
function DashboardInner({
  effort,
  timespent,
  gamification,
  trend,
  sprintsAvailable,
  timespentBySprint,
  defaultSprint,
}: DashboardData) {
  const { tab, setTab } = useFilters();

  const { filters } = useFilters();

  // The universe the global filter bar operates over = all open epics.
  const openEpics = React.useMemo(
    () => [
      ...effort.sections.pending,
      ...effort.sections.mixed,
      ...effort.sections.no_stories,
    ],
    [effort.sections.pending, effort.sections.mixed, effort.sections.no_stories],
  );
  const openCount = openEpics.length;

  const visibleCount = React.useMemo(
    () => selectEpics(openEpics, filters).length,
    [openEpics, filters],
  );

  return (
    <TooltipProvider delayDuration={200}>
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <div className="-mx-1 overflow-x-auto px-1 pb-1 no-scrollbar">
          <TabsList>
            <TabsTrigger value="effort">
              <LayoutGrid className="size-3.5" />
              Effort
              <Count n={openCount} />
            </TabsTrigger>
            <TabsTrigger value="time">
              <Clock className="size-3.5" />
              Time by Person
            </TabsTrigger>
            <TabsTrigger value="teams">
              <Users className="size-3.5" />
              Teams &amp; Hygiene
            </TabsTrigger>
            <TabsTrigger value="leaderboard">
              <Trophy className="size-3.5" />
              Leaderboard
            </TabsTrigger>
            <TabsTrigger value="trends">
              <TrendingUp className="size-3.5" />
              Trends
            </TabsTrigger>
            <TabsTrigger value="release-schedule">
              <Rocket className="size-3.5" />
              Phase 1 Release Schedule Tracker
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Global filter bar — cross-filters the Effort view. Sticky under the
            tab strip so leads keep it in view while scrolling long sections.
            Hidden on the Release Schedule tab, which is a standalone static
            report the filters have no bearing on. */}
        {tab !== "release-schedule" ? (
          <div className="mt-4">
            <FilterBar
              epics={openEpics}
              totalEpics={openCount}
              visibleEpics={visibleCount}
            />
          </div>
        ) : null}

        <TabsContent value="effort">
          <TabEffort effort={effort} />
        </TabsContent>
        <TabsContent value="time">
          <TabTime
            timespent={timespent}
            sprintsAvailable={sprintsAvailable}
            timespentBySprint={timespentBySprint}
            defaultSprint={defaultSprint}
          />
        </TabsContent>
        <TabsContent value="teams">
          <TabTeams g={gamification} />
        </TabsContent>
        <TabsContent value="leaderboard">
          <TabLeaderboard g={gamification} />
        </TabsContent>
        <TabsContent value="trends">
          <TabTrends trend={trend} />
        </TabsContent>
        <TabsContent value="release-schedule">
          {/* Live report, refreshed 3x/day by the Release Schedule workflow and
              proxied through /api/release-schedule (see that route for why: raw
              GitHub release-asset URLs can't be trusted to render inline).
              Isolated in an iframe so its own styles/scripts never touch this app. */}
          <iframe
            src="/api/release-schedule"
            title="Phase 1 Release Schedule Tracker"
            className="h-[calc(100vh-160px)] w-full rounded-lg border border-border"
          />
        </TabsContent>
      </Tabs>
    </TooltipProvider>
  );
}

/**
 * DashboardTabs assumes it is already rendered inside a <FilterProvider>
 * (supplied by <DashboardShell>) so it shares one filter context with the KPI
 * strip above it.
 */
export function DashboardTabs(props: DashboardData) {
  return <DashboardInner {...props} />;
}
