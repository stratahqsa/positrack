/**
 * Weekly Deadline inclusion filter + week bucketing. Pure, no I/O. Ports
 * docs/reports-dashboard/reference/specs/
 * Examples_4_Weekly_Deadline_View_Implementation_Guide.md §6 (inclusion truth
 * table) and §7 (week bucketing arithmetic). Reuses lib/week.ts for the
 * Tue->Mon release-week math.
 */
import { fmtDate } from "./format";
import { currentWeek, weekIndexOf } from "./week";
import type { ScheduleStory } from "./types";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

/**
 * The 3 inclusion checks shared by both the main Week 1..current-week
 * timeline and the "Looking Ahead" future-weeks preview: done-exclusion,
 * both deadlines present, at least one estimate > 0 (Examples_4 §6 checks
 * 1-3). Each caller adds its own "which week window" check on top of this —
 * weeklyInclude caps to the current week's end, bucketFutureWeeks checks a
 * specific later week's bounds — so the two views can never disagree about
 * anything except which week window they're each looking at.
 */
function baseInclude(s: ScheduleStory, jun29Ms: number): boolean {
  if (s.done && (s.resolved == null || s.resolved <= jun29Ms)) return false;
  if (s.ddTs == null || s.qaTs == null) return false;
  if (!(s.devEst > 0 || s.uiEst > 0 || s.qaEst > 0)) return false;
  return true;
}

/**
 * The Weekly Deadline inclusion filter (Examples_4 §6): baseInclude's 3
 * checks, plus the dev deadline must fall on/before the end of the
 * currently-shown week (`weekEndMs`) — deadlines further out aren't shown
 * in the main timeline (see bucketFutureWeeks for the separate preview of
 * the next couple of weeks).
 */
export function weeklyInclude(s: ScheduleStory, jun29Ms: number, weekEndMs: number): boolean {
  if (!baseInclude(s, jun29Ms)) return false;
  if ((s.ddTs as number) > weekEndMs) return false;
  return true;
}

export interface WeekGroup {
  index: number;
  label: string;
  startMs: number;
  endMs: number;
  isCurrent: boolean;
  /** True only for bucketFutureWeeks' "Looking Ahead" groups — drives that
   *  section's distinct (neither past-red nor current-blue) styling. */
  isFuture?: boolean;
  stories: ScheduleStory[];
}

function weekLabel(index: number, startMs: number, endMs: number): string {
  return `Week ${index + 1} (${fmtDate(startMs)} – ${fmtDate(endMs)})`;
}

/**
 * Buckets stories into Week 1..current release-week groups by dev deadline
 * (`ddTs`), applying `weeklyInclude` internally so callers can pass the raw
 * schedule (or any already-filtered subset) without re-deriving `weekEndMs`
 * themselves. Deadlines before the anchor fold into Week 1 (weekIndexOf's own
 * clamp). Every week from index 0 through the current week is represented
 * (even with zero stories) so the release timeline stays continuous. Within
 * a week, stories sort by QA deadline ascending, tie-broken by story ID.
 */
export function bucketByWeek(
  stories: ScheduleStory[],
  anchorMs: number,
  jun29Ms: number,
  nowMs: number,
): WeekGroup[] {
  const { index: curIdx, endMs: weekEndMs } = currentWeek(nowMs, anchorMs);

  const groups: WeekGroup[] = [];
  for (let index = 0; index <= curIdx; index++) {
    const { startMs, endMs } = currentWeek(anchorMs + index * WEEK_MS, anchorMs);
    groups.push({
      index,
      label: weekLabel(index, startMs, endMs),
      startMs,
      endMs,
      isCurrent: index === curIdx,
      stories: [],
    });
  }

  for (const story of stories) {
    if (!weeklyInclude(story, jun29Ms, weekEndMs)) continue;
    // ddTs is guaranteed non-null here: weeklyInclude's 2nd check requires it.
    const index = weekIndexOf(story.ddTs as number, anchorMs);
    groups[index].stories.push(story);
  }

  for (const group of groups) {
    group.stories.sort((a, b) => {
      const diff = (a.qaTs ?? Infinity) - (b.qaTs ?? Infinity);
      return diff !== 0 ? diff : a.storyId.localeCompare(b.storyId);
    });
  }

  return groups;
}

/**
 * Up to `weeksAhead` release weeks AFTER the current one (e.g. Week 10, Week
 * 11 when the current week is Week 9) — the "Looking Ahead" preview
 * (2026-08). Same story-inclusion rules as the main timeline (baseInclude),
 * but each week is capped to ITS OWN bounds instead of "on or before the
 * current week's end" — the exact restriction bucketByWeek enforces via
 * weeklyInclude, lifted here for just these next couple of weeks.
 *
 * Unlike bucketByWeek, a future week with zero qualifying stories is
 * DROPPED entirely rather than rendered empty — "add 2 more weeks... if
 * there are any tickets under those weeks" (PM-confirmed). Deliberately a
 * separate function/output from bucketByWeek so callers can keep this
 * preview fully out of the main KPI/filter pipeline: its stories must never
 * be summed into the page's top KPI strip.
 */
export function bucketFutureWeeks(
  stories: ScheduleStory[],
  anchorMs: number,
  jun29Ms: number,
  nowMs: number,
  weeksAhead = 2,
): WeekGroup[] {
  const { index: curIdx } = currentWeek(nowMs, anchorMs);
  const groups: WeekGroup[] = [];

  for (let i = 1; i <= weeksAhead; i++) {
    const index = curIdx + i;
    const { startMs, endMs } = currentWeek(anchorMs + index * WEEK_MS, anchorMs);
    const weekStories = stories.filter(
      (s) => baseInclude(s, jun29Ms) && weekIndexOf(s.ddTs as number, anchorMs) === index,
    );
    if (weekStories.length === 0) continue;

    weekStories.sort((a, b) => {
      const diff = (a.qaTs ?? Infinity) - (b.qaTs ?? Infinity);
      return diff !== 0 ? diff : a.storyId.localeCompare(b.storyId);
    });

    groups.push({
      index,
      label: weekLabel(index, startMs, endMs),
      startMs,
      endMs,
      isCurrent: false,
      isFuture: true,
      stories: weekStories,
    });
  }

  return groups;
}
