import "server-only";
import type { Snapshot, TrendPoint } from "./types";

/**
 * Server-only snapshot access. Reads the Control Tower snapshot from the
 * machine-managed GitHub Release `snapshot-latest`, which the nightly Snapshot
 * workflow updates. The repo is public, so the asset URLs are public — no token.
 * Pages are force-dynamic, so each request sees the latest release data without a
 * redeploy. Override the base with SNAPSHOT_DATA_URL if the repo/tag ever changes.
 */

const BASE =
  process.env.SNAPSHOT_DATA_URL ??
  "https://github.com/stratahqsa/positrack/releases/download/snapshot-latest";
const DATED = /^snapshot-\d{4}-\d{2}-\d{2}\.json$/;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`snapshot fetch failed (${res.status}) for ${url}`);
  return (await res.json()) as T;
}

export async function loadSnapshot(): Promise<Snapshot> {
  return fetchJson<Snapshot>(`${BASE}/latest.json`);
}

/**
 * Build the RED-count trend series from the dated snapshots listed in index.json
 * (maintained by the workflow). De-duplicates by date (a same-date entry wins the
 * later position) and sorts ascending. Returns [] on any failure so the Trends tab
 * degrades to "collecting data" rather than crashing the page.
 */
export async function loadTrend(): Promise<TrendPoint[]> {
  let index: string[];
  try {
    index = await fetchJson<string[]>(`${BASE}/index.json`);
  } catch {
    return [];
  }

  const dated = index.filter((f) => DATED.test(f)).sort();

  const byDate = new Map<string, TrendPoint>();
  for (const file of dated) {
    const date = file.slice("snapshot-".length, -".json".length);
    try {
      const snap = await fetchJson<Snapshot>(`${BASE}/${file}`);
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
