"use client";

import * as React from "react";
import { Trophy, Sparkles, Activity, ShieldCheck, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Gamification, PersonScore } from "@/lib/types";
import { useFilters } from "@/components/filter-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CaveatBanner } from "@/components/caveat-banner";
import { HygieneBars, SignalLegend } from "@/components/hygiene-signals";
import { earnedBadges } from "@/components/badges";

// Podium accents. Light-mode overrides deepen the gradient tint and swap to
// darker medal text so gold/silver/bronze stay legible on white cards.
const RANK_ACCENT = [
  "from-amber-400/20 ring-amber-400/40 text-amber-300 light:from-amber-400/30 light:ring-amber-500/50 light:text-amber-700",
  "from-slate-300/15 ring-slate-300/30 text-slate-200 light:from-slate-400/25 light:ring-slate-400/50 light:text-slate-600",
  "from-orange-500/15 ring-orange-500/30 text-orange-300 light:from-orange-400/25 light:ring-orange-500/50 light:text-orange-700",
];

function scoreTone(score: number): string {
  if (score >= 85) return "text-good";
  if (score >= 65) return "text-accent";
  if (score >= 45) return "text-warn";
  return "text-danger";
}

function PersonCard({
  p,
  onFilter,
}: {
  p: PersonScore;
  onFilter: (person: string) => void;
}) {
  const badges = earnedBadges(p);
  const podium = p.rank <= 3;
  // Rendered as a role="button" div (not a real <button>) because the card
  // contains block-level content (hygiene bars) which is invalid inside a button.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onFilter(p.name)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onFilter(p.name);
        }
      }}
      title={`Filter Effort by ${p.name}`}
      className={cn(
        "group relative w-full cursor-pointer overflow-hidden rounded-lg border bg-surface/50 p-4 text-left transition-all hover:-translate-y-px hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
        podium ? "border-border-strong" : "border-border",
      )}
    >
      {podium ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-60",
            RANK_ACCENT[p.rank - 1],
          )}
        />
      ) : null}
      <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 text-[10px] font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
        <Filter className="size-3" /> filter Effort
      </span>
      <div className="relative flex items-center gap-3">
        <div
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-lg text-sm font-bold ring-1",
            podium
              ? cn("bg-gradient-to-br", RANK_ACCENT[p.rank - 1])
              : "bg-elevated text-muted ring-border-strong",
          )}
        >
          {p.rank}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13.5px] font-semibold text-fg">
              {p.name}
            </span>
            {p.logged_recently ? (
              <span
                className="inline-flex size-1.5 rounded-full bg-good"
                title="Logged recently"
              />
            ) : null}
          </div>
          <div className="text-[11px] text-faint">
            {p.counts.open} open · {p.counts.moved} moved ·{" "}
            {p.counts.unestimated} unestimated · {p.counts.stale} stale
          </div>
        </div>
        <div className="text-right">
          <div
            className={cn(
              "tabular text-2xl font-bold leading-none",
              scoreTone(p.score),
            )}
          >
            {p.score}
          </div>
          <div className="text-[9.5px] uppercase tracking-wide text-faint">
            hygiene
          </div>
        </div>
      </div>

      <div className="relative mt-3">
        <HygieneBars signals={p.signals} compact />
      </div>

      {badges.length ? (
        <div className="relative mt-3 flex flex-wrap gap-1">
          {badges.map((b) => (
            <Badge key={b.key} variant={b.tone} title={b.title}>
              <Sparkles className="size-2.5" />
              {b.label}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TabLeaderboard({ g }: { g: Gamification }) {
  const { applyAndGoToEffort } = useFilters();
  const people = [...g.people].sort((a, b) => a.rank - b.rank);
  const jumpToOwner = (person: string) =>
    applyAndGoToEffort({ owners: [person] });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="size-5 text-warn" />
          <div>
            <h2 className="text-sm font-semibold text-fg">Hygiene leaderboard</h2>
            <p className="text-[11px] text-muted">
              {people.length} people scored · {g.window_days}-day window
            </p>
          </div>
        </div>
        <Badge variant="good" className="w-fit">
          <ShieldCheck className="size-3" />
          Rewards hygiene, not hours
        </Badge>
      </div>

      <CaveatBanner tone="violet" title="How ranking works">
        {g.ranking_basis}.
      </CaveatBanner>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {people.map((p) => (
          <PersonCard key={p.key} p={p} onFilter={jumpToOwner} />
        ))}
      </div>

      <Card>
        <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3">
          <Activity className="size-4 text-accent" />
          <h3 className="text-sm font-semibold text-fg">
            Active loggers this window
          </h3>
          <span className="tabular rounded-md bg-elevated px-1.5 py-0.5 text-[11px] font-semibold text-muted">
            {g.engagement.length}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 px-5 py-4">
          {g.engagement.map((e) => (
            <span
              key={e.key}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/60 py-1 pl-1 pr-2.5 text-[11.5px] text-fg/85"
            >
              <span className="grid size-4 place-items-center rounded-full bg-accent/15 text-[9px] font-semibold uppercase text-accent">
                {e.name.charAt(0)}
              </span>
              {e.name}
            </span>
          ))}
        </div>
        <div className="border-t border-border/60 px-5 py-3">
          <SignalLegend labels={g.signal_labels} />
        </div>
      </Card>
    </div>
  );
}
