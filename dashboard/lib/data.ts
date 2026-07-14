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
  const res = await fetch(`${RELEASE}/latest.json`, { cache: "no-store" });
  if (!res.ok) throw new Error(`snapshot fetch failed (${res.status})`);
  return (await res.json()) as Snapshot;
}
