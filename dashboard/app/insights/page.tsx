import { loadSnapshot } from "@/lib/data";
import { getBrief, rehydrateBrief } from "@/lib/brief";
import { Header } from "@/components/shell/header";
import { Nav } from "@/components/shell/nav";
import { Briefing } from "@/components/insights/briefing";

// Snapshot is read from disk (dev) or the Release (prod) per request —
// force-dynamic so a refreshed snapshot (and a freshly-regenerated brief)
// shows with no redeploy, same rationale as every other view.
export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const snapshot = await loadSnapshot();
  const { meta } = snapshot;
  // Re-hydrate pseudonym tokens ("P1") back to real names HERE, inside the
  // passcode-gated app — the published snapshot only ever carries pseudonyms
  // (privacy; see lib/brief.ts::rehydrateBrief).
  const rawBrief = getBrief(snapshot);
  const brief = rawBrief ? rehydrateBrief(rawBrief, snapshot) : null;
  // Wall-clock render time, deliberately NOT meta.generated_at_ms: briefAgeMs
  // needs the real "now" to produce a meaningful "generated N min ago" label.
  // Comparing brief.generated_at against meta.generated_at_ms would be
  // tautological (both are baked into the same snapshot in the same CI run,
  // so the "age" would always read ~0) — see lib/brief.ts's briefAgeMs doc.
  const nowMs = Date.now();

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
          <h1 className="text-[15px] font-semibold tracking-tight text-fg">AI Insights</h1>
          <p className="mt-0.5 text-[12px] text-muted">
            {meta.project} · {meta.scope} · a proactive, auto-generated briefing — top issues now,
            deltas since yesterday, and who&apos;s most behind.
          </p>
        </div>

        <Briefing brief={brief} nowMs={nowMs} />

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
