import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Snapshot, TrendPoint } from "./types";

/**
 * Server-only snapshot access. Reads web/data/*.json from disk at request time.
 * NEVER import this from a Client Component and never re-export the raw JSON to
 * the browser — pages must project only the fields they render.
 */

const DATA_DIR = path.join(process.cwd(), "data");

export async function loadSnapshot(): Promise<Snapshot> {
  const raw = await fs.readFile(path.join(DATA_DIR, "latest.json"), "utf8");
  return JSON.parse(raw) as Snapshot;
}

/**
 * Build the RED-count trend series from dated snapshot files.
 * De-duplicates by date (keeps the last file seen for a given date) so an
 * identical `snapshot-YYYY-MM-DD.json` copy of latest does not create a fake
 * second data point. Sorted ascending by date.
 */
export async function loadTrend(): Promise<TrendPoint[]> {
  let files: string[] = [];
  try {
    files = await fs.readdir(DATA_DIR);
  } catch {
    return [];
  }

  const dated = files
    .filter((f) => /^snapshot-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();

  const byDate = new Map<string, TrendPoint>();
  for (const file of dated) {
    const date = file.slice("snapshot-".length, -".json".length);
    try {
      const raw = await fs.readFile(path.join(DATA_DIR, file), "utf8");
      const snap = JSON.parse(raw) as Snapshot;
      const rc = snap.insights?.red_counts;
      if (!rc) continue;
      byDate.set(date, {
        date,
        total_red: rc.total_red ?? 0,
        unowned: rc.unowned ?? 0,
        unestimated: rc.unestimated ?? 0,
        stale: rc.stale ?? 0,
        overshoot: rc.overshoot ?? 0,
        blocked: rc.blocked ?? 0,
      });
    } catch {
      // skip unreadable/partial snapshot
    }
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
