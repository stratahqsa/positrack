import { loadSnapshot } from "@/lib/data";
import { Header } from "@/components/shell/header";
import { Nav } from "@/components/shell/nav";

// Snapshot is read from disk (dev) or the Release (prod) per request; never
// statically cached. Body is still a placeholder — Task 5 replaces it with
// the real Project Health view; this commit only wires up the app shell.
export const dynamic = "force-dynamic";

export default async function Home() {
  const { meta } = await loadSnapshot();
  return (
    <div className="min-h-screen">
      <Header
        project={meta.project}
        scope={meta.scope}
        asOf={meta.as_of_hhmm}
        generatedAtIso={meta.generated_at_iso}
      />
      <Nav />
      <main className="mx-auto max-w-[1400px] px-4 py-6 text-muted sm:px-6">
        {meta.project} · {meta.scope} · as of {meta.as_of_hhmm}
      </main>
    </div>
  );
}
