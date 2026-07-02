import { MAN_DAY_MINUTES, type Epic, type Rollup } from "./types";

export const YT_BASE = "https://support.posibolt.com/issue";
export const issueUrl = (id: string) => `${YT_BASE}/${id}`;

/** Minutes → man-days (÷480). */
export function toMd(minutes: number): number {
  return minutes / MAN_DAY_MINUTES;
}

/** Format man-days compactly: 0 → "—", else 1 dp, dropping trailing ".0". */
export function md(minutes: number): string {
  if (!minutes) return "—";
  const v = toMd(minutes);
  const s = v.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

/** Man-days with the "d" suffix for headline figures. */
export function mdUnit(minutes: number): string {
  const s = md(minutes);
  return s === "—" ? s : `${s}d`;
}

/** Minutes → "12h 30m", "45m", or "—" for zero. */
export function hm(minutes: number): string {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/**
 * Overspend magnitude as an honest label: hours/minutes under a day, man-days
 * at/above a day — so a real overshoot never rounds to a misleading "0d".
 */
export function overspendLabel(minutes: number): string {
  if (minutes <= 0) return "0m";
  if (minutes < MAN_DAY_MINUTES) return hm(minutes);
  return mdUnit(minutes);
}

/** Epoch ms → "12 Feb 2026". */
export function fmtDate(ms: number | null | undefined): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Epoch ms → "3d ago" / "5w ago" relative-ish age from a reference now. */
export function ageFrom(ms: number | null | undefined, nowMs: number): string {
  if (!ms) return "—";
  const days = Math.max(0, Math.floor((nowMs - ms) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 14) return `${days}d ago`;
  if (days < 60) return `${Math.round(days / 7)}w ago`;
  return `${Math.round(days / 30)}mo ago`;
}

export function rollupTotal(r: Rollup): number {
  return r.server + r.ui + r.testing;
}

export function isUnowned(assignee: string | null | undefined): boolean {
  return !assignee || !assignee.trim();
}

export interface EpicFlags {
  /**
   * The epic has no individual owner — blank assignee OR parked on a role/system
   * placeholder. This is the RED "needs owner" condition.
   */
  needsOwner: boolean;
  /** Parked on a role/system account (non-blank assignee, but not a person). */
  roleOwner: boolean;
  /** Assignee is literally blank (a stricter subset of needsOwner). */
  unowned: boolean;
  overshoot: boolean;
  missingEst: boolean;
  /** any RED condition present */
  red: boolean;
  /** 0..N severity weight for worklist sorting (higher = worse) */
  severity: number;
}

/**
 * Per-epic RED flag derivation. Only flags that exist per-row in the snapshot:
 * needs-owner (blank OR role-parked assignee), overshoot (spent>total), missing
 * estimate. Prefers the data-layer's `needs_owner`/`role_owner` booleans and
 * falls back gracefully on older snapshots that predate those fields.
 * (Stale/blocked are aggregate-only in this snapshot and not attributable per epic.)
 */
export function epicFlags(e: Epic): EpicFlags {
  // Resilient: use the snapshot's honest flags when present, else derive.
  const needsOwner = e.needs_owner ?? isUnowned(e.assignee);
  const roleOwner = e.role_owner ?? false;
  // "unowned" = truly blank (needs an owner, and not parked on a role account).
  // Drives the strict "unowned" label vs. the "needs owner · <role>" label.
  const unowned = needsOwner && !roleOwner;
  const overshoot = !!e.overshoot;
  const missingEst = !!e.missing_est;
  const red = needsOwner || overshoot || missingEst;
  // Weighting: overshoot (real overspend) hurts most, then no owner, then no estimate.
  const severity =
    (overshoot ? 4 : 0) +
    (needsOwner ? 2 : 0) +
    (missingEst ? 1 : 0) +
    // tie-break: larger overspend magnitude nudges higher
    (overshoot && e.total ? Math.min(1, (e.spent - e.total) / e.total) : 0);
  return { needsOwner, roleOwner, unowned, overshoot, missingEst, red, severity };
}

/** Overspend in minutes (spent beyond total estimate), or 0. */
export function overspend(e: Epic): number {
  return e.overshoot ? Math.max(0, e.spent - e.total) : 0;
}

/** Percent spent-of-estimate, capped display value for a progress bar. */
export function spentPct(e: Epic): number {
  if (!e.total) return e.spent > 0 ? 100 : 0;
  return Math.round((e.spent / e.total) * 100);
}

type BadgeTone = "good" | "info" | "warn" | "default";

const STATE_TONE: Record<string, BadgeTone> = {
  DONE: "good",
  CLOSED: "good",
  FIXED: "good",
  "RE-OPEN": "warn",
  REOPEN: "warn",
  OPEN: "info",
  "IN PROGRESS": "info",
  "IN-PROGRESS": "info",
};

/** Map a story state to a Badge variant. Unknown states → neutral "default". */
export function stateTone(state: string): BadgeTone {
  return STATE_TONE[state?.toUpperCase()] ?? "default";
}
