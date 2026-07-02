import * as React from "react";
import type { Effort } from "@/lib/types";
import { md, mdUnit } from "@/lib/format";
import { SectionShell } from "@/components/section-shell";
import { EffortTable } from "@/components/effort-table";
import { P2Table } from "@/components/p2-table";
import { Worklist } from "@/components/worklist";

function sectionCaption(
  total: { server: number; ui: number; testing: number; total: number; spent: number },
): string {
  if (!total.total && !total.spent) return "";
  return `${mdUnit(total.total)} est · ${mdUnit(total.spent)} spent`;
}

export function TabEffort({ effort }: { effort: Effort }) {
  const s = effort.sections;
  const t = effort.totals;

  // Worklist scope = all open epics (pending + mixed + no-stories).
  const openEpics = React.useMemo(
    () => [...s.pending, ...s.mixed, ...s.no_stories],
    [s.pending, s.mixed, s.no_stories],
  );

  return (
    <div className="space-y-4">
      <Worklist epics={openEpics} />

      <SectionShell
        title="Pending"
        count={s.pending.length}
        tone="info"
        caption={sectionCaption(t.pending)}
        defaultOpen
      >
        <EffortTable epics={s.pending} />
      </SectionShell>

      <SectionShell
        title="Mixed (some stories done)"
        count={s.mixed.length}
        tone="violet"
        caption={sectionCaption(t.mixed)}
        defaultOpen
      >
        <EffortTable epics={s.mixed} />
      </SectionShell>

      <SectionShell
        title="No stories"
        count={s.no_stories.length}
        tone="warn"
        caption="epics without linked stories — needs breakdown"
        defaultOpen={false}
      >
        <EffortTable epics={s.no_stories} />
      </SectionShell>

      <SectionShell
        title="Done since cutoff"
        count={s.done.length}
        tone="good"
        caption={`${mdUnit(t.done.spent)} spent`}
        defaultOpen={false}
      >
        <EffortTable epics={s.done} />
      </SectionShell>

      <SectionShell
        title="P2 backlog (moved to Phase 2)"
        count={s.p2_backlog.length}
        tone="muted"
        caption="deferred after cutoff"
        defaultOpen={false}
      >
        <P2Table items={s.p2_backlog} />
      </SectionShell>

      <p className="px-1 text-[11px] leading-relaxed text-faint">
        Grand total (Pending + Mixed + No-stories):{" "}
        <span className="font-medium text-muted">
          {md(t.grand_total.total)} man-days estimated
        </span>{" "}
        · Dev {md(t.grand_total.server)} · UI {md(t.grand_total.ui)} · QA{" "}
        {md(t.grand_total.testing)} · Spent{" "}
        <span className="font-medium text-muted">
          {md(t.grand_total.spent)}
        </span>
        . All figures in man-days (worklog minutes ÷ 480).
      </p>
    </div>
  );
}
