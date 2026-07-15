/**
 * Pure Effort Report computations over a Snapshot's `effort` block (already
 * computed + live-verified upstream — see dashboard/lib/types.ts's `Effort`/
 * `Epic` shapes). No I/O, no React. Rules ported from docs/reports-dashboard/
 * reference/specs/PRD_3_Phase1_Effort_Report_v16.md ("Watch List (S5)",
 * "Missing-estimate flag (S1)") and Examples_3_Effort_Report_v16_
 * Implementation_Guide.md §8 (worked watch-list examples) per
 * docs/reports-dashboard/plans/06-effort.md Task 1.
 */
import type { Effort, Epic } from "./types";

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
 * MIXED (S2) epics that contain at least one Phase 2 story
 * (`p2_stories > 0`) — DONE/NO_STORIES epics are never watch-list candidates
 * regardless of their fields, since only `sections.pending`/`sections.mixed`
 * are read. `ready` = the PM's action is to flip the epic's Scope to Phase 2
 * — true iff there's no Phase 1 work left blocking that (`p1_pending === 0`,
 * T13). S1 entries precede S2 entries (Examples_3 §8's own row order).
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
 *  combined) — the "N Phase-1 epics contain Phase 2 stories" figure. */
export function hasP2Count(effort: Effort): number {
  return watchList(effort).length;
}

/** Info-bar count: watch-list epics with no Phase 1 work left blocking the
 *  move — the "M ready to move" figure. */
export function readyToMoveCount(effort: Effort): number {
  return watchList(effort).filter((w) => w.ready).length;
}
