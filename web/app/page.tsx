import { AlertOctagon } from "lucide-react";
import { loadSnapshot, loadTrend } from "@/lib/data";
import { md } from "@/lib/format";
import { Header } from "@/components/header";
import { KpiStrip } from "@/components/kpi-strip";
import { DashboardTabs } from "@/components/dashboard-tabs";

// Snapshot is read from disk per request; never statically cached.
export const dynamic = "force-dynamic";

/** Shown when the server has no ACCESS_CODE configured. Never crashes the app. */
function NotConfigured() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="max-w-md rounded-lg border border-warn/30 bg-surface/60 p-6 text-center card-ring">
        <div className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-warn/12 ring-1 ring-warn/30">
          <AlertOctagon className="size-5 text-warn" />
        </div>
        <h1 className="text-base font-semibold text-fg">
          ACCESS_CODE not configured
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          The Control Tower access gate is disabled because the{" "}
          <code className="rounded bg-elevated px-1 py-0.5 font-mono text-[12px] text-fg">
            ACCESS_CODE
          </code>{" "}
          environment variable is not set on the server. Set it (locally it is{" "}
          <code className="rounded bg-elevated px-1 py-0.5 font-mono text-[12px] text-fg">
            admin
          </code>
          ) and restart to enable the login gate before exposing this app.
        </p>
      </div>
    </main>
  );
}

export default async function Page() {
  if (!process.env.ACCESS_CODE) {
    return <NotConfigured />;
  }

  const [snap, trend] = await Promise.all([loadSnapshot(), loadTrend()]);
  const { meta, effort, timespent, gamification, insights } = snap;

  const openEpics =
    effort.counts.pending + effort.counts.mixed + effort.counts.no_stories;
  const pendingMinutes = effort.totals.pending.total;

  return (
    <div className="min-h-screen">
      <Header
        project={meta.project}
        scope={meta.scope}
        sprint={meta.sprint}
        asOf={meta.as_of_hhmm}
        generatedAtIso={meta.generated_at_iso}
      />

      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6">
        <KpiStrip
          red={insights.red_counts}
          delta={insights.red_delta}
          openEpics={openEpics}
          pendingMinutes={pendingMinutes}
          pendingMd={md(pendingMinutes)}
        />

        <DashboardTabs
          effort={effort}
          timespent={timespent}
          gamification={gamification}
          trend={trend}
        />

        <footer className="flex flex-col items-start justify-between gap-2 border-t border-border/60 pt-4 text-[11px] text-faint sm:flex-row sm:items-center">
          <span>
            Posibolt · POSX Control Tower · engine{" "}
            <span className="font-mono">{meta.engine_version}</span>
          </span>
          <span>
            Data as of {meta.as_of_hhmm} · issues link to{" "}
            <span className="font-mono">support.posibolt.com</span>
          </span>
        </footer>
      </main>
    </div>
  );
}
