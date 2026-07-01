"use client";

import * as React from "react";
import { ChevronRight, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Epic } from "@/lib/types";
import {
  md,
  fmtDate,
  epicFlags,
  spentPct,
  stateTone,
  isUnowned,
  rollupTotal,
} from "@/lib/format";
import { IssueLink } from "@/components/issue-link";
import { FlagChips } from "@/components/flag-chips";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

/** Assignee cell — highlights the unowned case loudly. */
function Assignee({ name }: { name: string }) {
  if (isUnowned(name)) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-danger/12 px-1.5 py-0.5 text-[11px] font-medium text-danger ring-1 ring-danger/25">
        <User className="size-3" /> unowned
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[12px] text-fg/90">
      <span className="grid size-4 place-items-center rounded-full bg-elevated text-[9px] font-semibold uppercase text-muted ring-1 ring-border-strong">
        {name.trim().charAt(0)}
      </span>
      <span className="max-w-[120px] truncate">{name}</span>
    </span>
  );
}

function NumCell({
  minutes,
  className,
}: {
  minutes: number;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-2 py-2 text-right tabular text-[12.5px]",
        minutes ? "text-fg/90" : "text-faint",
        className,
      )}
    >
      {md(minutes)}
    </td>
  );
}

function StoriesPanel({ epic }: { epic: Epic }) {
  if (!epic.stories.length) {
    return (
      <div className="px-4 py-3 text-[12px] text-faint">
        No stories linked to this epic.
      </div>
    );
  }
  return (
    <div className="overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-faint">
            <th className="py-1.5 pl-11 pr-2 text-left font-medium">Story</th>
            <th className="px-2 py-1.5 text-left font-medium">Summary</th>
            <th className="px-2 py-1.5 text-left font-medium">State</th>
            <th className="px-2 py-1.5 text-left font-medium">Scope</th>
            <th className="px-2 py-1.5 text-left font-medium">Owner</th>
            <th className="px-2 py-1.5 text-right font-medium">Dev</th>
            <th className="px-2 py-1.5 text-right font-medium">UI</th>
            <th className="px-2 py-1.5 text-right font-medium">QA</th>
            <th className="px-3 py-1.5 text-right font-medium">Est</th>
          </tr>
        </thead>
        <tbody>
          {epic.stories.map((s) => {
            const est = rollupTotal(s.est);
            return (
              <tr
                key={s.id}
                className="border-t border-border/50 text-[12px] transition-colors hover:bg-elevated/40"
              >
                <td className="py-1.5 pl-11 pr-2 align-top">
                  <IssueLink id={s.id} showIcon={false} />
                </td>
                <td className="max-w-[320px] px-2 py-1.5 align-top text-fg/80">
                  <span className="line-clamp-2">{s.summary}</span>
                </td>
                <td className="px-2 py-1.5 align-top">
                  <Badge variant={stateTone(s.state)} size="sm">
                    {s.state}
                  </Badge>
                </td>
                <td className="px-2 py-1.5 align-top text-[11px] text-muted">
                  {s.scope}
                </td>
                <td className="px-2 py-1.5 align-top">
                  {isUnowned(s.assignee) ? (
                    <span className="text-[11px] text-danger/80">unowned</span>
                  ) : (
                    <span className="text-[11px] text-fg/80">{s.assignee}</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right tabular text-fg/70">
                  {md(s.est.server)}
                </td>
                <td className="px-2 py-1.5 text-right tabular text-fg/70">
                  {md(s.est.ui)}
                </td>
                <td className="px-2 py-1.5 text-right tabular text-fg/70">
                  {md(s.est.testing)}
                </td>
                <td className="px-3 py-1.5 text-right tabular font-medium text-fg/90">
                  {md(est)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EpicRow({ epic, expandable }: { epic: Epic; expandable: boolean }) {
  const [open, setOpen] = React.useState(false);
  const f = epicFlags(epic);
  const pct = spentPct(epic);
  const canExpand = expandable && epic.stories.length > 0;

  return (
    <>
      <tr
        className={cn(
          "border-t border-border/60 transition-colors",
          canExpand && "cursor-pointer",
          f.overshoot
            ? "amber-rail hover:bg-warn/[0.06]"
            : f.unowned
              ? "red-rail hover:bg-danger/[0.05]"
              : "hover:bg-elevated/40",
        )}
        onClick={canExpand ? () => setOpen((v) => !v) : undefined}
        aria-expanded={canExpand ? open : undefined}
      >
        <td className="py-2 pl-2 pr-1 align-top">
          <div className="flex items-center gap-1">
            {canExpand ? (
              <ChevronRight
                className={cn(
                  "size-3.5 shrink-0 text-faint transition-transform",
                  open && "rotate-90 text-muted",
                )}
              />
            ) : (
              <span className="inline-block size-3.5" />
            )}
            <IssueLink id={epic.id} showIcon={false} />
          </div>
        </td>
        <td className="max-w-[300px] px-2 py-2 align-top">
          <span className="line-clamp-2 text-[12.5px] text-fg/90">
            {epic.summary}
          </span>
          {epic.stories.length ? (
            <span className="mt-0.5 block text-[10.5px] text-faint">
              {epic.stories.length}{" "}
              {epic.stories.length === 1 ? "story" : "stories"}
            </span>
          ) : null}
        </td>
        <td className="px-2 py-2 align-top">
          <Assignee name={epic.assignee} />
        </td>
        <td className="px-2 py-2 align-top text-[11.5px] text-muted whitespace-nowrap">
          {fmtDate(epic.created)}
        </td>
        <NumCell minutes={epic.rollup.server} />
        <NumCell minutes={epic.rollup.ui} />
        <NumCell minutes={epic.rollup.testing} />
        <td className="px-2 py-2 text-right align-top">
          <span className="tabular text-[12.5px] font-semibold text-fg">
            {md(epic.total)}
          </span>
        </td>
        <td className="px-2 py-2 align-top">
          <div className="flex flex-col items-end gap-1">
            <span
              className={cn(
                "tabular text-[12.5px] font-medium",
                f.overshoot ? "text-warn" : epic.spent ? "text-fg/90" : "text-faint",
              )}
            >
              {md(epic.spent)}
            </span>
            {epic.total > 0 || epic.spent > 0 ? (
              <Progress
                value={pct}
                tone={f.overshoot ? "warn" : pct >= 85 ? "info" : "good"}
                className="!h-1"
                trackClassName="!h-1 w-16"
              />
            ) : null}
          </div>
        </td>
        <td className="px-2 py-2 pr-3 align-top">
          <FlagChips epic={epic} />
        </td>
      </tr>
      {canExpand && open ? (
        <tr className="bg-bg/40">
          <td colSpan={10} className="p-0">
            <div className="border-l-2 border-accent/30 bg-surface/30">
              <StoriesPanel epic={epic} />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

/** Full section table with header + epic rows. */
export function EffortTable({
  epics,
  expandable = true,
}: {
  epics: Epic[];
  expandable?: boolean;
}) {
  if (!epics.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface/30 px-4 py-8 text-center text-[12.5px] text-faint">
        No epics in this section.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface/40 scroll-slim">
      <table className="w-full min-w-[880px] border-collapse">
        <thead className="sticky top-0 z-10 bg-surface-2/95 backdrop-blur">
          <tr className="text-[10px] uppercase tracking-wide text-faint">
            <th className="py-2 pl-2 pr-1 text-left font-semibold">Epic</th>
            <th className="px-2 py-2 text-left font-semibold">Summary</th>
            <th className="px-2 py-2 text-left font-semibold">Assignee</th>
            <th className="px-2 py-2 text-left font-semibold">Created</th>
            <th className="px-2 py-2 text-right font-semibold">Dev</th>
            <th className="px-2 py-2 text-right font-semibold">UI</th>
            <th className="px-2 py-2 text-right font-semibold">QA</th>
            <th className="px-2 py-2 text-right font-semibold">Total</th>
            <th className="px-2 py-2 text-right font-semibold">Spent</th>
            <th className="px-2 py-2 pr-3 text-left font-semibold">Flags</th>
          </tr>
        </thead>
        <tbody>
          {epics.map((e) => (
            <EpicRow key={e.id} epic={e} expandable={expandable} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
