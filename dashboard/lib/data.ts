import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Snapshot } from "./types";

// Prod source: the SECRET Vercel Blob base — "<blob-base>/<SNAPSHOT_SECRET>" —
// set as the SNAPSHOT_DATA_URL env var. The snapshot lives at an unguessable
// path so its raw fields (assignee/people names) aren't public; the workflow
// publishes only to Blob, no public GitHub Release (see
// .github/workflows/snapshot.yml). Dev reads a local file instead, so this is
// only required in production.
const SNAPSHOT_BASE = process.env.SNAPSHOT_DATA_URL;

// Module-level cache: Pro's warm instances keep this across requests, cutting
// a ~380KB fetch+parse per page view to at most one per minute. The Blob
// changes ≤5×/day (admin schedule), so 60s worst-case staleness is invisible;
// a transient Blob error serves the last good snapshot instead of a 500.
let cached: { at: number; snap: Snapshot } | null = null;
const TTL_MS = 60_000;

/** Dev reads a local snapshot (dashboard/data/latest.json); prod fetches
 *  `${SNAPSHOT_DATA_URL}/latest.json` from the secret Blob path, cached
 *  in-memory for 60s. force-dynamic pages call this per request so a refreshed
 *  snapshot shows with no redeploy (at most ~1 min behind the Blob). */
export async function loadSnapshot(): Promise<Snapshot> {
  const local = path.join(process.cwd(), "data", "latest.json");
  if (fs.existsSync(local)) {
    return JSON.parse(fs.readFileSync(local, "utf-8")) as Snapshot;
  }
  if (!SNAPSHOT_BASE) {
    throw new Error("SNAPSHOT_DATA_URL is not set (the secret Vercel Blob base for the snapshot)");
  }
  if (cached && Date.now() - cached.at < TTL_MS) return cached.snap;
  try {
    // The Blob is published with cache-control:max-age=0 so the CDN serves
    // fresh data; `no-store` keeps Next.js from adding its own caching layer
    // (the 60s in-memory TTL above is the only one).
    const res = await fetch(`${SNAPSHOT_BASE}/latest.json`, { cache: "no-store" });
    if (!res.ok) throw new Error(`snapshot fetch failed (${res.status})`);
    const snap = (await res.json()) as Snapshot;
    cached = { at: Date.now(), snap };
    return snap;
  } catch (e) {
    if (cached) return cached.snap; // stale-on-error beats a hard 500
    throw e;
  }
}
