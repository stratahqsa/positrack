/**
 * Pure Project Health computations over a Snapshot. No I/O — every function
 * here is a straight reduction over already-loaded snapshot blocks, which is
 * what makes them unit-testable against a fixture (see tests/health.test.ts).
 */
import { DEFAULT_WEEK1_ANCHOR, isThisWeek, parseAnchor } from "./week";
import type { ScheduleStory, Snapshot } from "./types";

/** Overdue systemic-count threshold that alone marks the project "behind" (see onTrackVerdict). */
const BEHIND_OVERDUE_THRESHOLD = 5;

function weekAnchorMs(s: Snapshot): number {
  return parseAnchor(s.config?.week1_anchor ?? DEFAULT_WEEK1_ANCHOR);
}

function isUnowned(assignee: string | undefined | null): boolean {
  return !assignee || assignee.trim() === "";
}

/** Not done AND its QA deadline has already passed `nowMs`. The one definition
 *  of "late"/"overdue" reused by thisWeekDeadlines, accountability, and
 *  onTrackVerdict, so the three tiles never disagree about what "late" means. */
function isOverdue(story: ScheduleStory, nowMs: number): boolean {
  return !story.done && story.qaTs != null && story.qaTs < nowMs;
}

export function bugPressure(s: Snapshot): {
  openHigh: number;
  newHigh: number;
  newMedium: number;
  totalOpen: number;
  hottestModule: string | null;
} {
  const kpi = s.bugs?.kpi;
  return {
    openHigh: kpi?.open_high ?? 0,
    newHigh: kpi?.new_high ?? 0,
    newMedium: kpi?.new_medium ?? 0,
    totalOpen: kpi?.total_open ?? 0,
    // module_insights is pre-sorted descending by count (scripts/reports/bugs.py
    // module_insights()), so index 0 is the module with the most 7-day bugs.
    // Deliberately always module_insights (the 7-day-scoped field), never
    // bugs.open_bugs / the dashboard's "All Open" Module Insights view — the
    // Health tile's "hottest module" is meant to track a stable, apples-to-
    // apples 7-day recency window, not the full open backlog (2026-07-21).
    hottestModule: s.bugs?.module_insights?.[0]?.module ?? null,
  };
}

/** Remaining open effort. `manDays` is `grand_total.total_md` as-is; `hours` is
 *  derived from `grand_total.total` minutes (MAN_DAY_MINUTES-independent). */
export function remainingEffort(s: Snapshot): { manDays: number; hours: number } {
  const gt = s.effort.totals.grand_total;
  return { manDays: gt.total_md, hours: gt.total / 60 };
}

/**
 * Due / done / late among stories whose **QA deadline** lands in the current
 * release week. QA deadline (not dev deadline) is used so this tile's "late"
 * count uses the exact same rule as accountability()'s "overdue" — one
 * definition of lateness, not two competing ones (see isOverdue above).
 */
export function thisWeekDeadlines(
  s: Snapshot,
  nowMs: number,
): { due: number; done: number; late: number } {
  const stories = s.schedule?.stories ?? [];
  const anchor = weekAnchorMs(s);
  const dueThisWeek = stories.filter(
    (story) => story.qaTs != null && isThisWeek(story.qaTs, nowMs, anchor),
  );
  return {
    due: dueThisWeek.length,
    done: dueThisWeek.filter((story) => story.done).length,
    late: dueThisWeek.filter((story) => isOverdue(story, nowMs)).length,
  };
}

/**
 * Snapshot-wide (not week-scoped) accountability signals: unowned (blank
 * assignee) stories, overdue stories (isOverdue, any week), re-opened stories
 * (state contains "re-open"), and open-story counts per assignee, ranked by
 * their overdue count (ties broken by open count, then name) so the busiest/
 * most-at-risk person sorts first.
 */
export function accountability(
  s: Snapshot,
  nowMs: number,
): {
  unowned: number;
  overdue: number;
  reopened: number;
  byPerson: { name: string; overdue: number; open: number }[];
} {
  const stories = s.schedule?.stories ?? [];

  const byPersonMap = new Map<string, { overdue: number; open: number }>();
  for (const story of stories) {
    if (story.done || isUnowned(story.assignee)) continue;
    const rec = byPersonMap.get(story.assignee) ?? { overdue: 0, open: 0 };
    rec.open += 1;
    if (isOverdue(story, nowMs)) rec.overdue += 1;
    byPersonMap.set(story.assignee, rec);
  }
  const byPerson = Array.from(byPersonMap, ([name, v]) => ({ name, ...v })).sort(
    (a, b) => b.overdue - a.overdue || b.open - a.open || a.name.localeCompare(b.name),
  );

  return {
    unowned: stories.filter((story) => isUnowned(story.assignee)).length,
    overdue: stories.filter((story) => isOverdue(story, nowMs)).length,
    reopened: stories.filter((story) => (story.state ?? "").toLowerCase().includes("re-open"))
      .length,
    byPerson,
  };
}

/**
 * Documented on-track rule, combining this week's lateness, systemic overdue
 * count, and open High bugs:
 *  - "behind"  — a deadline is late THIS week AND there are open High bugs
 *                (compounding signal), OR overdue stories have piled up
 *                system-wide (>= BEHIND_OVERDUE_THRESHOLD) regardless of bugs.
 *  - "at-risk" — exactly one of {late this week, overdue > 0, open High > 0}
 *                without crossing the "behind" bar.
 *  - "on-track"— none of the above.
 */
export function onTrackVerdict(
  s: Snapshot,
  nowMs: number,
): { status: "on-track" | "at-risk" | "behind"; reasons: string[] } {
  const week = thisWeekDeadlines(s, nowMs);
  const acc = accountability(s, nowMs);
  const bugs = bugPressure(s);

  const reasons: string[] = [];
  if (week.late > 0) {
    reasons.push(`${week.late} deadline${week.late === 1 ? "" : "s"} late this week`);
  }
  if (acc.overdue > 0) {
    reasons.push(`${acc.overdue} stor${acc.overdue === 1 ? "y" : "ies"} overdue past QA deadline`);
  }
  if (bugs.openHigh > 0) {
    reasons.push(`${bugs.openHigh} open High-priority bug${bugs.openHigh === 1 ? "" : "s"}`);
  }

  const behind = (week.late > 0 && bugs.openHigh > 0) || acc.overdue >= BEHIND_OVERDUE_THRESHOLD;
  const atRisk = week.late > 0 || acc.overdue > 0 || bugs.openHigh > 0;
  const status = behind ? "behind" : atRisk ? "at-risk" : "on-track";

  if (status === "on-track") {
    reasons.push("No late deadlines, overdue stories, or open High bugs");
  }
  return { status, reasons };
}
