"use client";

import * as React from "react";
import type { AndroidBlock } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/bugs/section";
import { AndroidKpi } from "@/components/android/android-kpi";
import { AndroidBugBreakdown } from "@/components/android/android-bug-breakdown";
import { StoryTable } from "@/components/weekly/story-table";
import { pendingBugStateBreakdown } from "@/lib/android-bugs";
import { cn } from "@/lib/utils";

/**
 * Android Status Report page body: KPI strip + a Done-stories toggle (hidden
 * by default -- same "show active work first" default the skill's own
 * report used) driving the one story table, plus a project-wide "Pending
 * Bugs by State" bar breakdown BELOW the per-story table -- aggregated
 * across every story's bugs regardless of story done/open state, since it's
 * answering "what shape is the open Android bug backlog in", not tied to
 * any one story. `StoryTable` is reused verbatim from Weekly Deadline --
 * Android's story shape is `ScheduleStory` already (scripts/reports/
 * android.py reuses schedule.py's parse_story()), and every row shares the
 * same one epic (PXB1-3295), so `epicNames` is a single-entry map built
 * from the block's own `epicId`/`epicName`.
 */
export function AndroidView({ block, tz }: { block: AndroidBlock; tz: string }) {
  const [showDone, setShowDone] = React.useState(false);

  const epicNames = React.useMemo(
    () => ({ [block.epicId]: block.epicName }),
    [block.epicId, block.epicName],
  );

  const visible = React.useMemo(
    () => (showDone ? block.stories : block.stories.filter((s) => !s.done)),
    [block.stories, showDone],
  );

  const pendingBugs = React.useMemo(
    () => block.stories.flatMap((s) => s.bugs).filter((b) => !b.done),
    [block.stories],
  );
  const pendingByState = React.useMemo(() => pendingBugStateBreakdown(pendingBugs), [pendingBugs]);

  return (
    <div className="space-y-5">
      <AndroidKpi kpi={block.kpi} />

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            aria-pressed={showDone}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors",
              showDone ? "bg-accent/12 text-accent ring-1 ring-accent/30" : "text-muted hover:bg-elevated/60 hover:text-fg",
            )}
          >
            {showDone ? "Showing Done stories" : "Hiding Done stories"}
          </button>
          <span className="tabular ml-auto text-[11.5px] text-faint">
            {visible.length} of {block.stories.length} stories
          </span>
        </div>
      </Card>

      <Section title={block.epicName} tone="violet" count={visible.length}>
        <StoryTable
          stories={visible}
          epicNames={epicNames}
          showCreated
          defaultSort={{ key: "created", dir: "asc" }}
        />
      </Section>

      <Section title="Pending Bugs by State" tone="danger" count={pendingBugs.length}>
        <AndroidBugBreakdown rows={pendingByState} bugs={pendingBugs} tz={tz} />
      </Section>
    </div>
  );
}
