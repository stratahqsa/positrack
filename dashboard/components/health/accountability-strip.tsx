"use client";

import * as React from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import { UserX, CircleAlert, RotateCcw, ArrowRight, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StoryMiniList } from "@/components/health/story-mini-list";
import { EpicMiniList } from "@/components/health/epic-mini-list";
import { cn } from "@/lib/utils";
import type { Epic, ScheduleStory } from "@/lib/types";

type Tone = "danger" | "warn" | "info";

const TONE: Record<Tone, string> = {
  danger: "text-danger",
  warn: "text-warn",
  info: "text-info",
};

function MiniStat({
  label,
  value,
  hint,
  tone,
  icon: Icon,
  expandable,
  open,
  onToggle,
}: {
  label: string;
  value: number;
  hint: string;
  tone: Tone;
  icon: ComponentType<{ className?: string }>;
  expandable?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  const body = (
    <>
      <div className="flex items-center gap-1 tabular text-xl font-bold leading-none text-fg">
        {value}
        {expandable ? (
          <ChevronRight className={cn("size-3.5 text-faint transition-transform", open && "rotate-90")} />
        ) : null}
      </div>
      <div className="mt-1 text-[11.5px] font-medium text-muted">{label}</div>
      <div className="text-[10.5px] text-faint">{hint}</div>
    </>
  );
  return (
    <div className="flex items-start gap-2.5">
      <div
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-elevated ring-1 ring-border-strong",
          TONE[tone],
        )}
      >
        <Icon className="size-4" />
      </div>
      {expandable ? (
        <button type="button" onClick={onToggle} aria-expanded={open} className="text-left">
          {body}
        </button>
      ) : (
        <div>{body}</div>
      )}
    </div>
  );
}

type StatKey = "unowned" | "overdue" | "reopened";

/**
 * Accountability strip. "Needs an owner" uses insights.red_counts.unowned —
 * unowned OPEN EPICS, the real signal — NOT accountability().unowned, which
 * is story-level and ~0 in current data. Overdue/reopened/byPerson come from
 * accountability(snap, now). All three stats are clickable when nonzero:
 * each expands to the exact tickets behind it (lib/health.ts's
 * unownedEpicsList() / overdueStories() / reopenedStories(), same list
 * length as the displayed number by construction) instead of leaving the
 * number to be reverse-engineered. "Overdue" and "Needs an owner" are
 * project-wide counts, so they can include tickets invisible on both Weekly
 * Deadline (stricter dev-deadline+estimate filter) and Release Schedule
 * (epic-matching only) (2026-07-24).
 */
export function AccountabilityStrip({
  unownedEpics,
  unownedEpicsList,
  overdue,
  overdueStoriesList,
  reopened,
  reopenedStoriesList,
  byPerson,
}: {
  unownedEpics: number;
  unownedEpicsList: Epic[];
  overdue: number;
  overdueStoriesList: ScheduleStory[];
  reopened: number;
  reopenedStoriesList: ScheduleStory[];
  byPerson: { name: string; overdue: number; open: number }[];
}) {
  const [expanded, setExpanded] = React.useState<Set<StatKey>>(() => new Set());
  const topOverdue = byPerson.filter((p) => p.overdue > 0).slice(0, 5);

  function toggle(key: StatKey) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-1.5">
          <UserX className="size-4 text-danger" />
          Accountability
        </CardTitle>
        <Link
          href="/schedule"
          className="group inline-flex items-center gap-1 text-[11px] font-medium text-faint transition-colors hover:text-accent"
        >
          View details
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 sm:max-w-lg sm:gap-4">
          <MiniStat
            label="Needs an owner"
            value={unownedEpics}
            hint="open epics"
            tone="danger"
            icon={UserX}
            expandable={unownedEpics > 0}
            open={expanded.has("unowned")}
            onToggle={() => toggle("unowned")}
          />
          <MiniStat
            label="Overdue"
            value={overdue}
            hint="past QA deadline"
            tone="warn"
            icon={CircleAlert}
            expandable={overdue > 0}
            open={expanded.has("overdue")}
            onToggle={() => toggle("overdue")}
          />
          <MiniStat
            label="Re-opened"
            value={reopened}
            hint="stories"
            tone="info"
            icon={RotateCcw}
            expandable={reopened > 0}
            open={expanded.has("reopened")}
            onToggle={() => toggle("reopened")}
          />
        </div>
        {expanded.has("unowned") && unownedEpics > 0 ? (
          <div className="mt-4 border-t border-border/60 pt-3">
            <EpicMiniList epics={unownedEpicsList} />
          </div>
        ) : null}
        {expanded.has("overdue") && overdue > 0 ? (
          <div className="mt-4 border-t border-border/60 pt-3">
            <StoryMiniList stories={overdueStoriesList} />
          </div>
        ) : null}
        {expanded.has("reopened") && reopened > 0 ? (
          <div className="mt-4 border-t border-border/60 pt-3">
            <StoryMiniList stories={reopenedStoriesList} />
          </div>
        ) : null}
        {topOverdue.length > 0 ? (
          <div className="mt-4 border-t border-border/60 pt-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint">
              Top by overdue
            </p>
            <ul className="flex flex-wrap gap-2">
              {topOverdue.map((p) => (
                <li key={p.name}>
                  <Badge variant="warn">
                    {p.name} · {p.overdue} overdue
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
