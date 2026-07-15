/**
 * Pure release-week helpers. Weeks run Tue→Mon; week 1 starts at
 * `config.week1_anchor` (default below mirrors scripts/reports/config.py's
 * ReportsConfig.week1_anchor). Ports the client-side week arithmetic documented
 * in docs/reports-dashboard/reference/specs/
 * Examples_4_Weekly_Deadline_View_Implementation_Guide.md §7.
 *
 * Day boundaries are computed in UTC, not local/server time. YouTrack date-only
 * custom fields (Deadline Date, QA Deadline) are stored as epoch ms at 12:00
 * UTC — a convention that survives any timezone from UTC-12 to UTC+11 without
 * the calendar date shifting — so truncating in UTC always recovers the
 * intended calendar day, and it keeps the math deterministic regardless of the
 * machine (dev laptop, CI, Vercel) running it.
 */

export const DEFAULT_WEEK1_ANCHOR = "2026-06-30";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

/** Parses a "YYYY-MM-DD" date-only string as UTC midnight (ms). */
export function parseAnchor(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function truncToUtcDay(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Week index (0-based) that `ddDateMs` falls into, relative to `anchorMs`.
 * floor((ddMidnight - anchorMidnight) / 7 days), clamped to a minimum of 0 —
 * deadlines before the anchor fold into week 1 (index 0).
 */
export function weekIndexOf(ddDateMs: number, anchorMs: number): number {
  const diffDays = (truncToUtcDay(ddDateMs) - truncToUtcDay(anchorMs)) / DAY_MS;
  return Math.max(0, Math.floor(diffDays / 7));
}

/** The week containing `nowMs`: its index plus the UTC-ms bounds of that week. */
export function currentWeek(
  nowMs: number,
  anchorMs: number,
): { index: number; startMs: number; endMs: number } {
  const index = weekIndexOf(nowMs, anchorMs);
  const startMs = truncToUtcDay(anchorMs) + index * WEEK_MS;
  const endMs = startMs + WEEK_MS - 1; // last ms of the 7-day span
  return { index, startMs, endMs };
}

/** True when `ddMs` falls in the same release week as `nowMs`. */
export function isThisWeek(ddMs: number, nowMs: number, anchorMs: number): boolean {
  return weekIndexOf(ddMs, anchorMs) === currentWeek(nowMs, anchorMs).index;
}
