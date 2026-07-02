import * as React from "react";
import { UserX, UserCog, AlertTriangle, FileWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Epic } from "@/lib/types";
import { epicFlags, overspend, overspendLabel } from "@/lib/format";

/**
 * RED flag chips for an epic row. Only renders flags derivable per-epic in the
 * snapshot: needs-owner (blank OR role-parked), overshoot (with magnitude),
 * missing estimate. A role-parked epic reads "needs owner · <role>" so it is
 * transparent it is parked on a placeholder, not truly owned.
 */
export function FlagChips({ epic }: { epic: Epic }) {
  const f = epicFlags(epic);
  if (!f.red) {
    return (
      <span className="text-[11px] text-faint" aria-label="No flags">
        —
      </span>
    );
  }
  const over = overspend(epic);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {f.overshoot ? (
        <Badge variant="warn" title={`Over by ${overspendLabel(over)}`}>
          <AlertTriangle className="size-3" /> +{overspendLabel(over)}
        </Badge>
      ) : null}
      {f.needsOwner ? (
        f.roleOwner ? (
          <Badge
            variant="danger"
            title={`Parked on a role account (${epic.assignee.trim()}) — assign a person`}
          >
            <UserCog className="size-3" /> needs owner ·{" "}
            {epic.assignee.trim()}
          </Badge>
        ) : (
          <Badge variant="danger" title="No assignee">
            <UserX className="size-3" /> unowned
          </Badge>
        )
      ) : null}
      {f.missingEst ? (
        <Badge variant="info" title="No estimate on stories/epic">
          <FileWarning className="size-3" /> no est
        </Badge>
      ) : null}
    </div>
  );
}
