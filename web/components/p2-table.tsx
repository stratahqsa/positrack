import * as React from "react";
import { User } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { isUnowned } from "@/lib/format";
import type { P2Item } from "@/lib/types";
import { IssueLink } from "@/components/issue-link";

/** P2-Backlog table: items moved PHASE 1 → PHASE 2 after cutoff. */
export function P2Table({ items }: { items: P2Item[] }) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface/30 px-4 py-8 text-center text-[12.5px] text-faint">
        Nothing was deferred to Phase 2 after the cutoff.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface/40 scroll-slim">
      <table className="w-full min-w-[560px] border-collapse">
        <thead className="bg-surface-2/95">
          <tr className="text-[10px] uppercase tracking-wide text-faint">
            <th className="py-2 pl-3 pr-2 text-left font-semibold">Issue</th>
            <th className="px-2 py-2 text-left font-semibold">Summary</th>
            <th className="px-2 py-2 text-left font-semibold">Assignee</th>
            <th className="px-2 py-2 text-left font-semibold">Created</th>
            <th className="px-3 py-2 text-left font-semibold">Moved to P2</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr
              key={it.id}
              className="border-t border-border/60 transition-colors hover:bg-elevated/40"
            >
              <td className="py-2 pl-3 pr-2 align-top">
                <IssueLink id={it.id} showIcon={false} />
              </td>
              <td className="max-w-[360px] px-2 py-2 align-top text-[12.5px] text-fg/90">
                <span className="line-clamp-2">{it.summary}</span>
              </td>
              <td className="px-2 py-2 align-top">
                {isUnowned(it.assignee) ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-danger/80">
                    <User className="size-3" /> unowned
                  </span>
                ) : (
                  <span className="text-[12px] text-fg/80">{it.assignee}</span>
                )}
              </td>
              <td className="px-2 py-2 align-top text-[11.5px] text-muted whitespace-nowrap">
                {fmtDate(it.created)}
              </td>
              <td className="px-3 py-2 align-top text-[11.5px] text-muted whitespace-nowrap">
                {fmtDate(it.changed_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
