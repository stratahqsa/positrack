/**
 * Pure JS port of dashboard/lib/health.ts's `isOverdue` (~lines 23-25) and
 * `accountability()` (~lines 82-112), including its exact
 * overdue-desc -> open-desc -> name-asc tie-break. Kept as a literal 1:1
 * mirror -- any semantic change to health.ts should be copied here too.
 * scripts/lib/overdue.test.mjs runs these functions against the SAME fixture
 * story shapes (and the same NOW_MS) used by dashboard/tests/health.test.ts
 * so the two can never silently drift apart.
 *
 * `accountability(snapshot, nowMs)` takes nowMs explicitly (mirrors health.ts's
 * own signature 1:1, which is what makes the shared-fixture test possible).
 * `mostBehind(snapshot)` is the convenience the AI-brief distiller actually
 * calls: it derives nowMs from `snapshot.meta.generated_at_ms` itself, NEVER
 * Date.now() -- the brief must describe the snapshot as of its own generation
 * time, not "now" at whatever hour the AI step happens to run.
 */

function isUnowned(assignee) {
  return !assignee || assignee.trim() === "";
}

/** Not done AND its QA deadline has already passed nowMs. Mirrors health.ts isOverdue exactly. */
export function isOverdue(story, nowMs) {
  return !story.done && story.qaTs != null && story.qaTs < nowMs;
}

/** schedule.stories with a genuinely unlinked ticket excluded (parentId
 *  null — no epic AND no parent story, e.g. PXB1-6847/6848). Mirrors
 *  dashboard/lib/health.ts::linkedStories() exactly (added there 2026-07-25,
 *  commit 4988606 -- this mirror was NOT updated at the time, which let a
 *  person's "most behind" overdue count drift from what the Health dashboard
 *  shows for the same person whenever they had an unlinked overdue story;
 *  fixed 2026-08-01). */
function linkedStories(snapshot) {
  return (snapshot.schedule?.stories ?? []).filter((story) => story.parentId != null);
}

/**
 * Snapshot-wide accountability signals: unowned (blank assignee) stories,
 * overdue stories (isOverdue, any week), re-opened stories (state contains
 * "re-open"), and open-story counts per assignee, ranked by overdue count
 * (ties broken by open count, then name) so the busiest/most-at-risk person
 * sorts first. Mirrors dashboard/lib/health.ts::accountability() exactly.
 *
 * @param {{schedule?: {stories?: Array<{done:boolean, assignee:string, qaTs:number|null, state?:string, parentId?:string|null}>}}} snapshot
 * @param {number} nowMs
 */
export function accountability(snapshot, nowMs) {
  const stories = linkedStories(snapshot);

  const byPersonMap = new Map();
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
    reopened: stories.filter((story) => (story.state ?? "").toLowerCase().includes("re-open")).length,
    byPerson,
  };
}

/**
 * Ranked "most behind" people for the AI brief: accountability().byPerson,
 * already sorted overdue -> open -> name, anchored to the snapshot's OWN
 * generated_at_ms (not wall-clock now). Callers slice however many they need.
 *
 * @param {{meta?: {generated_at_ms?: number}}} snapshot
 * @returns {{name: string, overdue: number, open: number}[]}
 */
export function mostBehind(snapshot) {
  const nowMs = snapshot.meta?.generated_at_ms;
  return accountability(snapshot, nowMs).byPerson;
}
