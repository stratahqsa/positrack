/**
 * Pure Release Schedule Tracker computations over a Snapshot's `schedule` (epics +
 * stories with deadlines + bugs[]) and `effort` (per-epic assignee/state) blocks.
 * No I/O, no React. Rules ported from docs/reports-dashboard/reference/specs/
 * Examples_2_Release_Schedule_Tracker_Implementation_Guide.md (§3 badge, §4
 * visibility/rollup, §5 milestone/urgency, §6 resolved date, §7 NEW, §9 grand
 * totals) and PRD_2_Phase1_Release_Schedule_Tracker.md §5.
 *
 * All cutoffs (mtgCutoffMs, jun29Ms, displayCutoffMs) are passed in already
 * parsed to epoch ms -- callers derive them from `snap.config.*_cutoff_iso` via
 * `Date.parse` (see tests/release.test.ts), matching the weekly.test.ts
 * convention. Nothing in this module hardcodes those meeting-cycle constants.
 */
import { fmtDate, verdictVsQa } from "./format";
import type { ScheduleEpic, ScheduleStory, Snapshot } from "./types";

const DAY_MS = 86_400_000;

/** Sentinel `ms` for the trailing "no date" milestone group (mirrors Examples_2
 *  §5's own "0 -> no date" convention). Never a real epoch ms in practice --
 *  real dd/qa/resolved timestamps are all far larger than 0. */
const NO_DATE_MS = 0;

export type EpicBadge = "DONE" | "NOT_DONE" | "NO_STORIES" | string; // string = the single story's state

export interface EpicView {
  id: string;
  summary: string;
  assignee: string;
  isNew: boolean;
  badge: EpicBadge;
  done: boolean;
  stories: ScheduleStory[]; // ALL stories (for badge/milestone math)
  visibleStories: ScheduleStory[]; // per visibility rule (Examples_2 §4)
  rollup: { dev: number; ui: number; qa: number; spent: number };
  milestoneMs: number | null;
  resolvedMs: number | null;
  resolvedVerdict: { label: string; late: boolean } | null;
}

export interface MilestoneGroup {
  ms: number;
  label: string;
  daysFromNow: number;
  urgency: "overdue" | "d3" | "d7" | "d14" | "far" | "alldone";
  epics: EpicView[];
  counts: { epics: number; stories: number; pending: number; done: number };
  totals: { dev: number; ui: number; qa: number; spent: number };
}

function sum(stories: ScheduleStory[], pick: (s: ScheduleStory) => number): number {
  return stories.reduce((total, s) => total + pick(s), 0);
}

/** max(ddTs, qaTs) across ALL stories, ignoring nulls; null if none present. */
function maxDeadlineMs(stories: ScheduleStory[]): number | null {
  let max: number | null = null;
  for (const s of stories) {
    for (const v of [s.ddTs, s.qaTs]) {
      if (v != null && (max == null || v > max)) max = v;
    }
  }
  return max;
}

/** max story.resolved across ALL stories, ignoring nulls; null if none resolved. */
function maxResolvedMs(stories: ScheduleStory[]): number | null {
  let max: number | null = null;
  for (const s of stories) {
    if (s.resolved != null && (max == null || s.resolved > max)) max = s.resolved;
  }
  return max;
}

/** Builds `{epicId: assignee}` from effort.sections' four epic buckets (done/
 *  pending/mixed/no_stories -- schedule.epics don't carry assignee/state
 *  themselves, per PRD_2 §"Epic assignee fallback"). An epic id absent here
 *  (e.g. p2_backlog-only, or an effort/schedule sync gap) is simply absent
 *  from the map -- callers read it back with `?? ""`. */
export function assigneeByEpic(snap: Snapshot): Record<string, string> {
  const map: Record<string, string> = {};
  const { done, pending, mixed, no_stories } = snap.effort.sections;
  for (const epic of [...done, ...pending, ...mixed, ...no_stories]) {
    map[epic.id] = epic.assignee;
  }
  return map;
}

/**
 * Epic state badge (Examples_2 §3 / PRD_2 §5). Priority, in order:
 *  1. The epic's own resolution overrides everything once it clears the
 *     meeting cutoff (row PXB1-3160, T5) -- strictly `>`, not `>=`.
 *  2. Zero stories -> NO_STORIES. This MUST be checked before "all done":
 *     `[].every(...)` is vacuously true in JS, so an empty array would
 *     otherwise misread as DONE (row PXB1-3155).
 *  3. All stories done -> DONE (row PXB1-3120).
 *  4. Exactly one (necessarily still-pending, by #3) story -> show its own
 *     state text, more informative than a blanket NOT_DONE (row PXB1-3140, T3).
 *  5. Otherwise, any pending story -> NOT_DONE (row PXB1-3101).
 */
export function epicBadge(
  stories: ScheduleStory[],
  epicResolvedMs: number | null,
  mtgCutoffMs: number,
): EpicBadge {
  if (epicResolvedMs != null && epicResolvedMs > mtgCutoffMs) return "DONE";
  if (stories.length === 0) return "NO_STORIES";
  if (stories.every((s) => s.done)) return "DONE";
  if (stories.length === 1) return stories[0].state;
  return "NOT_DONE";
}

/**
 * Builds the full per-epic view: badge, visible stories, rollup, milestone,
 * resolved date + verdict, and the NEW flag. `stories` must already be
 * pre-filtered to this epic's own stories by the caller (e.g. by `epicId`).
 *
 * `nowMs` is accepted for signature parity with the plan / the rest of this
 * codebase's "pass nowMs explicitly" convention -- no EpicView field
 * currently depends on it (daysFromNow/urgency are computed later, per
 * milestone GROUP, in groupByMilestone).
 */
export function buildEpicView(
  epic: ScheduleEpic,
  stories: ScheduleStory[],
  assignee: string,
  mtgCutoffMs: number,
  jun29Ms: number,
  nowMs: number,
): EpicView {
  void nowMs;

  const badge = epicBadge(stories, epic.resolved, mtgCutoffMs);
  const done = badge === "DONE";

  // Visibility (Examples_2 §4): NOT_DONE -> pending ∪ (done & resolved>mtg);
  // DONE -> resolved>jun29. Applied uniformly to DONE-via-override epics too --
  // the PRD's truth table doesn't carve out an exception for the override case.
  const visibleStories = done
    ? stories.filter((s) => s.resolved != null && s.resolved > jun29Ms)
    : stories.filter((s) => !s.done || (s.resolved != null && s.resolved > mtgCutoffMs));

  // Rollup (Examples_2 §4): NOT_DONE sums PENDING stories only (narrower than
  // visibleStories -- the done-since-mtg story shown for visibility is
  // deliberately excluded from the totals); DONE sums the visible set.
  const rollupSource = done ? visibleStories : stories.filter((s) => !s.done);
  const rollup = {
    dev: sum(rollupSource, (s) => s.devEst),
    ui: sum(rollupSource, (s) => s.uiEst),
    qa: sum(rollupSource, (s) => s.qaEst),
    spent: sum(rollupSource, (s) => s.spent),
  };

  // Milestone (Examples_2 §5): max(ddTs, qaTs) across ALL stories; fallback to
  // the epic's own resolved date; null (no-date group) when neither exists.
  const milestoneMs = maxDeadlineMs(stories) ?? epic.resolved;

  // Resolved date (Examples_2 §6): max resolved date across ALL stories. No
  // fallback to epic.resolved here (unlike milestone) -- a DONE-via-override
  // epic whose stories haven't individually resolved yet legitimately has no
  // "resolved" value to report, even though the epic badge itself is DONE.
  const resolvedMs = maxResolvedMs(stories);
  const resolvedVerdict = done ? verdictVsQa(resolvedMs, milestoneMs) : null;

  // NEW (Examples_2 §7): created after the meeting cutoff.
  const isNew = epic.created != null && epic.created > mtgCutoffMs;

  return {
    id: epic.id,
    summary: epic.summary,
    assignee,
    isNew,
    badge,
    done,
    stories,
    visibleStories,
    rollup,
    milestoneMs,
    resolvedMs,
    resolvedVerdict,
  };
}

function truncUtcDay(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Whole-day difference between two UTC calendar days (positive = future).
 *  Truncating both sides to their UTC calendar day keeps this a clean integer
 *  regardless of `nowMs`'s time-of-day (dd/qa deadlines are always exactly
 *  noon UTC; `nowMs` -- meta.generated_at_ms -- is not), matching how
 *  lib/week.ts and lib/format.ts already treat these date-only fields. */
function daysFromNow(ms: number, nowMs: number): number {
  return Math.round((truncUtcDay(ms) - truncUtcDay(nowMs)) / DAY_MS);
}

function urgencyForDays(days: number): MilestoneGroup["urgency"] {
  if (days <= 0) return "overdue";
  if (days <= 3) return "d3";
  if (days <= 7) return "d7";
  if (days <= 14) return "d14";
  return "far";
}

function buildGroup(ms: number, label: string, epics: EpicView[], nowMs: number): MilestoneGroup {
  const isNoDate = ms === NO_DATE_MS;
  const allDone = epics.every((e) => e.done);
  const days = isNoDate ? Infinity : daysFromNow(ms, nowMs);
  // Urgency (Examples_2 §5): an all-done group is green regardless of date
  // (T11); the no-date group has no real date to be urgent about, so it reads
  // "far" unless every epic in it is done.
  const urgency: MilestoneGroup["urgency"] = allDone ? "alldone" : isNoDate ? "far" : urgencyForDays(days);

  let stories = 0;
  let pending = 0;
  let done = 0;
  let dev = 0;
  let ui = 0;
  let qa = 0;
  let spent = 0;
  for (const e of epics) {
    stories += e.stories.length;
    pending += e.stories.filter((s) => !s.done).length;
    done += e.stories.filter((s) => s.done).length;
    dev += e.rollup.dev;
    ui += e.rollup.ui;
    qa += e.rollup.qa;
    spent += e.rollup.spent;
  }

  return {
    ms,
    label,
    daysFromNow: days,
    urgency,
    epics,
    counts: { epics: epics.length, stories, pending, done },
    totals: { dev, ui, qa, spent },
  };
}

/**
 * Groups epic views by milestone (Examples_2 §5): epics sharing the exact
 * same `milestoneMs` (naturally true for any epics sharing a calendar day via
 * dd/qa deadlines, since those are always stored at noon UTC) merge into one
 * group; epics with a null milestone collect into a trailing "no date" group
 * that always renders, exempt from the display cutoff. Dated groups are
 * sorted ascending and only rendered from `displayCutoffMs` onward (T10).
 */
export function groupByMilestone(
  views: EpicView[],
  displayCutoffMs: number,
  nowMs: number,
): MilestoneGroup[] {
  const dated = new Map<number, EpicView[]>();
  const noDate: EpicView[] = [];

  for (const v of views) {
    if (v.milestoneMs == null) {
      noDate.push(v);
      continue;
    }
    const list = dated.get(v.milestoneMs);
    if (list) list.push(v);
    else dated.set(v.milestoneMs, [v]);
  }

  const groups: MilestoneGroup[] = [];
  const sortedMs = Array.from(dated.keys()).sort((a, b) => a - b);
  for (const ms of sortedMs) {
    if (ms < displayCutoffMs) continue;
    groups.push(buildGroup(ms, fmtDate(ms), dated.get(ms)!, nowMs));
  }

  if (noDate.length > 0) {
    groups.push(buildGroup(NO_DATE_MS, "No date", noDate, nowMs));
  }

  return groups;
}

/** Sums each group's totals (Examples_2 §9); `finalMs` is the latest real
 *  milestone across groups (the no-date sentinel, ms === 0, never counts). */
export function grandTotals(
  groups: MilestoneGroup[],
): { dev: number; ui: number; qa: number; spent: number; finalMs: number | null } {
  let dev = 0;
  let ui = 0;
  let qa = 0;
  let spent = 0;
  let finalMs: number | null = null;

  for (const g of groups) {
    dev += g.totals.dev;
    ui += g.totals.ui;
    qa += g.totals.qa;
    spent += g.totals.spent;
    if (g.ms > NO_DATE_MS && (finalMs == null || g.ms > finalMs)) finalMs = g.ms;
  }

  return { dev, ui, qa, spent, finalMs };
}
