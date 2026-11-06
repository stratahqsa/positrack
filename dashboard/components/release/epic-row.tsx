"use client";

import * as React from "react";
import { Bug, Check, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtHours, verdictVsQa } from "@/lib/format";
import type { DrillBug, ScheduleStory } from "@/lib/types";
import type { EpicView } from "@/lib/release";
import { Badge } from "@/components/ui/badge";
import { ColumnHeader, GRID_CLASS } from "@/components/release/columns";
import { sortStories, type ReleaseSortState } from "@/lib/release-sort";
import { IssueLink } from "@/components/ui/issue-link";
import { priorityVariant, stateVariant } from "@/components/weekly/badge-tone";

/**
 * Epic-level state badge (Examples_2 §3): DONE/NOT_DONE get a fixed green
 * check / red cross treatment; NO_STORIES is a neutral outline; anything else
 * is the state shared by every unfinished story (T3), colored the same way
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
  return (
    <Badge variant={stateVariant(badge, false)} className="whitespace-normal">
      {badge}
    </Badge>
  );
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
        GRID_CLASS,
        "border-l-2 px-4 py-1.5 text-[12px] transition-colors",
        story.done
          ? "border-good/40 bg-good/[0.04]"
          : isReopen
            ? "border-danger/40 bg-danger/[0.04]"
            : "border-border/50",
      )}
    >
      <span className="flex leading-5">
        {canExpandBugs ? (
          <button
            type="button"
            onClick={onToggleBugs}
            aria-expanded={bugsExpanded}
            aria-label={`${bugsExpanded ? "Collapse" : "Expand"} ${story.bugs.length} pending bug${story.bugs.length === 1 ? "" : "s"} for ${story.storyId}`}
            className="ml-4 inline-flex items-center gap-0.5 rounded px-1 text-danger/90 transition-colors hover:bg-danger/10"
          >
            <Bug className="size-3.5" />
            <span className="tabular text-[11.5px] font-semibold">{story.bugs.length}</span>
            <ChevronRight className={cn("size-3 transition-transform", bugsExpanded && "rotate-90")} />
          </button>
        ) : (
          <span className="ml-5 text-faint">—</span>
        )}
      </span>
      <span className="min-w-0 truncate leading-5">
        <IssueLink id={story.storyId} showIcon={false} />
      </span>
      <span className="min-w-0">
        <Badge variant={stateVariant(story.state, story.done)} size="sm" className="whitespace-normal">
          {story.state || "—"}
        </Badge>
      </span>
      <div className="min-w-0">
        <p className="break-words leading-5 text-fg/75">{story.summary}</p>
        <div className="flex flex-wrap items-center gap-x-2 text-[10.5px] text-faint">
          {story.sprint ? <span>{story.sprint}</span> : null}
          {story.resolved != null ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="text-fg/60">Resolved {fmtDate(story.resolved)}</span>
              {verdict ? (
                <Badge variant={verdict.late ? "danger" : "good"} size="sm">
                  {verdict.label}
                </Badge>
              ) : null}
            </span>
          ) : null}
        </div>
      </div>
      <span className="min-w-0 truncate leading-5 text-muted">{story.assignee || <span className="text-faint">—</span>}</span>
      <Num v={fmtHours(story.devEst)} />
      <Num v={fmtHours(story.uiEst)} />
      <Num v={fmtHours(story.qaEst)} />
      <Num v={fmtHours(story.devEst + story.uiEst + story.qaEst)} bold />
      <Num v={fmtHours(story.spent)} />
      <Num v={fmtDate(story.ddTs)} faint />
      <Num v={fmtDate(story.qaTs)} faint />
    </div>
  );
}

/** Right-aligned numeric/date cell shared by epic and story lines. */
function Num({ v, bold, faint }: { v: string; bold?: boolean; faint?: boolean }) {
  return (
    <span className={cn("tabular text-right text-[12px] leading-5", bold ? "font-semibold text-fg/85" : faint ? "text-faint" : "text-fg/70")}>
      {v}
    </span>
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
  const [storySort, setStorySort] = React.useState<ReleaseSortState>(null);

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
      <div className={cn(GRID_CLASS, "px-4 py-2.5")}>
        {canExpand ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${epic.visibleStories.length} stories for ${epic.id}`}
            title="Pending stories / total stories"
            className="inline-flex items-center gap-0.5 self-start rounded px-0.5 leading-5 text-faint transition-colors hover:bg-elevated/60 hover:text-fg"
          >
            <ChevronRight className={cn("size-4 shrink-0 transition-transform", expanded && "rotate-90")} />
            <span className="tabular text-[12px] font-semibold text-fg/80">
              {epic.pendingCount}/{epic.stories.length}
            </span>
          </button>
        ) : (
          <span className="tabular pl-5 text-[12px] font-semibold leading-5 text-fg/80" title="Pending stories / total stories">
            {epic.pendingCount}/{epic.stories.length}
          </span>
        )}

        <span className="min-w-0 truncate leading-5">
          <IssueLink id={epic.id} />
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-1">
          <EpicBadge badge={epic.badge} />
          {epic.isNew ? (
            <Badge variant="violet" size="sm">
              NEW
            </Badge>
          ) : null}
        </span>

        <div className="min-w-0">
          <p className="break-words text-[13px] leading-5 text-fg/85">{epic.summary}</p>
          {epic.done && epic.resolvedMs != null ? (
            <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
              <span className="text-fg/60">Resolved {fmtDate(epic.resolvedMs)}</span>
              {epic.resolvedVerdict ? (
                <Badge variant={epic.resolvedVerdict.late ? "danger" : "good"} size="sm">
                  {epic.resolvedVerdict.label}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>

        <span className="min-w-0 truncate text-[12px] leading-5 text-muted">
          {epic.assignee || <span className="text-faint">Unassigned</span>}
        </span>

        <Num v={fmtHours(epic.rollup.dev)} />
        <Num v={fmtHours(epic.rollup.ui)} />
        <Num v={fmtHours(epic.rollup.qa)} />
        <Num v={fmtHours(epic.rollup.dev + epic.rollup.ui + epic.rollup.qa)} bold />
        <Num v={fmtHours(epic.rollup.spent)} />
        <Num v={fmtDate(epic.maxDevDeadlineMs)} faint />
        <Num v={fmtDate(epic.maxQaDeadlineMs)} faint />
      </div>

      {expanded ? (
        <>
          <ColumnHeader sort={storySort} onSort={setStorySort} tone="story" />
          {sortStories(epic.visibleStories, storySort).map((story) => (
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
          ))}
        </>
      ) : null}
    </div>
  );
}
