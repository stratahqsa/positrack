"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtHours } from "@/lib/format";
import type { Story } from "@/lib/types";
import type { WatchListItem } from "@/lib/effort";
import { Badge } from "@/components/ui/badge";
import { IssueLink } from "@/components/ui/issue-link";
import { scopeLabel, stateVariant } from "@/components/weekly/badge-tone";

const COLUMN_COUNT = 6;

const DONE_STATE_WORDS = ["done", "fixed", "verified", "closed", "won't fix", "duplicate", "obsolete"];
function isDoneState(state: string | null | undefined): boolean {
  const s = (state ?? "").toLowerCase();
  return DONE_STATE_WORDS.some((word) => s.includes(word));
}

/** One story under an expanded watch-list epic. Unlike epic-effort-table.tsx's
 *  story sub-rows, this table's own columns (P1 Pending / P2/P3 Stories /
 *  Action) are epic-level summary stats with no natural per-story
 *  counterpart, so there's nothing to align a story's own fields under —
 *  this renders as one flowing line instead (same reasoning/pattern as
 *  weekly/story-table.tsx's BugRow). */
function WatchStoryRow({ story }: { story: Story }) {
  const done = isDoneState(story.state);
  const scope = scopeLabel(story.scope);
  return (
    <tr className="border-t border-border/30 bg-elevated/20 text-[11.5px]">
      <td colSpan={COLUMN_COUNT} className="py-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 border-violet/40 py-1.5 pl-8 pr-2">
          <IssueLink id={story.id} showIcon={false} className="text-[11.5px]" />
          <Badge variant={stateVariant(story.state, done)} size="sm">
            {story.state || "—"}
          </Badge>
          {scope ? (
            <Badge variant="violet" size="sm">
              {scope}
            </Badge>
          ) : null}
          <span className="min-w-0 flex-1 truncate text-fg/70">{story.summary}</span>
          <span className="text-muted">{story.assignee || "—"}</span>
          <span className="tabular text-[10.5px] text-faint">
            Dev {fmtHours(story.est.server)} · UI {fmtHours(story.est.ui)} · QA {fmtHours(story.est.testing)}
          </span>
        </div>
      </td>
    </tr>
  );
}

/**
 * S5 Watch List table (docs/reports-dashboard/plans/06-effort.md Task 2 /
 * PRD_3 "Watch List (S5)"): Epic·Summary·Assignee·P1 Pending·P2/P3 Stories·
 * Action, one row per `watchList(effort)` item. The source badge (S1/S2,
 * Examples_3 §8's own row rendering) rides alongside the epic id in the
 * first cell rather than its own column, to keep the header exactly to the
 * PRD's 6-column list.
 *
 * Client component with a per-epic expand toggle (added 2026-07-18, on
 * request — this was "a plain render from props" before). `item.epic.stories`
 * already carries every story the epic has — no new data plumbing needed,
 * this is display-only — so a PM can check exactly which stories under an
 * epic are P1 vs. P2/P3 without leaving this section. No sort here (unlike
 * epic-effort-table.tsx); the watch list is short enough that sorting
 * wasn't asked for and would be over-building.
 */
export function WatchList({ items }: { items: WatchListItem[] }) {
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());

  function toggleExpanded(epicId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(epicId)) next.delete(epicId);
      else next.add(epicId);
      return next;
    });
  }

  if (items.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-[12px] text-faint">
        No Phase 1 epics currently contain Phase 2/3 stories.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto scroll-slim">
      <table className="w-full min-w-[720px] border-collapse">
        <thead className="bg-surface-2/95">
          <tr className="text-[10px] font-semibold uppercase tracking-wide text-faint">
            <th className="px-2 py-2 text-left">Epic</th>
            <th className="px-2 py-2 text-left">Summary</th>
            <th className="px-2 py-2 text-left">Assignee</th>
            <th className="px-2 py-2 text-right">P1 Pending</th>
            <th className="px-2 py-2 text-right">P2/P3 Stories</th>
            <th className="px-2 py-2 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const canExpand = item.epic.stories.length > 0;
            const isExpanded = expanded.has(item.epic.id);
            return (
              <React.Fragment key={item.epic.id}>
                <tr
                  className={cn(
                    "border-t border-border/50 text-[12px] transition-colors",
                    item.ready ? "bg-good/[0.06] hover:bg-good/[0.1]" : "hover:bg-elevated/40",
                  )}
                >
                  <td className="whitespace-nowrap px-2 py-2 align-top">
                    <div className="flex items-center gap-1.5">
                      {canExpand ? (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(item.epic.id)}
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${item.epic.stories.length} stor${item.epic.stories.length === 1 ? "y" : "ies"} for ${item.epic.id}`}
                          className="inline-flex items-center justify-center rounded p-0.5 text-faint transition-colors hover:bg-elevated/60 hover:text-fg"
                        >
                          <ChevronRight className={cn("size-3.5 transition-transform", isExpanded && "rotate-90")} />
                        </button>
                      ) : (
                        <span className="inline-block size-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <IssueLink id={item.epic.id} showIcon={false} />
                      <Badge variant="outline" size="sm">
                        {item.source}
                      </Badge>
                    </div>
                  </td>
                  <td className="max-w-[300px] px-2 py-2 align-top">
                    <span className="line-clamp-2 text-fg/85">{item.epic.summary}</span>
                  </td>
                  <td className="px-2 py-2 align-top text-fg/80">
                    {item.epic.assignee || <span className="text-faint">Unassigned</span>}
                  </td>
                  <td className="px-2 py-2 text-right tabular align-top">{item.p1_pending}</td>
                  <td className="px-2 py-2 text-right tabular align-top">{item.p2_stories}</td>
                  <td className="px-2 py-2 align-top">
                    {item.ready ? (
                      <Badge variant="good" size="sm">
                        ✓ Ready to move
                      </Badge>
                    ) : (
                      <Badge variant="warn" size="sm">
                        {item.p1_pending} P1 remaining
                      </Badge>
                    )}
                  </td>
                </tr>
                {isExpanded && canExpand
                  ? item.epic.stories.map((story) => <WatchStoryRow key={story.id} story={story} />)
                  : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
