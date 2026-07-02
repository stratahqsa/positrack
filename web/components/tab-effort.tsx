"use client";

import * as React from "react";
import { FilterX } from "lucide-react";
import type { Effort, Epic, SectionTotal } from "@/lib/types";
import { md, mdUnit } from "@/lib/format";
import { selectEpics, isFiltersEmpty } from "@/lib/filter";
import { useFilters } from "@/components/filter-context";
import { SectionShell } from "@/components/section-shell";
import { EffortTable } from "@/components/effort-table";
import { P2Table } from "@/components/p2-table";
import { Worklist } from "@/components/worklist";

/** Recompute a section total from a (filtered) epic list so captions stay honest. */
function totalsFor(epics: Epic[]): SectionTotal {
  let server = 0,
    ui = 0,
    testing = 0,
    spent = 0;
  for (const e of epics) {
    server += e.rollup.server;
    ui += e.rollup.ui;
    testing += e.rollup.testing;
    spent += e.spent;
  }
  return { server, ui, testing, total: server + ui + testing, spent };
}

function sectionCaption(total: SectionTotal): string {
  if (!total.total && !total.spent) return "";
  return `${mdUnit(total.total)} est · ${mdUnit(total.spent)} spent`;
}

export function TabEffort({ effort }: { effort: Effort }) {
  const s = effort.sections;
  const { filters, clearAll } = useFilters();

  // Apply the global filters (and active sort) to each open section.
  const pending = React.useMemo(
    () => selectEpics(s.pending, filters),
    [s.pending, filters],
  );
  const mixed = React.useMemo(
    () => selectEpics(s.mixed, filters),
    [s.mixed, filters],
  );
  const noStories = React.useMemo(
    () => selectEpics(s.no_stories, filters),
    [s.no_stories, filters],
  );
  const done = React.useMemo(
    () => selectEpics(s.done, filters),
    [s.done, filters],
  );

  // Worklist scope = all open epics (pending + mixed + no-stories), filtered.
  const openEpics = React.useMemo(
    () => [...pending, ...mixed, ...noStories],
    [pending, mixed, noStories],
  );

  const filtering = !isFiltersEmpty(filters);
  const openMatches = openEpics.length;
  // Grand total across the (filtered) open sections.
  const grand = React.useMemo(() => totalsFor(openEpics), [openEpics]);

  // When a specific child type is active, epics auto-expand to reveal matching
  // children and non-matching children are dimmed.
  const activeType = filters.type && filters.type !== "EPIC" ? filters.type : "";

  const noOpenMatches = filtering && openMatches === 0;

  return (
    <div className="space-y-4">
      {noOpenMatches ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-surface/40 px-4 py-12 text-center">
          <FilterX className="size-6 text-faint" />
          <div>
            <p className="text-[13px] font-medium text-fg">
              No open epics match these filters.
            </p>
            <p className="mt-1 text-[12px] text-muted">
              Loosen a filter to see results.
            </p>
          </div>
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-surface/60 px-3 py-1.5 text-[12px] font-medium text-fg transition-colors hover:bg-elevated"
          >
            <FilterX className="size-3.5" />
            Clear all filters
          </button>
        </div>
      ) : (
        <Worklist epics={openEpics} />
      )}

      <SectionShell
        title="Pending"
        count={pending.length}
        tone="info"
        caption={sectionCaption(totalsFor(pending))}
        defaultOpen
      >
        <EffortTable epics={pending} activeType={activeType} />
      </SectionShell>

      <SectionShell
        title="Mixed (some stories done)"
        count={mixed.length}
        tone="violet"
        caption={sectionCaption(totalsFor(mixed))}
        defaultOpen
      >
        <EffortTable epics={mixed} activeType={activeType} />
      </SectionShell>

      <SectionShell
        title="No stories"
        count={noStories.length}
        tone="warn"
        caption="epics without linked stories — needs breakdown"
        defaultOpen={false}
      >
        <EffortTable epics={noStories} activeType={activeType} />
      </SectionShell>

      <SectionShell
        title="Done since cutoff"
        count={done.length}
        tone="good"
        caption={`${mdUnit(totalsFor(done).spent)} spent`}
        defaultOpen={false}
      >
        <EffortTable epics={done} activeType={activeType} />
      </SectionShell>

      <SectionShell
        title="P2 backlog (moved to Phase 2)"
        count={s.p2_backlog.length}
        tone="muted"
        caption="deferred after cutoff — not affected by filters"
        defaultOpen={false}
      >
        <P2Table items={s.p2_backlog} />
      </SectionShell>

      <p className="px-1 text-[11px] leading-relaxed text-faint">
        {filtering ? "Filtered " : "Grand "}total (Pending + Mixed + No-stories):{" "}
        <span className="font-medium text-muted">
          {md(grand.total)} man-days estimated
        </span>{" "}
        · Dev {md(grand.server)} · UI {md(grand.ui)} · QA {md(grand.testing)} ·
        Spent <span className="font-medium text-muted">{md(grand.spent)}</span>.
        All figures in man-days (worklog minutes ÷ 480).
      </p>
    </div>
  );
}
