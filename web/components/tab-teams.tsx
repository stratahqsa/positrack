"use client";

import * as React from "react";
import { Users, TriangleAlert, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Gamification, PersonScore } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CaveatBanner } from "@/components/caveat-banner";
import { HygieneBars, SignalLegend } from "@/components/hygiene-signals";

function scoreTone(score: number): string {
  if (score >= 85) return "text-good";
  if (score >= 65) return "text-accent";
  if (score >= 45) return "text-warn";
  return "text-danger";
}

function TeamCard({
  team,
  labels,
}: {
  team: Gamification["teams"][number];
  labels: Record<string, string>;
}) {
  const label = team.key === "All" ? "Whole team" : team.key;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border/60 bg-gradient-to-r from-accent/[0.05] to-transparent px-5 py-3.5">
        <div className="grid size-9 place-items-center rounded-lg bg-accent/12 ring-1 ring-accent/25">
          <Users className="size-4.5 text-accent" />
        </div>
        <div className="flex-1">
          <div className="text-[13.5px] font-semibold text-fg">{label}</div>
          <div className="text-[11px] text-muted">
            {team.members_scored} of {team.members.length} members scored
          </div>
        </div>
        <div className="text-right">
          <div
            className={cn(
              "tabular text-3xl font-bold leading-none",
              scoreTone(team.score),
            )}
          >
            {team.score}
          </div>
          <div className="text-[9.5px] uppercase tracking-wide text-faint">
            hygiene
          </div>
        </div>
      </div>
      <div className="px-5 py-4">
        <HygieneBars signals={team.signals} labels={labels} />
      </div>
    </Card>
  );
}

/** Per-person hygiene mini-row (owners only add signal here). */
function PersonHygieneRow({ p }: { p: PersonScore }) {
  return (
    <tr className="border-t border-border/50 transition-colors hover:bg-elevated/40">
      <td className="py-2.5 pl-4 pr-2">
        <div className="text-[12.5px] font-medium text-fg/90">{p.name}</div>
        <div className="text-[10.5px] text-faint">
          {p.counts.open} open · {p.counts.stale} stale ·{" "}
          {p.counts.unestimated} unestimated
        </div>
      </td>
      <td className="px-2 py-2.5">
        <div className="min-w-[220px]">
          <HygieneBars signals={p.signals} compact />
        </div>
      </td>
      <td className="px-4 py-2.5 text-right">
        <span className={cn("tabular text-base font-bold", scoreTone(p.score))}>
          {p.score}
        </span>
      </td>
    </tr>
  );
}

export function TabTeams({ g }: { g: Gamification }) {
  const [showAll, setShowAll] = React.useState(false);
  const people = [...g.people].sort((a, b) => b.score - a.score);
  const shown = showAll ? people : people.slice(0, 10);
  const gap = g.owner_gap;
  const coverage =
    gap.open_epics > 0
      ? Math.round(
          ((gap.open_epics - gap.unowned_epics) / gap.open_epics) * 100,
        )
      : 0;

  return (
    <div className="space-y-4">
      {/* Owner-gap honesty banner */}
      <Card className="border-warn/25">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-2.5">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warn" />
            <div>
              <h2 className="text-[13.5px] font-semibold text-fg">
                Owner coverage gap
              </h2>
              <p className="mt-0.5 max-w-2xl text-[12px] leading-relaxed text-muted">
                {gap.note}
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-4 sm:pl-4">
            <div className="text-center">
              <div className="tabular text-2xl font-bold text-danger">
                {gap.unowned_epics}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-faint">
                unowned
              </div>
            </div>
            <div className="text-center">
              <div className="tabular text-2xl font-bold text-fg">
                {gap.open_epics}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-faint">
                open epics
              </div>
            </div>
            <div className="hidden text-center sm:block">
              <div
                className={cn(
                  "tabular text-2xl font-bold",
                  coverage > 0 ? "text-good" : "text-warn",
                )}
              >
                {coverage}%
              </div>
              <div className="text-[10px] uppercase tracking-wide text-faint">
                covered
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {g.teams.map((t) => (
          <TeamCard key={t.key} team={t} labels={g.signal_labels} />
        ))}
      </div>

      <Card>
        <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3">
          <Users className="size-4 text-accent" />
          <h3 className="text-sm font-semibold text-fg">Per-person hygiene</h3>
          <span className="hidden text-[11px] text-faint sm:inline">
            covers people who own work
          </span>
        </div>
        <div className="overflow-x-auto scroll-slim">
          <table className="w-full min-w-[520px] border-collapse">
            <thead className="bg-surface-2/95">
              <tr className="text-[10px] uppercase tracking-wide text-faint">
                <th className="py-2 pl-4 pr-2 text-left font-semibold">
                  Person
                </th>
                <th className="px-2 py-2 text-left font-semibold">Signals</th>
                <th className="px-4 py-2 text-right font-semibold">Score</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <PersonHygieneRow key={p.key} p={p} />
              ))}
            </tbody>
          </table>
        </div>
        {people.length > 10 ? (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="flex w-full items-center justify-center gap-1.5 border-t border-border/60 py-2.5 text-[12px] font-medium text-muted transition-colors hover:bg-elevated/30 hover:text-fg"
          >
            {showAll ? "Show top 10" : `Show all ${people.length}`}
            <ChevronDown
              className={cn("size-3.5 transition-transform", showAll && "rotate-180")}
            />
          </button>
        ) : null}
        <div className="border-t border-border/60 px-5 py-3">
          <SignalLegend labels={g.signal_labels} />
        </div>
      </Card>
    </div>
  );
}
