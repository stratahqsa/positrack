import "server-only";
import { list } from "@vercel/blob";
import type { Snapshot, TrendPoint } from "./types";

/**
 * Server-only snapshot access. Reads the Control Tower snapshot from Vercel Blob
 * (uploaded nightly by the Snapshot workflow) at request time. Enumeration is
 * token-gated via BLOB_READ_WRITE_TOKEN (server-side only); resolved blob URLs are
 * NEVER re-exported to the browser — pages project only the fields they render.
 * Pages are force-dynamic, so each request sees fresh Blob data without a redeploy.
 */

const PREFIX = "control-tower/";
const DATED = /snapshot-(\d{4}-\d{2}-\d{2})\.json$/;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`blob fetch failed (${res.status})`);
  return (await res.json()) as T;
}

export async function loadSnapshot(): Promise<Snapshot> {
  const { blobs } = await list({ prefix: `${PREFIX}latest.json`, limit: 1 });
  const latest = blobs.find((b) => b.pathname === `${PREFIX}latest.json`) ?? blobs[0];
  if (!latest) {
    throw new Error(
      "No snapshot in the Blob store yet — run Actions → Snapshot → Run workflow.",
    );
  }
  return fetchJson<Snapshot>(latest.url);
}

/**
 * Build the RED-count trend series from dated snapshots in Blob. De-duplicates by
 * date (last pathname for a date wins) so a same-date re-upload does not create a
 * fake second point. Sorted ascending by date. Empty on any listing failure.
 */
export async function loadTrend(): Promise<TrendPoint[]> {
  let listed;
  try {
    listed = await list({ prefix: `${PREFIX}snapshot-` });
  } catch {
    return [];
  }

  const dated = listed.blobs
    .filter((b) => DATED.test(b.pathname))
    .sort((a, b) => a.pathname.localeCompare(b.pathname));

  const byDate = new Map<string, TrendPoint>();
  for (const b of dated) {
    const date = b.pathname.match(DATED)?.[1];
    if (!date) continue;
    try {
      const snap = await fetchJson<Snapshot>(b.url);
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
