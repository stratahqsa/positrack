"use client";

import * as React from "react";
import { Bug, Check, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtHours, verdictVsQa } from "@/lib/format";
import type { DrillBug, ScheduleStory } from "@/lib/types";
import type { EpicView } from "@/lib/release";
import { Badge } from "@/components/ui/badge";
import { IssueLink } from "@/components/ui/issue-link";
import { priorityVariant, stateVariant } from "@/components/weekly/badge-tone";

/**
 * Epic-level state badge (Examples_2 §3): DONE/NOT_DONE get a fixed green
 * check / red cross treatment; NO_STORIES is a neutral outline; anything else
 * is the single surviving story's own state text (T3), colored the same way
 * story rows are via `stateVariant` so the vocabulary stays consistent with
 * the Weekly Deadline view.
 */
function EpicBadge({ badge }: { badge: EpicView["badge"] }) {
  if (badge === "DONE") {
    return (
      <Badge variant="good">
        <Check className="size-3" />
        DONE
      </Badge>
    );
  }
  if (badge === "NOT_DONE") {
    return (
      <Badge variant="danger">
        <X className="size-3" />
        NOT DONE
      </Badge>
    );
  }
  if (badge === "NO_STORIES") {
    return <Badge variant="outline">NO STORIES</Badge>;
  }
  return <Badge variant={stateVariant(badge, false)}>{badge}</Badge>;
}

/** 3rd-level row: one open bug surfaced by a RE-OPEN story's drill-down.
 *  Always open (the upstream drill-down keeps open bugs only), so there's no
 *  "done" state to consider — mirrors weekly/story-table.tsx's BugRow. */
function BugDrillRow({ bug }: { bug: DrillBug }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 border-danger/40 bg-danger/[0.03] py-1.5 pl-16 pr-3 text-[11.5px]">
      <Bug className="size-3 shrink-0 text-danger/70" />
      <IssueLink id={bug.bugId} showIcon={false} className="text-[11.5px]" />
      <span className="min-w-0 flex-1 truncate text-fg/70">{bug.summary}</span>
      <Badge variant={stateVariant(bug.state, false)} size="sm">
        {bug.state || "—"}
      </Badge>
      <span className="text-muted">{bug.assignee || "—"}</span>
      <Badge variant={priorityVariant(bug.priority)} size="sm">
        {bug.priority || "—"}
      </Badge>
      <span className="inline-flex items-center gap-1 text-faint">
        dev <IssueLink id={bug.devTicketId} showIcon={false} className="text-[11px]" />
      </span>
    </div>
  );
}

/**
 * 2nd-level row: one of an epic's `visibleStories`. A RE-OPEN story
 * (`!done && state includes "re-open"`) carrying open bugs gets its own 🐛
 * toggle — clicking it reveals `story.bugs` as BugDrillRow's directly below,
 * in the SAME map iteration in EpicRow (see the "keep structurally attached"
 * note there), so the 3rd level can never detach from its story.
 */
function StoryDrillRow({
  story,
  bugsExpanded,
  onToggleBugs,
}: {
  story: ScheduleStory;
  bugsExpanded: boolean;
  onToggleBugs: () => void;
}) {
  const isReopen = !story.done && (story.state ?? "").toLowerCase().includes("re-open");
  const canExpandBugs = isReopen && story.bugs.length > 0;
  const verdict = verdictVsQa(story.resolved, story.qaTs);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 py-1.5 pl-10 pr-3 text-[12px] transition-colors",
        story.done
          ? "border-good/40 bg-good/[0.04]"
          : isReopen
            ? "border-danger/40 bg-danger/[0.04]"
            : "border-border/50",
      )}
    >
      {canExpandBugs ? (
        <button
          type="button"
          onClick={onToggleBugs}
          aria-expanded={bugsExpanded}
          aria-label={`${bugsExpanded ? "Collapse" : "Expand"} ${story.bugs.length} open bug${story.bugs.length === 1 ? "" : "s"} for ${story.storyId}`}
          className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-danger/90 transition-colors hover:bg-danger/10"
        >
          <Bug className="size-3.5" />
          <span className="tabular text-[10.5px] font-semibold">{story.bugs.length}</span>
          <ChevronRight className={cn("size-3 transition-transform", bugsExpanded && "rotate-90")} />
        </button>
      ) : null}

      <IssueLink id={story.storyId} showIcon={false} />
      <Badge variant={stateVariant(story.state, story.done)} size="sm">
        {story.state || "—"}
      </Badge>
      <span className="min-w-[140px] max-w-[360px] flex-1 truncate text-fg/75">{story.summary}</span>
      <span className="text-muted">{story.assignee || <span className="text-faint">—</span>}</span>
      <span className="text-faint">{story.sprint || "—"}</span>
      <span className="tabular text-[11px] text-faint">
        Dev {fmtHours(story.devEst)} · UI {fmtHours(story.uiEst)} · QA {fmtHours(story.qaEst)} · Spent{" "}
        {fmtHours(story.spent)}
      </span>
      <span className="text-faint">DD {fmtDate(story.ddTs)}</span>
      <span className="text-faint">QA {fmtDate(story.qaTs)}</span>
      {story.resolved != null ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-fg/70">Resolved {fmtDate(story.resolved)}</span>
          {verdict ? (
            <Badge variant={verdict.late ? "danger" : "good"} size="sm">
              {verdict.label}
            </Badge>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Epic row — the 3-level drill-down's outer level (docs/reports-dashboard/
 * plans/04-release-schedule.md Task 2). ONE `<EpicRow>` per epic, owning its
 * own local state:
 *  - `expanded` (boolean): shows/hides `epic.visibleStories` (level 2).
 *  - `expandedStories` (Set<storyId>): which RE-OPEN stories have their bug
 *    list open (level 3).
 *
 * Architecture mirrors weekly/story-table.tsx's StoryTable: `visibleStories`
 * is mapped ONCE, and a story's bug rows render immediately after it in that
 * same map (via a keyed React.Fragment) when its id is in `expandedStories` —
 * there is no parallel/separate bug-row list to keep in sync, so the 3rd
 * level can never structurally detach from its story.
 */
export function EpicRow({ epic }: { epic: EpicView }) {
  const [expanded, setExpanded] = React.useState(false);
  const [expandedStories, setExpandedStories] = React.useState<Set<string>>(() => new Set());

  function toggleStoryBugs(storyId: string) {
    setExpandedStories((prev) => {
      const next = new Set(prev);
      if (next.has(storyId)) next.delete(storyId);
      else next.add(storyId);
      return next;
    });
  }

  const canExpand = epic.visibleStories.length > 0;

  return (
    <div
      className={cn(
        "border-t border-border/50 first:border-t-0",
        epic.done ? "bg-good/[0.05]" : epic.badge === "NOT_DONE" ? "bg-danger/[0.05]" : "",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
        {canExpand ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${epic.visibleStories.length} stories for ${epic.id}`}
            className="inline-flex shrink-0 items-center justify-center rounded p-0.5 text-faint transition-colors hover:bg-elevated/60 hover:text-fg"
          >
            <ChevronRight className={cn("size-4 transition-transform", expanded && "rotate-90")} />
          </button>
        ) : (
          <span className="inline-block size-4 shrink-0" aria-hidden="true" />
        )}

        <IssueLink id={epic.id} />
        <EpicBadge badge={epic.badge} />
        {epic.isNew ? (
          <Badge variant="violet" size="sm">
            NEW
          </Badge>
        ) : null}

        <span className="min-w-[160px] max-w-[420px] flex-1 truncate text-[13px] text-fg/85">{epic.summary}</span>

        <span className="text-[12px] text-muted">
          {epic.assignee || <span className="text-faint">Unassigned</span>}
        </span>

        <span className="tabular text-[11.5px] text-faint">
          Dev {fmtHours(epic.rollup.dev)} · UI {fmtHours(epic.rollup.ui)} · QA {fmtHours(epic.rollup.qa)} · Spent{" "}
          {fmtHours(epic.rollup.spent)}
        </span>

        {epic.done && epic.resolvedMs != null ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-[11.5px] text-fg/70">Resolved {fmtDate(epic.resolvedMs)}</span>
            {epic.resolvedVerdict ? (
              <Badge variant={epic.resolvedVerdict.late ? "danger" : "good"} size="sm">
                {epic.resolvedVerdict.label}
              </Badge>
            ) : null}
          </span>
        ) : null}

        <span className="ml-auto shrink-0 text-[11px] text-faint">
          {epic.visibleStories.length}/{epic.stories.length} stories
        </span>
      </div>

      {expanded
        ? epic.visibleStories.map((story) => (
            <React.Fragment key={story.storyId}>
              <StoryDrillRow
                story={story}
                bugsExpanded={expandedStories.has(story.storyId)}
                onToggleBugs={() => toggleStoryBugs(story.storyId)}
              />
              {expandedStories.has(story.storyId)
                ? story.bugs.map((bug) => <BugDrillRow key={bug.bugId} bug={bug} />)
                : null}
            </React.Fragment>
          ))
        : null}
    </div>
  );
}
