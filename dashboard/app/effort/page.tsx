import { AlertTriangle, Layers } from "lucide-react";
import { loadSnapshot } from "@/lib/data";
import { hasP2Count, missingEstCount, readyToMoveCount, watchList } from "@/lib/effort";
import { fmtDate, fmtHours, fmtMd } from "@/lib/format";
import { Header } from "@/components/shell/header";
import { Nav } from "@/components/shell/nav";
import { Section } from "@/components/effort/section";
import { EffortKpi } from "@/components/effort/effort-kpi";
import { EpicEffortTable } from "@/components/effort/epic-effort-table";
import { WatchList } from "@/components/effort/watch-list";
import { IssueLink } from "@/components/ui/issue-link";

// Snapshot is read from disk (dev) or the Release (prod) per request —
// force-dynamic so a refreshed snapshot shows with no redeploy, same
// rationale as app/weekly, app/schedule, and app/bugs. No global filter bar
// here (effort is epic/category-centric, out of scope for v1 per the plan),
// so like app/bugs this page needs no searchParams/Suspense/FilterBar wiring.
export const dynamic = "force-dynamic";

export default async function EffortPage() {
  const snap = await loadSnapshot();
  const { meta, effort } = snap;

  // `effort` is a required field on Snapshot's type, but this guard stays
  // defensive against a stale/malformed snapshot on disk predating it —
  // mirrors app/bugs's `!bugs` / app/schedule's `!schedule` treatment for
  // their own (genuinely optional) blocks.
  const watch = effort ? watchList(effort) : [];
  const missingEst = effort ? missingEstCount(effort) : 0;
  const hasP2 = effort ? hasP2Count(effort) : 0;
  const readyToMove = effort ? readyToMoveCount(effort) : 0;

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
          <h1 className="text-[15px] font-semibold tracking-tight text-fg">PXB1 Phase 1 — Effort Report</h1>
          <p className="mt-0.5 text-[12px] text-muted">
            {effort
              ? `${effort.counts.epics_discovered.toLocaleString()} epics · Done since baseline · Man-day = 8h`
              : `${meta.project} · ${meta.scope} · effort data not available in this snapshot`}
          </p>
        </div>

        {!effort ? (
          <div className="rounded-lg border border-dashed border-border bg-surface/30 px-4 py-10 text-center text-[12.5px] text-faint">
            No effort data in this snapshot yet — the Effort Report block hasn&apos;t been generated.
          </div>
        ) : (
          <>
            {hasP2 > 0 ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-violet/30 bg-violet/[0.08] px-4 py-2.5 text-[12.5px] text-violet">
                <Layers className="size-4 shrink-0" />
                <span>
                  <strong className="tabular">{hasP2}</strong> Phase-1 epic{hasP2 === 1 ? "" : "s"} contain Phase 2
                  stories
                  {readyToMove > 0 ? (
                    <>
                      {" "}
                      · <strong className="tabular">{readyToMove}</strong> ready to move
                    </>
                  ) : null}
                </span>
              </div>
            ) : null}

            {missingEst > 0 ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warn/30 bg-warn/[0.08] px-4 py-2.5 text-[12.5px] text-warn">
                <AlertTriangle className="size-4 shrink-0" />
                <span>
                  <strong className="tabular">{missingEst}</strong> epic{missingEst === 1 ? "" : "s"} have
                  incomplete estimates
                </span>
              </div>
            ) : null}

            <EffortKpi effort={effort} hasP2Count={hasP2} />

            <div className="space-y-4">
              <Section title="✓ Completed since 29 Jun" tone="good" count={effort.counts.done}>
                <EpicEffortTable epics={effort.sections.done} variant="done" />
              </Section>

              <Section title="📋 Has Stories · All Pending" tone="warn" count={effort.counts.pending}>
                <EpicEffortTable epics={effort.sections.pending} variant="pending" />
              </Section>

              <Section title="⚡ Mixed (Some Done)" tone="info" count={effort.counts.mixed}>
                <EpicEffortTable epics={effort.sections.mixed} variant="mixed" />
              </Section>

              <Section title="🚫 No Stories" tone="outline" count={effort.counts.no_stories}>
                {effort.sections.no_stories.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[12px] text-faint">No epics without stories.</div>
                ) : (
                  <div className="overflow-x-auto scroll-slim">
                    <table className="w-full min-w-[520px] border-collapse">
                      <thead className="bg-surface-2/95">
                        <tr className="text-[10px] font-semibold uppercase tracking-wide text-faint">
                          <th className="px-2 py-2 text-left">Epic</th>
                          <th className="px-2 py-2 text-left">Summary</th>
                          <th className="px-2 py-2 text-left">Assignee</th>
                          <th className="px-2 py-2 text-left">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {effort.sections.no_stories.map((epic) => (
                          <tr key={epic.id} className="border-t border-border/50 text-[12px] hover:bg-elevated/40">
                            <td className="whitespace-nowrap px-2 py-2 align-top">
                              <IssueLink id={epic.id} showIcon={false} />
                            </td>
                            <td className="max-w-[320px] px-2 py-2 align-top">
                              <span className="line-clamp-2 text-fg/85">{epic.summary}</span>
                            </td>
                            <td className="px-2 py-2 align-top text-fg/80">
                              {epic.assignee || <span className="text-faint">Unassigned</span>}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2 align-top text-muted">
                              {fmtDate(epic.created)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              <Section title="📁 P2 Backlog (moved after 29 Jun)" tone="violet" count={effort.counts.p2_backlog}>
                {effort.sections.p2_backlog.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[12px] text-faint">
                    No epics currently in the P2 backlog.
                  </div>
                ) : (
                  <div className="overflow-x-auto scroll-slim">
                    <table className="w-full min-w-[560px] border-collapse">
                      <thead className="bg-surface-2/95">
                        <tr className="text-[10px] font-semibold uppercase tracking-wide text-faint">
                          <th className="px-2 py-2 text-left">Epic</th>
                          <th className="px-2 py-2 text-left">Summary</th>
                          <th className="px-2 py-2 text-left">Assignee</th>
                          <th className="px-2 py-2 text-left">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {effort.sections.p2_backlog.map((item) => (
                          <tr key={item.id} className="border-t border-border/50 text-[12px] hover:bg-elevated/40">
                            <td className="whitespace-nowrap px-2 py-2 align-top">
                              <IssueLink id={item.id} showIcon={false} />
                            </td>
                            <td className="max-w-[320px] px-2 py-2 align-top">
                              <span className="line-clamp-2 text-fg/85">{item.summary}</span>
                              <div className="mt-0.5 text-[10.5px] text-violet/80">
                                → P2 on {fmtDate(item.changed_at)}
                              </div>
                            </td>
                            <td className="px-2 py-2 align-top text-fg/80">
                              {item.assignee || <span className="text-faint">Unassigned</span>}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2 align-top text-muted">
                              {fmtDate(item.created)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              <Section title="👀 Watch List: P1 Epics with P2 Stories" tone="violet" count={watch.length}>
                <WatchList items={watch} />
              </Section>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-accent/40 bg-accent/[0.1] px-5 py-4">
              <span className="text-[13px] font-semibold text-accent">Grand Total (open work)</span>
              <span className="tabular text-[13px] text-fg/80">Dev {fmtHours(effort.totals.grand_total.server)}</span>
              <span className="tabular text-[13px] text-fg/80">UI {fmtHours(effort.totals.grand_total.ui)}</span>
              <span className="tabular text-[13px] text-fg/80">QA {fmtHours(effort.totals.grand_total.testing)}</span>
              <span className="ml-auto tabular text-xl font-bold text-accent">
                {fmtHours(effort.totals.grand_total.total)}{" "}
                <span className="text-[12px] font-medium text-accent/70">
                  / {fmtMd(effort.totals.grand_total.total)}
                </span>
              </span>
            </div>
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
