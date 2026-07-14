import { Suspense } from "react";
import { loadSnapshot } from "@/lib/data";
import { applyFilters, deriveFilterOptions, parseFilters } from "@/lib/filters";
import { bucketByWeek, weeklyInclude } from "@/lib/weekly";
import { DEFAULT_WEEK1_ANCHOR, currentWeek, parseAnchor } from "@/lib/week";
import { Header } from "@/components/shell/header";
import { Nav } from "@/components/shell/nav";
import { FilterBar } from "@/components/filters/filter-bar";
import { KpiCards } from "@/components/weekly/kpi-cards";
import { WeekSection } from "@/components/weekly/week-section";

// Snapshot is read from disk (dev) or the Release (prod) per request, and
// filters live in the URL — force-dynamic so both the data and the filtered
// view stay current with no redeploy/caching.
export const dynamic = "force-dynamic";

// PRD_4 §3: JUN29_CUTOFF constant, mirrored here as the fallback for older
// snapshots that predate `config.jun29_cutoff_iso` (same defensive pattern
// lib/health.ts uses for week1_anchor via DEFAULT_WEEK1_ANCHOR).
const DEFAULT_JUN29_CUTOFF_ISO = "2026-06-29T10:30:00Z";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function WeeklyPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const snap = await loadSnapshot();
  const sp = await searchParams;
  const filters = parseFilters(sp);

  const { meta, schedule, config } = snap;
  const nowMs = meta.generated_at_ms;
  const anchorMs = parseAnchor(config?.week1_anchor ?? DEFAULT_WEEK1_ANCHOR);
  const jun29Ms = Date.parse(config?.jun29_cutoff_iso ?? DEFAULT_JUN29_CUTOFF_ISO);

  const stories = schedule?.stories ?? [];
  const epics = schedule?.epics ?? [];
  const epicNames = Object.fromEntries(epics.map((e) => [e.id, e.summary]));

  // Pipeline (Task 5): applyFilters (assignee/sprint/state/epic + toggles) ->
  // bucketByWeek (applies weeklyInclude internally, then buckets by dev
  // deadline) -> the week dimension, which applyFilters deliberately does
  // NOT handle, is applied here at the group level.
  const filtered = applyFilters(stories, filters, nowMs);
  const groups = bucketByWeek(filtered, anchorMs, jun29Ms, nowMs);
  const visibleGroups =
    filters.week.length > 0 ? groups.filter((g) => filters.week.includes(g.index + 1)) : groups;

  // KPI cards reflect exactly what's visible (Task 6: "KPI cards match the
  // visible rows") — the included+filtered stories AFTER the week filter,
  // i.e. the flattened set of stories across the groups actually rendered.
  const kpiStories = visibleGroups.flatMap((g) => g.stories);

  // Filter-option pools are scoped to "included" stories (weeklyInclude,
  // evaluated against the CURRENT week's end) so the dropdowns never offer a
  // choice that can't produce a result in this report, and are derived
  // BEFORE applyFilters so picking one filter doesn't shrink the others'
  // available options (standard faceted-filter UX).
  const { index: currentIdx, endMs: currentWeekEndMs } = currentWeek(nowMs, anchorMs);
  const optionsPool = stories.filter((s) => weeklyInclude(s, jun29Ms, currentWeekEndMs));
  const options = deriveFilterOptions(optionsPool);
  const weekCount = currentIdx + 1;

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
          <h1 className="text-[15px] font-semibold tracking-tight text-fg">Weekly Deadline View</h1>
          <p className="mt-0.5 text-[12px] text-muted">
            {meta.project} · {meta.scope} · stories grouped by dev deadline into release weeks,
            Week 1 through the current week.
          </p>
        </div>

        <Suspense fallback={<div className="h-[52px] animate-pulse rounded-lg bg-surface/50" />}>
          <FilterBar options={options} epicNames={epicNames} weekCount={weekCount} />
        </Suspense>

        <KpiCards stories={kpiStories} />

        {visibleGroups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface/30 px-4 py-10 text-center text-[12.5px] text-faint">
            No weeks match the current filters.
          </div>
        ) : (
          <div className="space-y-4">
            {visibleGroups.map((g) => (
              <WeekSection key={g.index} group={g} epicNames={epicNames} />
            ))}
          </div>
        )}

        <footer className="flex flex-col items-start justify-between gap-2 border-t border-border/60 pt-4 text-[11px] text-faint sm:flex-row sm:items-center">
          <span>
            Posibolt · POSX Reports · engine <span className="font-mono">{meta.engine_version}</span>
          </span>
          <span>Data as of {meta.as_of_hhmm} · sprint {meta.sprint}</span>
        </footer>
      </main>
    </div>
  );
}
