import { cn } from "@/lib/utils";
import type { WatchListItem } from "@/lib/effort";
import { Badge } from "@/components/ui/badge";
import { IssueLink } from "@/components/ui/issue-link";

/**
 * S5 Watch List table (docs/reports-dashboard/plans/06-effort.md Task 2 /
 * PRD_3 "Watch List (S5)"): Epic·Summary·Assignee·P1 Pending·P2 Stories·
 * Action, one row per `watchList(effort)` item. The source badge (S1/S2,
 * Examples_3 §8's own row rendering) rides alongside the epic id in the
 * first cell rather than its own column, to keep the header exactly to the
 * PRD's 6-column list. A plain render from props — no sort/expand here
 * (unlike epic-effort-table.tsx, this table is deliberately simple, per the
 * plan's file-structure split).
 */
export function WatchList({ items }: { items: WatchListItem[] }) {
  if (items.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-[12px] text-faint">
        No Phase 1 epics currently contain Phase 2 stories.
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
            <th className="px-2 py-2 text-right">P2 Stories</th>
            <th className="px-2 py-2 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.epic.id}
              className={cn(
                "border-t border-border/50 text-[12px] transition-colors",
                item.ready ? "bg-good/[0.06] hover:bg-good/[0.1]" : "hover:bg-elevated/40",
              )}
            >
              <td className="whitespace-nowrap px-2 py-2 align-top">
                <div className="flex items-center gap-1.5">
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
                    ✓ Ready to move to P2
                  </Badge>
                ) : (
                  <Badge variant="warn" size="sm">
                    {item.p1_pending} P1 remaining
                  </Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
