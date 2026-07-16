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

/** Dev reads a local snapshot (dashboard/data/latest.json); prod fetches
 *  `${SNAPSHOT_DATA_URL}/latest.json` from the secret Blob path. force-dynamic
 *  pages call this per request so a refreshed snapshot shows with no redeploy. */
export async function loadSnapshot(): Promise<Snapshot> {
  const local = path.join(process.cwd(), "data", "latest.json");
  if (fs.existsSync(local)) {
    return JSON.parse(fs.readFileSync(local, "utf-8")) as Snapshot;
  }
  if (!SNAPSHOT_BASE) {
    throw new Error("SNAPSHOT_DATA_URL is not set (the secret Vercel Blob base for the snapshot)");
  }
  // The Blob is published with cache-control:max-age=0 so the CDN serves fresh
  // data; `no-store` keeps Next.js from adding a second caching layer.
  const res = await fetch(`${SNAPSHOT_BASE}/latest.json`, { cache: "no-store" });
  if (!res.ok) throw new Error(`snapshot fetch failed (${res.status})`);
  return (await res.json()) as Snapshot;
}
