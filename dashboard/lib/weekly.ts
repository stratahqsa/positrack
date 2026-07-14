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
 * The Weekly Deadline inclusion filter (Examples_4 §6). The Phase-1 scope
 * filter is already applied upstream (schedule.stories only ever contains
 * Phase-1, non-excluded-epic stories — see lib/types.ts ScheduleBlock), so
 * this covers the remaining 4 checks:
 *   1. done stories are excluded unless resolved AFTER the Jun-29 cutoff
 *      (pending stories always pass this check);
 *   2. both a dev deadline and a QA deadline must be present;
 *   3. at least one of dev/UI/QA estimate must be > 0;
 *   4. the dev deadline must fall on/before the end of the currently-shown
 *      week (`weekEndMs`) — deadlines further out aren't shown yet.
 */
export function weeklyInclude(s: ScheduleStory, jun29Ms: number, weekEndMs: number): boolean {
  if (s.done && (s.resolved == null || s.resolved <= jun29Ms)) return false;
  if (s.ddTs == null || s.qaTs == null) return false;
  if (!(s.devEst > 0 || s.uiEst > 0 || s.qaEst > 0)) return false;
  if (s.ddTs > weekEndMs) return false;
  return true;
}

export interface WeekGroup {
  index: number;
  label: string;
  startMs: number;
  endMs: number;
  isCurrent: boolean;
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
