/**
 * Shared display/format helpers for the schedule-based views (Weekly Deadline,
 * Release Schedule). Pure, no I/O. Rules ported from docs/reports-dashboard/
 * reference/specs/Examples_4_Weekly_Deadline_View_Implementation_Guide.md §9.
 */

import { MAN_DAY_MINUTES } from "./types";

const DAY_MS = 86_400_000;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Minutes -> hours, one decimal (e.g. 1440 -> "24.0h"); 0 -> "—". */
export function fmtHours(min: number): string {
  if (!min) return "—";
  return `${(min / 60).toFixed(1)}h`;
}

/** Minutes -> man-days, one decimal (480 min = 1md, e.g. 1440 -> "3.0md"); 0 -> "—". */
export function fmtMd(min: number): string {
  if (!min) return "—";
  return `${(min / MAN_DAY_MINUTES).toFixed(1)}md`;
}

/**
 * Epoch ms -> "DD Mon" (e.g. 1751932800000 -> "08 Jul"); null -> "—". Reads
 * UTC calendar-day parts directly off the ms value — consistent with how
 * lib/week.ts treats date-only deadline fields (stored at 12:00 UTC) so the
 * displayed day never shifts with the running machine's local timezone.
 */
export function fmtDate(ms: number | null): string {
  if (ms == null) return "—";
  const d = new Date(ms);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = MONTHS[d.getUTCMonth()];
  return `${day} ${month}`;
}

/**
 * Compares a story's resolved timestamp against its QA deadline for the
 * Resolved-column verdict badge. `diff = round(|resolved - qaTs| / day)`.
 * Strictly `resolved > qaTs` is late (even same-day, sub-day differences
 * round to "+0d late") — equal timestamps are NOT late. Returns null when
 * either side is missing (unresolved story, or no QA deadline to compare
 * against).
 */
export function verdictVsQa(
  resolvedMs: number | null,
  qaTs: number | null,
): { label: string; late: boolean } | null {
  if (resolvedMs == null || qaTs == null) return null;

  const diffDays = Math.round(Math.abs(resolvedMs - qaTs) / DAY_MS);
  if (resolvedMs > qaTs) {
    return { label: `+${diffDays}d late`, late: true };
  }
  return { label: `${diffDays}d early`, late: false };
}
