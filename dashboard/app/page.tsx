import { loadSnapshot } from "@/lib/data";

// Snapshot is read from disk (dev) or the Release (prod) per request; never
// statically cached. Temporary landing page — Task 5 replaces this with the
// real Project Health view.
export const dynamic = "force-dynamic";

export default async function Home() {
  const { meta } = await loadSnapshot();
  return (
    <main style={{ padding: 24 }}>
      {meta.project} · {meta.scope} · as of {meta.as_of_hhmm}
    </main>
  );
}
