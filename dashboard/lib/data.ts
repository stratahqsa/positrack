import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Snapshot } from "./types";

const RELEASE =
  process.env.SNAPSHOT_DATA_URL ??
  "https://github.com/stratahqsa/positrack/releases/download/snapshot-latest";

/** Dev reads a local snapshot (dashboard/data/latest.json); prod fetches the Release.
 *  force-dynamic pages call this per request so a refreshed snapshot shows with no redeploy. */
export async function loadSnapshot(): Promise<Snapshot> {
  const local = path.join(process.cwd(), "data", "latest.json");
  if (fs.existsSync(local)) {
    return JSON.parse(fs.readFileSync(local, "utf-8")) as Snapshot;
  }
  // NOTE: GitHub's release-asset CDN caches latest.json by path (query string
  // is ignored in its cache key) and can serve a warm edge's previous copy for
  // a while after the Snapshot job clobbers it — so right after a manual
  // refresh the site may briefly show the prior snapshot until that edge
  // converges. In the nightly cadence this is invisible. `no-store` keeps
  // Next.js itself from adding a second caching layer.
  const res = await fetch(`${RELEASE}/latest.json`, { cache: "no-store" });
  if (!res.ok) throw new Error(`snapshot fetch failed (${res.status})`);
  return (await res.json()) as Snapshot;
}
