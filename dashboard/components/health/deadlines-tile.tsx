"use client";

import * as React from "react";
import { CalendarClock, CircleCheck, CircleAlert, ChevronRight } from "lucide-react";
import { StatTile } from "@/components/health/stat-tile";
import { StoryMiniList } from "@/components/health/story-mini-list";
import { cn } from "@/lib/utils";
import type { ScheduleStory } from "@/lib/types";

/** This week's deadlines — due / done / late (thisWeekDeadlines()). `late`
 *  is clickable when there's a nonzero count: expands to the exact stories
 *  behind it (lateThisWeekStories(), same list length as `late` by
 *  construction) instead of leaving the number unexplained (2026-07-24). */
export function DeadlinesTile({
  due,
  done,
  late,
  lateStories,
}: {
  due: number;
  done: number;
  late: number;
  lateStories: ScheduleStory[];
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <StatTile
      label="This week's deadlines"
      icon={CalendarClock}
      tone={late > 0 ? "danger" : "info"}
      href="/weekly"
      linkLabel="View Weekly Deadline"
    >
      <div className="tabular text-2xl font-bold leading-none text-fg">
        {due}
        <span className="ml-1 text-[12px] font-medium text-muted">due</span>
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-[11.5px]">
        <span className="inline-flex items-center gap-1 text-good">
          <CircleCheck className="size-3.5" />
          {done} done
        </span>
        {late > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 text-danger transition-colors hover:text-danger/80"
          >
            <CircleAlert className="size-3.5" />
            {late} late
            <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} />
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 text-faint">
            <CircleAlert className="size-3.5" />
            {late} late
          </span>
        )}
      </div>
      {open ? (
        <div className="mt-2">
          <StoryMiniList stories={lateStories} />
        </div>
      ) : null}
    </StatTile>
  );
}
