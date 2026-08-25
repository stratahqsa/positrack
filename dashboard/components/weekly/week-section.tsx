"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WeekGroup } from "@/lib/weekly";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StoryTable } from "@/components/weekly/story-table";

type Tone = "past" | "current" | "future";

const TONE_STYLE: Record<Tone, { header: string; chevron: string; label: string }> = {
  past: { header: "bg-danger/[0.08] hover:bg-danger/[0.12]", chevron: "text-danger/70", label: "text-danger" },
  current: { header: "bg-info/[0.08] hover:bg-info/[0.12]", chevron: "text-info/70", label: "text-info" },
  future: { header: "bg-violet/[0.08] hover:bg-violet/[0.12]", chevron: "text-violet/70", label: "text-violet" },
};

/**
 * One collapsible week group (docs/reports-dashboard/plans/
 * 03-weekly-deadline-filters.md Task 5): past weeks get a red header, the
 * current week a blue header, "Looking Ahead" future weeks (lib/weekly.ts's
 * bucketFutureWeeks, 2026-08) a violet header — future weeks aren't
 * "overdue" like a past week, so they deliberately don't share that red
 * styling. Empty groups still render their header for the main Week
 * 1..current timeline (bucketByWeek always returns a continuous run) so the
 * release timeline stays visible even for weeks nothing landed in yet;
 * future-week groups are never passed in empty (bucketFutureWeeks drops
 * them), so that's moot for `isFuture` groups.
 */
export function WeekSection({
  group,
  epicNames,
}: {
  group: WeekGroup;
  epicNames: Record<string, string>;
}) {
  const [open, setOpen] = React.useState(true);

  const pending = group.stories.filter((s) => !s.done).length;
  const done = group.stories.filter((s) => s.done).length;
  const bugs = group.stories.reduce((n, s) => n + s.bugs.length, 0);
  const tone: Tone = group.isFuture ? "future" : group.isCurrent ? "current" : "past";
  const style = TONE_STYLE[tone];

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn("flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left transition-colors", style.header)}
      >
        <ChevronDown className={cn("size-4 shrink-0 transition-transform", style.chevron, !open && "-rotate-90")} />
        <span className={cn("text-[13.5px] font-semibold", style.label)}>{group.label}</span>
        {group.isCurrent ? (
          <Badge variant="info" size="sm">
            current
          </Badge>
        ) : null}
        {group.isFuture ? (
          <Badge variant="violet" size="sm">
            upcoming
          </Badge>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {group.stories.length === 0 ? (
            <Badge variant="outline" size="sm">
              no stories
            </Badge>
          ) : (
            <>
              <Badge variant="warn" size="sm">
                {pending} pending
              </Badge>
              <Badge variant="good" size="sm">
                {done} done
              </Badge>
              {bugs > 0 ? (
                <Badge variant="danger" size="sm">
                  {bugs} bugs
                </Badge>
              ) : null}
            </>
          )}
        </div>
      </button>
      {open ? (
        <div className="border-t border-border/60">
          <StoryTable stories={group.stories} epicNames={epicNames} />
        </div>
      ) : null}
    </Card>
  );
}
