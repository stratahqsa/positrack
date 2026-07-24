"use client";

import * as React from "react";
import { Timer, AlertTriangle, ChevronRight } from "lucide-react";
import { StatTile } from "@/components/health/stat-tile";
import { EpicMiniList } from "@/components/health/epic-mini-list";
import { cn } from "@/lib/utils";
import type { Epic } from "@/lib/types";
import type { RedEpic } from "@/lib/health";

type Expanded = "red" | "overshoot" | null;

/**
 * Remaining effort — man-days + hours open (remainingEffort()), with RED
 * context from insights.red_counts (total_red, overshoot) so the raw
 * man-days figure isn't read in isolation from the epics driving it. Both
 * "N total RED" and "N overshooting" are clickable when nonzero: expand to
 * the exact epics behind each (lib/health.ts's redEpics() /
 * overshootingEpics()) instead of leaving the number unexplained
 * (2026-07-24). `totalRed` can exceed redEpicsList.length when an epic
 * matches more than one RED reason — see redEpics()'s own doc comment; each
 * row there is tagged with every reason it matched, so that's still visible.
 */
export function EffortTile({
  manDays,
  hours,
  totalRed,
  overshoot,
  redEpicsList,
  overshootingEpicsList,
}: {
  manDays: number;
  hours: number;
  totalRed: number;
  overshoot: number;
  redEpicsList: RedEpic[];
  overshootingEpicsList: Epic[];
}) {
  const [expanded, setExpanded] = React.useState<Expanded>(null);
  const reasonsById = new Map(redEpicsList.map((r) => [r.epic.id, r.reasons]));

  return (
    <StatTile label="Remaining effort" icon={Timer} tone="violet" href="/effort" linkLabel="View Effort">
      <div className="tabular text-2xl font-bold leading-none text-fg">
        {manDays.toFixed(1)}
        <span className="ml-1 text-[12px] font-medium text-muted">md</span>
      </div>
      <p className="tabular mt-1 text-[11px] text-faint">
        {Math.round(hours).toLocaleString()}h open
      </p>
      {totalRed > 0 ? (
        <p className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[11px] text-warn">
          <AlertTriangle className="size-3 shrink-0" />
          <button
            type="button"
            onClick={() => setExpanded((v) => (v === "red" ? null : "red"))}
            aria-expanded={expanded === "red"}
            className="inline-flex items-center gap-0.5 hover:text-warn/80"
          >
            {totalRed} total RED
            <ChevronRight className={cn("size-3 transition-transform", expanded === "red" && "rotate-90")} />
          </button>
          {overshoot > 0 ? (
            <>
              <span>·</span>
              <button
                type="button"
                onClick={() => setExpanded((v) => (v === "overshoot" ? null : "overshoot"))}
                aria-expanded={expanded === "overshoot"}
                className="inline-flex items-center gap-0.5 hover:text-warn/80"
              >
                {overshoot} overshooting
                <ChevronRight
                  className={cn("size-3 transition-transform", expanded === "overshoot" && "rotate-90")}
                />
              </button>
            </>
          ) : null}
        </p>
      ) : null}
      {expanded === "red" ? (
        <div className="mt-2">
          <EpicMiniList epics={redEpicsList.map((r) => r.epic)} reasonsById={reasonsById} />
        </div>
      ) : null}
      {expanded === "overshoot" ? (
        <div className="mt-2">
          <EpicMiniList epics={overshootingEpicsList} />
        </div>
      ) : null}
    </StatTile>
  );
}
