import { loadSnapshot } from "@/lib/data";
import {
  accountability,
  bugPressure,
  lateThisWeekStories,
  onTrackVerdict,
  overdueStories,
  remainingEffort,
  thisWeekDeadlines,
} from "@/lib/health";
import { getBrief, rehydrateBrief } from "@/lib/brief";
import { Header } from "@/components/shell/header";
import { Nav } from "@/components/shell/nav";
import { OnTrackBanner } from "@/components/health/on-track-banner";
import { EffortTile } from "@/components/health/effort-tile";
import { DeadlinesTile } from "@/components/health/deadlines-tile";
import { BugPressureTile } from "@/components/health/bug-pressure-tile";
import { AccountabilityStrip } from "@/components/health/accountability-strip";
import { BriefTeaser } from "@/components/insights/brief-teaser";

// Snapshot is read from disk (dev) or the Release (prod) per request; never
// statically cached, so a refreshed snapshot shows with no redeploy.
export const dynamic = "force-dynamic";

export default async function Home() {
  const snapshot = await loadSnapshot();
  const { meta, insights } = snapshot;
  // Anchored to the snapshot's own clock, matching app/weekly + app/schedule
  // (both use meta.generated_at_ms) instead of the request-time Date.now()
  // this page used before. Keeps Health's overdue/verdict math consistent
  // with every other view AND with the AI briefing below, which is computed
  // at snapshot time too — a live Date.now() here could otherwise disagree
  // with the (necessarily frozen) brief about what's overdue.
  const nowMs = meta.generated_at_ms;
  // Re-hydrate pseudonym tokens to real names inside the gated app (the
  // published brief carries only "P1"-style tokens — privacy).
  const rawBrief = getBrief(snapshot);
  const brief = rawBrief ? rehydrateBrief(rawBrief, snapshot) : null;

  const verdict = onTrackVerdict(snapshot, nowMs);
  const effort = remainingEffort(snapshot);
  const deadlines = thisWeekDeadlines(snapshot, nowMs);
  const bugs = bugPressure(snapshot);
  const acc = accountability(snapshot, nowMs);
  const lateStories = lateThisWeekStories(snapshot, nowMs);
  const overdueStoriesList = overdueStories(snapshot, nowMs);

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
        <OnTrackBanner status={verdict.status} reasons={verdict.reasons} />

        <BriefTeaser brief={brief} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <EffortTile
            manDays={effort.manDays}
            hours={effort.hours}
            totalRed={insights.red_counts.total_red}
            overshoot={insights.red_counts.overshoot}
          />
          <DeadlinesTile
            due={deadlines.due}
            done={deadlines.done}
            late={deadlines.late}
            lateStories={lateStories}
          />
          <BugPressureTile
            openHigh={bugs.openHigh}
            newHigh={bugs.newHigh}
            newMedium={bugs.newMedium}
            hottestModule={bugs.hottestModule}
          />
        </div>

        <AccountabilityStrip
          unownedEpics={insights.red_counts.unowned}
          overdue={acc.overdue}
          overdueStoriesList={overdueStoriesList}
          reopened={acc.reopened}
          byPerson={acc.byPerson}
        />

        <footer className="flex flex-col items-start justify-between gap-2 border-t border-border/60 pt-4 text-[11px] text-faint sm:flex-row sm:items-center">
          <span>
            Posibolt · POSX Reports · engine{" "}
            <span className="font-mono">{meta.engine_version}</span>
          </span>
          <span>Data as of {meta.as_of_hhmm} · sprint {meta.sprint}</span>
        </footer>
      </main>
    </div>
  );
}
