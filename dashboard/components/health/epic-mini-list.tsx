"use client";

import { IssueLink } from "@/components/ui/issue-link";
import { Badge } from "@/components/ui/badge";
import { fmtHours } from "@/lib/format";
import type { Epic } from "@/lib/types";

/**
 * Epic-level counterpart to StoryMiniList — drill-down for Health tile stats
 * backed by Epic[] (lib/health.ts's unownedEpicsList() / overshootingEpics()
 * / redEpics()). `reasonsById`, when supplied, tags each epic with which RED
 * category/categories it matched (redEpics() only — the single-criterion
 * lists don't need it, every row would repeat the same tag) (2026-07-24).
 * `showOvershoot`, when true (EffortTile's "N overshooting" list only — not
 * the mixed-reason "N total RED" list), adds Total Est / Total Spent /
 * Overspent, reading `overshoot_spent` (the Phase-1 pending-or-recent figure
 * the overshoot flag actually compares against `total`), not the
 * whole-epic-lifetime `spent` (2026-07-25).
 */
export function EpicMiniList({
  epics,
  reasonsById,
  showOvershoot,
}: {
  epics: Epic[];
  reasonsById?: Map<string, string[]>;
  showOvershoot?: boolean;
}) {
  if (epics.length === 0) {
    return <p className="px-1 py-2 text-[11px] text-faint">No epics.</p>;
  }
  return (
    <div className="space-y-1.5">
      {epics.map((e) => {
        const spent = e.overshoot_spent ?? e.spent;
        return (
          <div
            key={e.id}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-border/40 bg-surface/40 px-2 py-1.5 text-[11.5px]"
          >
            <IssueLink id={e.id} showIcon={false} />
            <span className="min-w-[120px] flex-1 truncate text-fg/80">{e.summary}</span>
            <span className="text-faint">{e.assignee || "—"}</span>
            {showOvershoot ? (
              <span className="tabular flex items-center gap-2 text-faint">
                <span>Est {fmtHours(e.total)}</span>
                <span>Spent {fmtHours(spent)}</span>
                <span className="text-danger">+{fmtHours(spent - e.total)} over</span>
              </span>
            ) : null}
            {(reasonsById?.get(e.id) ?? []).map((r) => (
              <Badge key={r} variant="warn" size="sm">
                {r}
              </Badge>
            ))}
          </div>
        );
      })}
    </div>
  );
}
