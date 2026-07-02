"use client";

import * as React from "react";
import { UserX, UserCog, AlertTriangle, FileWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Epic } from "@/lib/types";
import type { RedFilter } from "@/lib/filter";
import { epicFlags, overspend, overspendLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * RED flag chips for an epic row. Only renders flags derivable per-epic in the
 * snapshot: needs-owner (blank OR role-parked), overshoot (with magnitude),
 * missing estimate. A role-parked epic reads "needs owner · <role>" so it is
 * transparent it is parked on a placeholder, not truly owned.
 *
 * When `onFilter` is provided each chip becomes a button that drives the
 * matching RED filter (click-anything-to-filter). Chips stop click propagation
 * so filtering a flag never also toggles the row's expand.
 */
export function FlagChips({
  epic,
  onFilter,
  activeRed,
}: {
  epic: Epic;
  onFilter?: (red: RedFilter) => void;
  activeRed?: RedFilter[];
}) {
  const f = epicFlags(epic);
  if (!f.red) {
    return (
      <span className="text-[11px] text-faint" aria-label="No flags">
        —
      </span>
    );
  }
  const over = overspend(epic);
  const interactive = !!onFilter;

  const wrap = (red: RedFilter, node: React.ReactElement) => {
    if (!interactive) return node;
    const isActive = activeRed?.includes(red);
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onFilter!(red);
        }}
        aria-pressed={isActive}
        title={`Filter Effort by ${red.replace("-", " ")}`}
        className={cn(
          "rounded-md transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
          isActive && "ring-2 ring-accent/60",
        )}
      >
        {node}
      </button>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {f.overshoot
        ? wrap(
            "overshoot",
            <Badge variant="warn" title={`Over by ${overspendLabel(over)}`}>
              <AlertTriangle className="size-3" /> +{overspendLabel(over)}
            </Badge>,
          )
        : null}
      {f.needsOwner
        ? f.roleOwner
          ? wrap(
              "needs-owner",
              <Badge
                variant="danger"
                title={`Parked on a role account (${epic.assignee.trim()}) — assign a person`}
              >
                <UserCog className="size-3" /> needs owner · {epic.assignee.trim()}
              </Badge>,
            )
          : wrap(
              "needs-owner",
              <Badge variant="danger" title="No assignee">
                <UserX className="size-3" /> unowned
              </Badge>,
            )
        : null}
      {f.missingEst
        ? wrap(
            "unestimated",
            <Badge variant="info" title="No estimate on stories/epic">
              <FileWarning className="size-3" /> no est
            </Badge>,
          )
        : null}
    </div>
  );
}
