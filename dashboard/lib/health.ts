/**
 * Pure Project Health computations over a Snapshot. No I/O — every function
 * here is a straight reduction over already-loaded snapshot blocks, which is
 * what makes them unit-testable against a fixture (see tests/health.test.ts).
 */
import { epicRemainingSpent } from "./effort";
import { DEFAULT_WEEK1_ANCHOR, isThisWeek, parseAnchor } from "./week";
import { MAN_DAY_MINUTES } from "./types";
import type { Epic, ScheduleStory, Snapshot } from "./types";

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

/** schedule.stories with a genuinely unlinked ticket excluded (parentId
 *  null — no epic AND no parent story, e.g. PXB1-6847/6848). Weekly Deadline
 *  / Release Schedule read schedule.stories directly and are unaffected;
 *  this is Health-only, applied at the one point every Health computation
 *  below reads from, so it can't be forgotten on any individual list
 *  (2026-07-25). */
function linkedStories(s: Snapshot): ScheduleStory[] {
  return (s.schedule?.stories ?? []).filter((story) => story.parentId != null);
}

/**
 * The actual stories behind accountability().overdue's count — same
 * `isOverdue` filter, project-wide (not week-scoped). Exists so the "Overdue"
 * tile can drill down to exactly the tickets it's counting, rather than
 * someone having to reverse-engineer the number from Weekly Deadline /
 * Release Schedule (both apply narrower display filters than this raw
 * project-wide list, so they can under-report vs. this count) (2026-07-24).
 */
export function overdueStories(s: Snapshot, nowMs: number): ScheduleStory[] {
  return linkedStories(s).filter((story) => isOverdue(story, nowMs));
}

/** The actual stories behind thisWeekDeadlines().late's count: overdue AND
 *  due this release week. Same rationale as overdueStories() above. */
export function lateThisWeekStories(s: Snapshot, nowMs: number): ScheduleStory[] {
  const anchor = weekAnchorMs(s);
  return overdueStories(s, nowMs).filter(
    (story) => story.qaTs != null && isThisWeek(story.qaTs, nowMs, anchor),
  );
}

/** The actual stories behind accountability().reopened's count. */
export function reopenedStories(s: Snapshot): ScheduleStory[] {
  return linkedStories(s).filter((story) =>
    (story.state ?? "").toLowerCase().includes("re-open"),
  );
}

/** Open epics (pending/mixed/no_stories sections — the same 3 sections
 *  scripts/snapshot.py::_red_counts_from_effort sums over). */
function openEpics(s: Snapshot): Epic[] {
  const sections = s.effort?.sections;
  if (!sections) return [];
  return [...sections.pending, ...sections.mixed, ...sections.no_stories];
}

/** Needs a REAL owner: epic assignee blank/role-placeholder AND no pending
 *  story has a real individual assignee either (an epic parked on "Dev Lead"
 *  with a pending story assigned to a real person is NOT unowned). Prefers
 *  the precomputed `needs_owner` flag (matches _needs_owner in
 *  scripts/snapshot.py exactly); falls back to a blank-assignee check on
 *  snapshots that predate that field. */
function epicNeedsOwner(e: Epic): boolean {
  return e.needs_owner ?? isUnowned(e.assignee);
}

/** The actual epics behind insights.red_counts.unowned's count — the "Needs
 *  an owner" stat on the Accountability strip (NOT accountability().unowned,
 *  which is story-level and near-zero in real data) (2026-07-24). */
export function unownedEpicsList(s: Snapshot): Epic[] {
  return openEpics(s).filter(epicNeedsOwner);
}

/** The actual epics behind insights.red_counts.overshoot's count — the
 *  "N overshooting" stat on the Effort tile. */
export function overshootingEpics(s: Snapshot): Epic[] {
  return openEpics(s).filter((e) => e.overshoot);
}

export interface RedEpic {
  epic: Epic;
  /** Every RED category this epic matches — an epic can carry more than one
   *  (e.g. unowned AND overshooting), which is exactly why this list's
   *  length can be LESS than insights.red_counts.total_red: that number is
   *  an arithmetic SUM of 5 independent category counts (mirrors
   *  scripts/snapshot.py::_red_counts_from_effort), so an epic flagged under
   *  two categories contributes 2 to total_red but appears once here. */
  reasons: string[];
}

/** Every open epic flagged RED for at least one reason, deduplicated by
 *  epic — the "N total RED" drill-down on the Effort tile. Mirrors
 *  _red_counts_from_effort's 5 conditions exactly, reading `stale_days` from
 *  the snapshot itself (insights.red_counts.stale_days) rather than
 *  hardcoding it, so this can never drift from what Python actually used. */
export function redEpics(s: Snapshot, nowMs: number): RedEpic[] {
  const staleDays = s.insights?.red_counts?.stale_days ?? 30;
  const out: RedEpic[] = [];
  for (const e of openEpics(s)) {
    const reasons: string[] = [];
    if (epicNeedsOwner(e)) reasons.push("Needs an owner");
    if (e.missing_est) reasons.push("Missing estimate");
    if (e.created && (nowMs - e.created) / 86_400_000 > staleDays && (e.spent || 0) === 0) {
      reasons.push("Stale");
    }
    if (/block|hold/i.test(e.epic_state || "")) reasons.push("Blocked/On hold");
    if (e.overshoot) reasons.push("Overshooting");
    if (reasons.length > 0) out.push({ epic: e, reasons });
  }
  return out;
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

/**
 * Remaining open effort, NET of time already spent on the still-pending work
 * (2026-07-25) — not just the raw estimate ("Remaining effort to come from
 * effort report": reuses lib/effort.ts's epicRemainingSpent(), the exact
 * same pending-scoped spend figure the Effort Report's own epic tables show,
 * so this can never quietly diverge from what /effort displays). For each
 * open epic (pending/mixed/no_stories), `max(0, epic.total -
 * epicRemainingSpent(epic))` is clamped at zero PER EPIC before summing, so
 * an epic that's already over budget while still pending (e.g. an
 * "overshooting" epic) can't go negative and silently cancel out real
 * remaining work from other epics in the total. `estMd`/`spentMd` are the
 * pre-subtraction components, for the tile's "Est X · Spent Y" line so the
 * net number is never a mystery.
 */
export function remainingEffort(s: Snapshot): {
  manDays: number;
  hours: number;
  estMd: number;
  spentMd: number;
} {
  let totalMin = 0;
  let spentMin = 0;
  let netMin = 0;
  for (const e of openEpics(s)) {
    const spent = epicRemainingSpent(e);
    totalMin += e.total;
    spentMin += spent;
    netMin += Math.max(0, e.total - spent);
  }
  return {
    manDays: netMin / MAN_DAY_MINUTES,
    hours: netMin / 60,
    estMd: totalMin / MAN_DAY_MINUTES,
    spentMd: spentMin / MAN_DAY_MINUTES,
  };
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
  const stories = linkedStories(s);
  const anchor = weekAnchorMs(s);
  const dueThisWeek = stories.filter(
    (story) => story.qaTs != null && isThisWeek(story.qaTs, nowMs, anchor),
  );
  return {
    due: dueThisWeek.length,
    done: dueThisWeek.filter((story) => story.done).length,
    late: lateThisWeekStories(s, nowMs).length,
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
  const stories = linkedStories(s);

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
    overdue: overdueStories(s, nowMs).length,
    reopened: reopenedStories(s).length,
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
