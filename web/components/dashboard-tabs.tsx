"use client";

import * as React from "react";
import {
  LayoutGrid,
  Clock,
  Users,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import type {
  Effort,
  TimeSpent,
  Gamification,
  TrendPoint,
} from "@/lib/types";
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

export function DashboardTabs({
  effort,
  timespent,
  gamification,
  trend,
}: {
  effort: Effort;
  timespent: TimeSpent;
  gamification: Gamification;
  trend: TrendPoint[];
}) {
  const openCount =
    effort.counts.pending + effort.counts.mixed + effort.counts.no_stories;

  return (
    <TooltipProvider delayDuration={200}>
      <Tabs defaultValue="effort" className="w-full">
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
          </TabsList>
        </div>

        <TabsContent value="effort">
          <TabEffort effort={effort} />
        </TabsContent>
        <TabsContent value="time">
          <TabTime timespent={timespent} />
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
      </Tabs>
    </TooltipProvider>
  );
}
