/**
 * Pure Effort Report computations over a Snapshot's `effort` block (already
 * computed + live-verified upstream — see dashboard/lib/types.ts's `Effort`/
 * `Epic` shapes). No I/O, no React. Rules ported from docs/reports-dashboard/
 * reference/specs/PRD_3_Phase1_Effort_Report_v16.md ("Watch List (S5)",
 * "Missing-estimate flag (S1)") and Examples_3_Effort_Report_v16_
 * Implementation_Guide.md §8 (worked watch-list examples) per
 * docs/reports-dashboard/plans/06-effort.md Task 1.
 */
import type { Effort, Epic, Story } from "./types";

const DONE_STATE_WORDS = ["done", "fixed", "verified", "closed", "won't fix", "duplicate", "obsolete"];

/** Case-insensitive substring match against DONE_STATE_WORDS — the shared
 *  done-state check for effort computations (mirrors core/ytcore.py's
 *  is_done_state). Single source of truth for epic-effort-table.tsx and
 *  watch-list.tsx, which both used to carry their own copy. */
export function isDoneState(state: string | null | undefined): boolean {
  const s = (state ?? "").toLowerCase();
  return DONE_STATE_WORDS.some((word) => s.includes(word));
}

/** Mirrors core/ytcore.py's `p1p` filter exactly: pending (not done) AND
 *  in-scope for Phase 1 (no scope set, or scope contains "PHASE 1"). */
export function isPendingPhase1(story: Story): boolean {
  return !isDoneState(story.state) && (!story.scope || story.scope.toUpperCase().includes("PHASE 1"));
}

/** Sum of each pending-Phase-1 story's own `spent` (its "Spent time" field —
 *  see lib/types.ts's Story.spent doc) — the same figure epic-effort-
 *  table.tsx uses to scope a MIXED epic's Spent column to just its pending
 *  stories. `spent` is optional (older snapshots predate it) and defaults
 *  to 0. */
export function pendingP1Spent(epic: Epic): number {
  return epic.stories.filter(isPendingPhase1).reduce((total, s) => total + (s.spent ?? 0), 0);
}

/**
 * Spend figure scoped to match `epic.total` (the pending-Phase-1 estimate
 * rollup), for computing remaining/net effort. `epic.spent` (the whole-epic
 * lifetime work-item-sweep total) already equals pending-only spend for
 * PENDING/NO_STORIES epics — they have no done stories to inflate it — but
 * a MIXED epic's `epic.spent` includes its done stories too, so that case
 * needs `pendingP1Spent()` instead (2026-07-25).
 */
export function epicRemainingSpent(epic: Epic): number {
  return epic.category === "MIXED" ? pendingP1Spent(epic) : epic.spent;
}

export type WatchSource = "S1" | "S2";

export interface WatchListItem {
  epic: Epic;
  source: WatchSource;
  p1_pending: number;
  p2_stories: number;
  ready: boolean;
}

function toWatchItem(epic: Epic, source: WatchSource): WatchListItem {
  const p1Pending = epic.p1_pending ?? 0;
  return {
    epic,
    source,
    p1_pending: p1Pending,
    p2_stories: epic.p2_stories ?? 0,
    ready: p1Pending === 0,
  };
}

/**
 * S5 Watch List (PRD_3 "Watch List (S5)" / Examples_3 §8): PENDING (S1) and
 * MIXED (S2) epics that contain at least one story deferred to a later phase
 * — Phase 2 or Phase 3 (`p2_stories > 0`; the field name predates the Phase-3
 * broadening on 2026-07-18 and is kept for wire-format stability) —
 * DONE/NO_STORIES epics are never watch-list candidates regardless of their
 * fields, since only `sections.pending`/`sections.mixed` are read. `ready` =
 * the PM's action is to flip the epic's Scope to whichever later phase its
 * stories moved to — true iff there's no Phase 1 work left blocking that
 * (`p1_pending === 0`, T13). S1 entries precede S2 entries (Examples_3 §8's
 * own row order).
 * `p1_pending`/`p2_stories` default to 0 when absent (optional fields on
 * older snapshots) so a legacy epic never crashes and never wrongly
 * qualifies.
 */
export function watchList(effort: Effort): WatchListItem[] {
  const fromPending = effort.sections.pending
    .filter((e) => (e.p2_stories ?? 0) > 0)
    .map((e) => toWatchItem(e, "S1"));
  const fromMixed = effort.sections.mixed
    .filter((e) => (e.p2_stories ?? 0) > 0)
    .map((e) => toWatchItem(e, "S2"));
  return [...fromPending, ...fromMixed];
}

/**
 * Info-bar count (PRD_3 §4 "Missing-estimate flag (S1)"): PENDING epics
 * flagged `missing_est` upstream (`(Dev==0 AND UI==0) OR QA==0` on
 * rollupP1). Scoped to S1 only — a MIXED or DONE epic's `missing_est` (if
 * ever set) doesn't count toward this bar.
 */
export function missingEstCount(effort: Effort): number {
  return effort.sections.pending.filter((e) => e.missing_est).length;
}

/** Info-bar count: how many epics are on the watch list at all (S1+S2
 *  combined) — the "N Phase-1 epics contain P2/P3 stories" figure. */
export function hasP2Count(effort: Effort): number {
  return watchList(effort).length;
}

/** Info-bar count: watch-list epics with no Phase 1 work left blocking the
 *  move — the "M ready to move" figure. */
export function readyToMoveCount(effort: Effort): number {
  return watchList(effort).filter((w) => w.ready).length;
}
