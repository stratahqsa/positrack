import { loadSnapshot } from "@/lib/data";
import { currentTz } from "@/lib/tz-server";
import { Header } from "@/components/shell/header";
import { Nav } from "@/components/shell/nav";
import { AndroidView } from "@/components/android/android-view";

// Same rationale as app/support-tickets — snapshot read per request so a
// refreshed snapshot shows with no redeploy.
export const dynamic = "force-dynamic";

export default async function AndroidPage() {
  const snap = await loadSnapshot();
  const { meta, android } = snap;
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
          <h1 className="text-[15px] font-semibold tracking-tight text-fg">Android Status Report</h1>
          <p className="mt-0.5 text-[12px] text-muted">
            PXB1-3295 · POS (Android) · direct-subtask stories with linked open bugs (APP project)
          </p>
        </div>

        {!android ? (
          <div className="rounded-lg border border-dashed border-border bg-surface/30 px-4 py-10 text-center text-[12.5px] text-faint">
            No Android Status data in this snapshot yet — this block hasn&apos;t been generated.
          </div>
        ) : (
          <AndroidView block={android} tz={tz} />
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
