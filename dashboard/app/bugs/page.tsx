import { loadSnapshot } from "@/lib/data";
import { Header } from "@/components/shell/header";
import { Nav } from "@/components/shell/nav";
import { Badge } from "@/components/ui/badge";
import { BugKpi } from "@/components/bugs/bug-kpi";
import { BugTable } from "@/components/bugs/bug-table";
import { Section } from "@/components/bugs/section";
import { StateBreakdown } from "@/components/bugs/state-breakdown";
import { ModuleInsightsPanel } from "@/components/bugs/module-insights-panel";
import { priorityVariant } from "@/components/weekly/badge-tone";

// Snapshot is read from disk (dev) or the Release (prod) per request —
// force-dynamic so a refreshed snapshot shows with no redeploy, same
// rationale as app/weekly and app/schedule. No global filter bar here (the
// `bugs` block is already segmented by priority/state/module — see the plan's
// documented rationale), so unlike those two pages this one needs no
// searchParams/Suspense/FilterBar wiring.
export const dynamic = "force-dynamic";

const WINDOW_PRIORITIES = ["High", "Medium", "Low"] as const;

export default async function BugsPage() {
  const snap = await loadSnapshot();
  const { meta, bugs } = snap;

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
          <h1 className="text-[15px] font-semibold tracking-tight text-fg">Bug Analysis Report</h1>
          <p className="mt-0.5 text-[12px] text-muted">
            {bugs
              ? `Covers: ${bugs.window.label} · open High/Med/Low · module insights (7d / all open)`
              : `${meta.project} · ${meta.scope} · bug data not available in this snapshot`}
          </p>
        </div>

        {!bugs ? (
          <div className="rounded-lg border border-dashed border-border bg-surface/30 px-4 py-10 text-center text-[12.5px] text-faint">
            No bug data in this snapshot yet — the Bug Analysis block hasn&apos;t been generated.
          </div>
        ) : (
          <>
            <BugKpi kpi={bugs.kpi} />

            <Section
              title={`QA Bugs Reported (${bugs.window.label})`}
              tone="danger"
              count={WINDOW_PRIORITIES.reduce((n, p) => n + bugs.new_in_window[p].length, 0)}
            >
              <div className="divide-y divide-border/40">
                {WINDOW_PRIORITIES.map((pri) => (
                  <div key={pri} className="p-4">
                    <div className="mb-2.5 flex items-center gap-2">
                      <Badge variant={priorityVariant(pri)}>{pri}</Badge>
                      <span className="tabular text-[11px] text-faint">
                        {bugs.new_in_window[pri].length.toLocaleString()} bug
                        {bugs.new_in_window[pri].length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <BugTable rows={bugs.new_in_window[pri]} />
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Older Open High Priority Bugs" tone="danger-dim" count={bugs.open_high_older.length}>
              <div className="p-4">
                <BugTable rows={bugs.open_high_older} />
              </div>
            </Section>

            <Section
              title="Medium & Low by State"
              tone="warn"
              count={bugs.kpi.open_medium + bugs.kpi.open_low}
            >
              <div className="grid gap-x-6 gap-y-5 p-4 md:grid-cols-2">
                <StateBreakdown title="Medium" rows={bugs.medium_by_state} tone="info" />
                <StateBreakdown title="Low" rows={bugs.low_by_state} tone="good" />
              </div>
            </Section>

            <Section title="Module Insights" tone="violet" count={bugs.module_insights.length}>
              <ModuleInsightsPanel
                sevenDayBugs={bugs.seven_day_bugs ?? []}
                openBugs={bugs.open_bugs ?? []}
              />
            </Section>
          </>
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
