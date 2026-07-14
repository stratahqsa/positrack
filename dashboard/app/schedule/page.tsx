import { Suspense } from "react";
import { Rocket } from "lucide-react";
import { loadSnapshot } from "@/lib/data";
import { activeFilterCount, applyFilters, deriveFilterOptions, parseFilters } from "@/lib/filters";
import { assigneeByEpic, buildEpicView, grandTotals, groupByMilestone, type EpicView } from "@/lib/release";
import { DEFAULT_WEEK1_ANCHOR, currentWeek, parseAnchor } from "@/lib/week";
import { fmtDate } from "@/lib/format";
import type { ScheduleStory } from "@/lib/types";
import { Header } from "@/components/shell/header";
import { Nav } from "@/components/shell/nav";
import { FilterBar } from "@/components/filters/filter-bar";
import { ReleaseKpi } from "@/components/release/release-kpi";
import { MilestoneSection } from "@/components/release/milestone-section";

// Snapshot is read from disk (dev) or the Release (prod) per request, and
// filters live in the URL — force-dynamic so both the data and the filtered
// view stay current with no redeploy/caching (same rationale as app/weekly).
export const dynamic = "force-dynamic";

// Fallbacks mirror app/weekly/page.tsx's DEFAULT_JUN29_CUTOFF_ISO convention:
// used only for snapshots that predate `config.*_cutoff_iso`.
const DEFAULT_MTG_CUTOFF_ISO = "2026-07-03T10:30:00Z";
const DEFAULT_JUN29_CUTOFF_ISO = "2026-06-29T10:30:00Z";
// PRD_2 §5 display cutoff: only milestones on/after the meeting's calendar
// day render (T10) — the trailing "no date" group is exempt in lib/release.ts.
const DISPLAY_CUTOFF_MS = Date.parse("2026-07-03T00:00:00Z");

type SearchParams = Record<string, string | string[] | undefined>;

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const snap = await loadSnapshot();
  const sp = await searchParams;
  const filters = parseFilters(sp);

  const { meta, schedule, config } = snap;
  const nowMs = meta.generated_at_ms;
  const mtgCutoffMs = Date.parse(config?.mtg_cutoff_iso ?? DEFAULT_MTG_CUTOFF_ISO);
  const jun29Ms = Date.parse(config?.jun29_cutoff_iso ?? DEFAULT_JUN29_CUTOFF_ISO);

  const stories = schedule?.stories ?? [];
  const epics = schedule?.epics ?? [];
  const epicNames = Object.fromEntries(epics.map((e) => [e.id, e.summary]));
  const assignees = assigneeByEpic(snap);

  // Pipeline (Task 2): the global filter bar applies to STORIES first, then
  // each schedule epic's EpicView is built from its own filtered stories. An
  // epic whose stories were entirely filtered away is dropped — unless no
  // filter is active at all, in which case a genuinely story-less epic
  // (NO_STORIES badge) still belongs on the meeting view.
  const filtered = applyFilters(stories, filters, nowMs);
  const hasActiveFilter = activeFilterCount(filters) > 0;

  const storiesByEpic = new Map<string, ScheduleStory[]>();
  for (const s of filtered) {
    if (!s.epicId) continue; // orphan stories have no epic to hang off in this view
    const list = storiesByEpic.get(s.epicId);
    if (list) list.push(s);
    else storiesByEpic.set(s.epicId, [s]);
  }

  const views: EpicView[] = epics
    .map((epic) =>
      buildEpicView(epic, storiesByEpic.get(epic.id) ?? [], assignees[epic.id] ?? "", mtgCutoffMs, jun29Ms, nowMs),
    )
    .filter((v) => v.stories.length > 0 || !hasActiveFilter);

  const groups = groupByMilestone(views, DISPLAY_CUTOFF_MS, nowMs);
  const totals = grandTotals(groups);
  // KPI mirrors weekly/kpi-cards.tsx's "matches the visible rows" convention:
  // epics dropped by the display cutoff (T10) don't count toward it either.
  const visibleEpics = groups.flatMap((g) => g.epics);

  // Filter-bar option pools: the plan pins these to the full unfiltered story
  // set (unlike Weekly Deadline's "included window" pool — Release Schedule
  // has no equivalent inclusion window), and the Week control is reused as-is
  // for cross-view consistency even though this view doesn't bucket by week.
  const options = deriveFilterOptions(stories);
  const anchorMs = parseAnchor(config?.week1_anchor ?? DEFAULT_WEEK1_ANCHOR);
  const weekCount = currentWeek(nowMs, anchorMs).index + 1;

  return (
    <div className="min-h-screen">
      <Header
        project={meta.project}
        scope={meta.scope}
        asOf={meta.as_of_hhmm}
        generatedAtIso={meta.generated_at_iso}
      />
      <Nav />
      <main className="mx-auto max-w-[1400px] space-y-5 px-4 py-6 sm:px-6">
        <div>
          <h1 className="text-[15px] font-semibold tracking-tight text-fg">Release Schedule Tracker</h1>
          <p className="mt-0.5 text-[12px] text-muted">
            {meta.project} · {meta.scope} · epics grouped by release milestone, DONE vs NOT-DONE against the
            meeting baseline — drill down to stories and open bugs.
          </p>
        </div>

        {totals.finalMs != null ? (
          <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-accent/30 bg-accent/[0.08] px-4 py-2.5">
            <Rocket className="size-4 shrink-0 text-accent" />
            <span className="text-[12.5px] font-medium text-fg/85">Final release</span>
            <span className="tabular text-[14px] font-bold text-accent">{fmtDate(totals.finalMs)}</span>
          </div>
        ) : null}

        <Suspense fallback={<div className="h-[52px] animate-pulse rounded-lg bg-surface/50" />}>
          <FilterBar options={options} epicNames={epicNames} weekCount={weekCount} />
        </Suspense>

        <ReleaseKpi epics={visibleEpics} totals={totals} />

        {groups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface/30 px-4 py-10 text-center text-[12.5px] text-faint">
            No milestones match the current filters.
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <MilestoneSection key={g.ms} group={g} />
            ))}
          </div>
        )}

        <footer className="flex flex-col items-start justify-between gap-2 border-t border-border/60 pt-4 text-[11px] text-faint sm:flex-row sm:items-center">
          <span>
            Posibolt · POSX Reports · engine <span className="font-mono">{meta.engine_version}</span>
          </span>
          <span>
            Data as of {meta.as_of_hhmm} · sprint {meta.sprint}
          </span>
        </footer>
      </main>
    </div>
  );
}
