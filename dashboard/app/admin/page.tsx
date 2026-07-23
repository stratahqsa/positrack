import { Header } from "@/components/shell/header";
import { Nav } from "@/components/shell/nav";
import { AdminPanel } from "@/components/admin/admin-panel";
import { loadSnapshot } from "@/lib/data";
import { readSchedule } from "@/lib/schedule-config";
import { listSnapshotRuns, type RunInfo } from "@/lib/github";
import { currentTz } from "@/lib/tz-server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin · POSX Reports",
  robots: { index: false, follow: false },
};

/** /admin — schedule editor + Refresh Now + run history (ADMIN_CODE-gated by
 *  middleware). Run history is best-effort: a GH API hiccup renders the panel
 *  without it rather than failing the page. */
export default async function AdminPage() {
  const snap = await loadSnapshot();
  const cfg = await readSchedule();
  const tz = await currentTz();
  let runs: RunInfo[] = [];
  let runsError: string | null = null;
  try {
    runs = await listSnapshotRuns(10);
  } catch (e) {
    runsError = e instanceof Error ? e.message : String(e);
  }
  return (
    <div className="min-h-screen">
      <Header
        project={snap.meta.project}
        scope={snap.meta.scope}
        asOf={snap.meta.as_of_hhmm}
        generatedAtIso={snap.meta.generated_at_iso}
      />
      <Nav />
      <main className="mx-auto max-w-[1400px] space-y-5 px-4 py-6 sm:px-6">
        <div>
          <h1 className="text-[15px] font-semibold tracking-tight text-fg">Admin — Refresh Control</h1>
          <p className="mt-0.5 text-[12px] text-muted">
            Schedule, pause, and trigger data refreshes — changes apply from the next 15-minute
            tick, no deploy needed.
          </p>
        </div>
        <AdminPanel initial={cfg} runs={runs} runsError={runsError} tz={tz} />
      </main>
    </div>
  );
}
