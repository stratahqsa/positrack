"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtHours } from "@/lib/format";
import type { P2Item, Story } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { IssueLink } from "@/components/ui/issue-link";
import { scopeLabel, stateVariant } from "@/components/weekly/badge-tone";

const COLUMN_COUNT = 4;

/** One PENDING story under an expanded P2/P3 backlog epic (the `stories`
 *  field already carries pending-only, per core/ytcore.py — nothing to
 *  filter here). Same rendering approach as watch-list.tsx's WatchStoryRow:
 *  every story gets an explicit phase badge (P1/P2/P3, `scopeLabel`
 *  defaulting to "P1"), rendered as one flowing line since this table's own
 *  columns (Assignee/Created) don't map cleanly onto per-story fields. */
function BacklogStoryRow({ story }: { story: Story }) {
  const done = false; // this array is pending-only upstream
  const phase = scopeLabel(story.scope) ?? "P1";
  return (
    <tr className="border-t border-border/30 bg-elevated/20 text-[11.5px]">
      <td colSpan={COLUMN_COUNT} className="py-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 border-violet/40 py-1.5 pl-8 pr-2">
          <IssueLink id={story.id} showIcon={false} className="text-[11.5px]" />
          <Badge variant={stateVariant(story.state, done)} size="sm">
            {story.state || "—"}
          </Badge>
          <Badge variant={phase === "P1" ? "outline" : "violet"} size="sm">
            {phase}
          </Badge>
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
 * P2/P3 Backlog table (Effort Report §4 — epics whose Scope was PHASE 1 at
 * the 29 Jun cutoff and has since moved to PHASE 2 or PHASE 3; see
 * core/ytcore.py's `_scope_at_or_before` for the eligibility rule).
 * Epic·Summary(+phase/date)·Assignee·Created, one row per item, with a
 * per-epic expand toggle (2026-07-18, on request, mirroring watch-list.tsx)
 * to show the epic's own pending stories — each phase-labeled — without
 * leaving this section.
 */
export function P2Backlog({ items }: { items: P2Item[] }) {
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
        No epics currently in the P2/P3 backlog.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto scroll-slim">
      <table className="w-full min-w-[560px] border-collapse">
        <thead className="bg-surface-2/95">
          <tr className="text-[10px] font-semibold uppercase tracking-wide text-faint">
            <th className="px-2 py-2 text-left">Epic</th>
            <th className="px-2 py-2 text-left">Summary</th>
            <th className="px-2 py-2 text-left">Assignee</th>
            <th className="px-2 py-2 text-left">Created</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const stories = item.stories ?? [];
            const canExpand = stories.length > 0;
            const isExpanded = expanded.has(item.id);
            return (
              <React.Fragment key={item.id}>
                <tr className="border-t border-border/50 text-[12px] hover:bg-elevated/40">
                  <td className="whitespace-nowrap px-2 py-2 align-top">
                    <div className="flex items-center gap-1.5">
                      {canExpand ? (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(item.id)}
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${stories.length} pending stor${stories.length === 1 ? "y" : "ies"} for ${item.id}`}
                          className="inline-flex items-center justify-center rounded p-0.5 text-faint transition-colors hover:bg-elevated/60 hover:text-fg"
                        >
                          <ChevronRight className={cn("size-3.5 transition-transform", isExpanded && "rotate-90")} />
                        </button>
                      ) : (
                        <span className="inline-block size-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <IssueLink id={item.id} showIcon={false} />
                    </div>
                  </td>
                  <td className="max-w-[320px] px-2 py-2 align-top">
                    <span className="line-clamp-2 text-fg/85">{item.summary}</span>
                    <div className="mt-0.5 text-[10.5px] text-violet/80">
                      → {scopeLabel(item.phase) ?? "P2"} on {fmtDate(item.changed_at)}
                    </div>
                  </td>
                  <td className="px-2 py-2 align-top text-fg/80">
                    {item.assignee || <span className="text-faint">Unassigned</span>}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 align-top text-muted">{fmtDate(item.created)}</td>
                </tr>
                {isExpanded && canExpand
                  ? stories.map((story) => <BacklogStoryRow key={story.id} story={story} />)
                  : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
