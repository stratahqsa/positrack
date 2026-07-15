"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WeekGroup } from "@/lib/weekly";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StoryTable } from "@/components/weekly/story-table";

/**
 * One collapsible week group (docs/reports-dashboard/plans/
 * 03-weekly-deadline-filters.md Task 5): past weeks get a red header, the
 * current week a blue header, with pending/done/bugs count badges. Empty
 * groups still render their header (bucketByWeek always returns a
 * continuous Week 1..current run) so the release timeline stays visible even
 * for weeks nothing landed in yet.
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
  const isPast = !group.isCurrent;

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left transition-colors",
          isPast ? "bg-danger/[0.08] hover:bg-danger/[0.12]" : "bg-info/[0.08] hover:bg-info/[0.12]",
        )}
      >
        <ChevronDown
          className={cn(
            "size-4 shrink-0 transition-transform",
            isPast ? "text-danger/70" : "text-info/70",
            !open && "-rotate-90",
          )}
        />
        <span className={cn("text-[13.5px] font-semibold", isPast ? "text-danger" : "text-info")}>
          {group.label}
        </span>
        {group.isCurrent ? (
          <Badge variant="info" size="sm">
            current
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
