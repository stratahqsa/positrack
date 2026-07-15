import { fmtDateTimeIst } from "@/lib/format";
import type { Bug } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { IssueLink } from "@/components/ui/issue-link";
import { stateVariant } from "@/components/weekly/badge-tone";

/**
 * Reusable bug listing table (docs/reports-dashboard/plans/05-bug-analysis.md
 * Task 2 / PRD_1 §5 §1-§2): ID · Summary · Created (IST, muted) · State ·
 * Assignee · Module · Reporter. Shared by §1's three priority sub-groups and
 * §2's older-open-High list.
 *
 * Sorts its own rows by `created` ascending (PRD_1 §5: "rows sorted by
 * created ascending") — the snapshot's `bugs` block does NOT arrive
 * pre-sorted, so every caller gets the rule for free here instead of
 * repeating the sort at each of the 4 call sites (3 priorities in §1 + §2).
 * A plain server component: no interactivity, so no "use client" needed.
 */
export function BugTable({ rows }: { rows: Bug[] }) {
  if (rows.length === 0) {
    return <div className="px-4 py-4 text-center text-[12px] text-faint">No bugs.</div>;
  }

  const sorted = [...rows].sort((a, b) => a.created - b.created);

  return (
    <div className="overflow-x-auto scroll-slim">
      <table className="w-full min-w-[820px] border-collapse">
        <thead>
          <tr className="border-b border-border/50 text-[10px] font-semibold uppercase tracking-wide text-faint">
            <th className="px-2 py-2 text-left">ID</th>
            <th className="px-2 py-2 text-left">Summary</th>
            <th className="px-2 py-2 text-left">Created</th>
            <th className="px-2 py-2 text-left">State</th>
            <th className="px-2 py-2 text-left">Assignee</th>
            <th className="px-2 py-2 text-left">Module</th>
            <th className="px-2 py-2 text-left">Reporter</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((bug) => (
            <tr key={bug.id} className="border-t border-border/30 text-[12px] transition-colors hover:bg-elevated/40">
              <td className="whitespace-nowrap px-2 py-2 align-top">
                <IssueLink id={bug.id} showIcon={false} />
              </td>
              <td className="max-w-[320px] px-2 py-2 align-top">
                <span className="text-fg/85">{bug.summary}</span>
              </td>
              <td className="whitespace-nowrap px-2 py-2 align-top text-[11px] text-muted">
                {fmtDateTimeIst(bug.created)}
              </td>
              <td className="px-2 py-2 align-top">
                {/* Bugs in this block are always open/unresolved (upstream
                    queries filter #Unresolved — PRD_1 §4 Q1-Q4), so there's
                    no "done" state to consider, same as DrillBug rows in
                    weekly/story-table.tsx. */}
                <Badge variant={stateVariant(bug.state, false)} size="sm">
                  {bug.state || "—"}
                </Badge>
              </td>
              <td className="px-2 py-2 align-top text-fg/80">
                {bug.assignee || <span className="text-faint">—</span>}
              </td>
              <td className="px-2 py-2 align-top text-muted">
                {bug.module || <span className="text-faint">—</span>}
              </td>
              <td className="px-2 py-2 align-top text-muted">
                {bug.reporter || <span className="text-faint">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
