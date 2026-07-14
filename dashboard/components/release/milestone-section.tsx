"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MilestoneGroup } from "@/lib/release";
import { fmtHours, fmtMd } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EpicRow } from "@/components/release/epic-row";

/**
 * Urgency -> left-rail/header treatment. The token palette only has one
 * amber (`warn`) and one green (`good`) hue, so the requested
 * "overdue -> red, d3/d7 -> orange/amber, d14 -> amber, far/alldone -> green"
 * gradient is expressed as an intensity ramp within each hue (d3 boldest
 * amber down to d14 faintest) rather than distinct hues — see the Task 2
 * completion notes for the full rationale.
 */
const URGENCY_STYLE: Record<MilestoneGroup["urgency"], { rail: string; header: string; text: string }> = {
  overdue: { rail: "border-l-danger", header: "bg-danger/[0.08] hover:bg-danger/[0.12]", text: "text-danger" },
  d3: { rail: "border-l-warn", header: "bg-warn/[0.10] hover:bg-warn/[0.14]", text: "text-warn" },
  d7: { rail: "border-l-warn/80", header: "bg-warn/[0.07] hover:bg-warn/[0.11]", text: "text-warn/90" },
  d14: { rail: "border-l-warn/50", header: "bg-warn/[0.04] hover:bg-warn/[0.08]", text: "text-warn/70" },
  far: { rail: "border-l-good/50", header: "bg-good/[0.04] hover:bg-good/[0.07]", text: "text-good/80" },
  alldone: { rail: "border-l-good", header: "bg-good/[0.10] hover:bg-good/[0.14]", text: "text-good" },
};

/** `daysFromNow` is `Infinity` for the sentinel "no date" group (never a real
 *  date to be urgent about) -- guarded here rather than in lib/release.ts. */
function urgencyLabel(g: MilestoneGroup): string {
  if (g.urgency === "alldone") return "All done";
  if (!Number.isFinite(g.daysFromNow)) return "No date";
  if (g.daysFromNow === 0) return "Due today";
  if (g.daysFromNow < 0) return `${Math.abs(g.daysFromNow)}d overdue`;
  return `in ${g.daysFromNow}d`;
}

/**
 * One collapsible milestone group (docs/reports-dashboard/plans/
 * 04-release-schedule.md Task 2): the meeting view's top-level grouping,
 * urgency-colored so overdue/at-risk milestones jump out at a glance. Header
 * (always visible) carries the date label, urgency caption/pill, and
 * "N epics · M stories (P pending / D done)"; a totals strip directly below
 * it is ALSO always visible (unlike the epic list, which is what actually
 * collapses) since Dev/UI/QA/Spent per milestone is meeting-relevant even
 * when the group is collapsed.
 */
export function MilestoneSection({ group }: { group: MilestoneGroup }) {
  const [open, setOpen] = React.useState(true);
  const style = URGENCY_STYLE[group.urgency];
  const totalEffort = group.totals.dev + group.totals.ui + group.totals.qa;

  return (
    <Card className={cn("overflow-hidden border-l-4", style.rail)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left transition-colors",
          style.header,
        )}
      >
        <ChevronDown className={cn("size-4 shrink-0 transition-transform", style.text, !open && "-rotate-90")} />
        <span className={cn("text-[14px] font-semibold", style.text)}>{group.label}</span>
        <span className={cn("text-[11.5px] font-medium", style.text)}>{urgencyLabel(group)}</span>
        {group.urgency === "alldone" ? (
          <Badge variant="good" size="sm">
            ALL DONE
          </Badge>
        ) : group.urgency === "overdue" ? (
          <Badge variant="danger" size="sm">
            OVERDUE
          </Badge>
        ) : null}

        <span className="ml-auto text-[12px] text-muted">
          {group.counts.epics} epic{group.counts.epics === 1 ? "" : "s"} · {group.counts.stories} stor
          {group.counts.stories === 1 ? "y" : "ies"} ({group.counts.pending} pending / {group.counts.done} done)
        </span>
      </button>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/40 bg-surface-2/40 px-4 py-1.5 text-[11px] text-faint">
        <span>
          Dev <span className="tabular text-fg/70">{fmtHours(group.totals.dev)}</span>
        </span>
        <span>
          UI <span className="tabular text-fg/70">{fmtHours(group.totals.ui)}</span>
        </span>
        <span>
          QA <span className="tabular text-fg/70">{fmtHours(group.totals.qa)}</span>
        </span>
        <span>
          Spent <span className="tabular text-fg/70">{fmtHours(group.totals.spent)}</span>
        </span>
        <span className="ml-auto">{fmtMd(totalEffort)} total effort</span>
      </div>

      {open ? (
        group.epics.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12px] text-faint">No epics in this milestone.</div>
        ) : (
          <div>
            {group.epics.map((epic) => (
              <EpicRow key={epic.id} epic={epic} />
            ))}
          </div>
        )
      ) : null}
    </Card>
  );
}
