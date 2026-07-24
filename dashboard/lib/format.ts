/**
 * Shared display/format helpers for the schedule-based views (Weekly Deadline,
 * Release Schedule) and the Bug Analysis view. Pure, no I/O. Rules ported from
 * docs/reports-dashboard/reference/specs/Examples_4_Weekly_Deadline_View_
 * Implementation_Guide.md §9 and Examples_1_PXB1_Bug_Analysis_Implementation_
 * Guide.md §4/§18.
 */

import { MAN_DAY_MINUTES } from "./types";

const DAY_MS = 86_400_000;
/** IST = UTC+5:30, always — a fixed offset, never the runner's local TZ. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

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
 * Epoch ms -> "DD Mon YYYY, h:mm AM/PM" rendered in IST (e.g. bug `created`
 * 1783941449646 -> "13 Jul 2026, 4:47 PM"); null -> "—". Adds the fixed
 * +5:30 IST offset to the ms value up front, then reads UTC calendar/clock
 * parts off the shifted instant — the same "shift then read UTC getters"
 * trick fmtDate uses, extended from date-only to full date-time so the
 * result is independent of the runner's local timezone. Used for the Bug
 * Analysis view's bug listing tables (Examples_1 §4/§18).
 */
export function fmtDateTimeIst(ms: number | null): string {
  if (ms == null) return "—";
  const d = new Date(ms + IST_OFFSET_MS);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = MONTHS[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hours24 = d.getUTCHours();
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${day} ${month} ${year}, ${hours12}:${minutes} ${period}`;
}

/**
 * Epoch ms -> "DD Mon YYYY, h:mm AM/PM" in an arbitrary IANA zone via Intl —
 * the tz-aware generalization of fmtDateTimeIst (kept above: same output for
 * tz="Asia/Kolkata", proven by tests). Falls back to the IST formatter if the
 * zone string is somehow invalid at render time.
 */
export function fmtDateTime(ms: number | null, tz: string): string {
  if (ms == null) return "—";
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(ms);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const period = get("dayPeriod").replace(/\./g, "").toUpperCase();
    return `${get("day")} ${get("month")} ${get("year")}, ${get("hour")}:${get("minute")} ${period}`;
  } catch {
    return fmtDateTimeIst(ms);
  }
}

/** Epoch ms -> "HH:mm" (24h) in an IANA zone; null/invalid -> "—". */
export function fmtTimeShort(ms: number | null, tz: string): string {
  if (ms == null) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(ms);
  } catch {
    return "—";
  }
}

/** Short display label for a zone: the team zones get their familiar names. */
export function tzLabel(tz: string): string {
  if (tz === "Asia/Kolkata") return "IST";
  if (tz === "Africa/Johannesburg") return "SAST";
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(Date.now());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
  } catch {
    return tz;
  }
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
