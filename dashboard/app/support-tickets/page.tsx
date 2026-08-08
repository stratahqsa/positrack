import { loadSnapshot } from "@/lib/data";
import { currentTz } from "@/lib/tz-server";
import { Header } from "@/components/shell/header";
import { Nav } from "@/components/shell/nav";
import { Section } from "@/components/bugs/section";
import { SupPosxKpi } from "@/components/support/sup-posx-kpi";
import { ExpandableBreakdown } from "@/components/support/expandable-breakdown";
import { SupTicketsPanel } from "@/components/support/sup-tickets-panel";

// Same rationale as app/bugs and app/blocker — snapshot read per request so
// a refreshed snapshot shows with no redeploy.
export const dynamic = "force-dynamic";

export default async function SupportTicketsPage() {
  const snap = await loadSnapshot();
  const { meta, sup_posx } = snap;
  const tz = await currentTz();

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
          <h1 className="text-[15px] font-semibold tracking-tight text-fg">Support Tickets Report</h1>
          <p className="mt-0.5 text-[12px] text-muted">
            SUP project · Type: POS X · pending (excludes Solved/Closed)
          </p>
        </div>

        {!sup_posx ? (
          <div className="rounded-lg border border-dashed border-border bg-surface/30 px-4 py-10 text-center text-[12.5px] text-faint">
            No Support Tickets data in this snapshot yet — this block hasn&apos;t been generated.
          </div>
        ) : (
          <>
            <SupPosxKpi kpi={sup_posx.kpi} />

            <Section title="All Pending Tickets" tone="violet" count={sup_posx.kpi.pending}>
              <SupTicketsPanel tickets={sup_posx.tickets} tz={tz} />
            </Section>

            <Section title="By State" tone="violet" count={sup_posx.kpi.pending}>
              <div className="p-4">
                <ExpandableBreakdown
                  rows={sup_posx.by_state}
                  tickets={sup_posx.tickets}
                  groupKey="state"
                  tone="info"
                  tz={tz}
                />
              </div>
            </Section>

            <Section title="By Location" tone="violet" count={sup_posx.kpi.pending}>
              <div className="p-4">
                <ExpandableBreakdown
                  rows={sup_posx.by_location}
                  tickets={sup_posx.tickets}
                  groupKey="location"
                  tone="good"
                  tz={tz}
                />
              </div>
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
