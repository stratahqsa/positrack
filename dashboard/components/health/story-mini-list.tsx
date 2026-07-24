"use client";

import { IssueLink } from "@/components/ui/issue-link";
import { Badge } from "@/components/ui/badge";
import { stateVariant } from "@/components/weekly/badge-tone";
import { fmtDate } from "@/lib/format";
import type { ScheduleStory } from "@/lib/types";

/**
 * Shared drill-down list for Health tile stats backed by a ScheduleStory[]
 * (lib/health.ts's overdueStories() / lateThisWeekStories()) — e.g. "N late
 * this week" on DeadlinesTile, "N overdue" on AccountabilityStrip. One row
 * per story: id, state, summary, assignee, QA deadline. Both call sites
 * decide whether/when this renders (expand toggle); this component is pure
 * presentation (2026-07-24).
 */
export function StoryMiniList({ stories }: { stories: ScheduleStory[] }) {
  if (stories.length === 0) {
    return <p className="px-1 py-2 text-[11px] text-faint">No tickets.</p>;
  }
  return (
    <div className="space-y-1.5">
      {stories.map((s) => (
        <div
          key={s.storyId}
          className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-border/40 bg-surface/40 px-2 py-1.5 text-[11.5px]"
        >
          <IssueLink id={s.storyId} showIcon={false} />
          <Badge variant={stateVariant(s.state, s.done)} size="sm">
            {s.state || "—"}
          </Badge>
          <span className="min-w-[120px] flex-1 truncate text-fg/80">{s.summary}</span>
          <span className="text-faint">{s.assignee || "—"}</span>
          <span className="text-faint">QA {fmtDate(s.qaTs)}</span>
        </div>
      ))}
    </div>
  );
}
