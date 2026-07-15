/**
 * URL-based global filter model shared by every report view. Filter state
 * lives in the URL search params (shareable + persistent across views +
 * server-readable) — this module is the pure parse/serialize/apply/derive
 * layer; no I/O, no React. See docs/reports-dashboard/plans/
 * 03-weekly-deadline-filters.md Task 3.
 */
import type { ScheduleStory } from "./types";

export interface Filters {
  assignee: string[];
  sprint: string[];
  state: string[];
  epic: string[];
  week: number[];
  pendingOnly: boolean;
  overdueOnly: boolean;
  reopenedOnly: boolean;
}

export const EMPTY_FILTERS: Filters = {
  assignee: [],
  sprint: [],
  state: [],
  epic: [],
  week: [],
  pendingOnly: false,
  overdueOnly: false,
  reopenedOnly: false,
};

/**
 * Accepts either a client `URLSearchParams` (from `useSearchParams()`) or the
 * Next.js server `searchParams` prop shape (`string | string[] | undefined`
 * per key) — both encode "repeat the key for multiple values", which is how
 * `toQueryString` emits multi-select dimensions.
 */
type FiltersSearchParams = URLSearchParams | Record<string, string | string[] | undefined>;

function getAll(sp: FiltersSearchParams, key: string): string[] {
  if (sp instanceof URLSearchParams) return sp.getAll(key);
  const value = sp[key];
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/** URL search params -> Filters. Inverse of `toQueryString`. */
export function parseFilters(sp: FiltersSearchParams): Filters {
  return {
    assignee: getAll(sp, "assignee"),
    sprint: getAll(sp, "sprint"),
    state: getAll(sp, "state"),
    epic: getAll(sp, "epic"),
    week: getAll(sp, "week")
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n)),
    pendingOnly: getAll(sp, "pendingOnly").length > 0,
    overdueOnly: getAll(sp, "overdueOnly").length > 0,
    reopenedOnly: getAll(sp, "reopenedOnly").length > 0,
  };
}

/** Filters -> query string (no leading "?"). Omits empty keys. Inverse of `parseFilters`. */
export function toQueryString(f: Filters): string {
  const params = new URLSearchParams();
  for (const v of f.assignee) params.append("assignee", v);
  for (const v of f.sprint) params.append("sprint", v);
  for (const v of f.state) params.append("state", v);
  for (const v of f.epic) params.append("epic", v);
  for (const v of f.week) params.append("week", String(v));
  if (f.pendingOnly) params.append("pendingOnly", "1");
  if (f.overdueOnly) params.append("overdueOnly", "1");
  if (f.reopenedOnly) params.append("reopenedOnly", "1");
  return params.toString();
}

function matchesDim(selected: string[], value: string | null): boolean {
  if (selected.length === 0) return true;
  return value != null && selected.includes(value);
}

/**
 * AND across dimensions, OR within a dimension: a story must match at least
 * one selected value in EVERY non-empty dimension, and every active toggle.
 * Dimensions checked: assignee, sprint, state, epic (against `epicId`). The
 * `week` dimension is intentionally NOT applied here — it filters which
 * week *groups* are shown after `bucketByWeek`, not individual stories (this
 * function has no `anchorMs` to derive a story's week index from).
 */
export function applyFilters(stories: ScheduleStory[], f: Filters, nowMs: number): ScheduleStory[] {
  return stories.filter((s) => {
    if (!matchesDim(f.assignee, s.assignee)) return false;
    if (!matchesDim(f.sprint, s.sprint)) return false;
    if (!matchesDim(f.state, s.state)) return false;
    if (!matchesDim(f.epic, s.epicId)) return false;
    if (f.pendingOnly && s.done) return false;
    if (f.overdueOnly && !(!s.done && s.qaTs != null && s.qaTs < nowMs)) return false;
    if (f.reopenedOnly && !(s.state ?? "").toLowerCase().includes("re-open")) return false;
    return true;
  });
}

function sortedUnique(values: (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const v of values) {
    if (v != null && v !== "") set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** Sorted, deduped, non-empty option lists for the filter-bar dropdowns. */
export function deriveFilterOptions(stories: ScheduleStory[]): {
  assignee: string[];
  sprint: string[];
  state: string[];
  epic: string[];
} {
  return {
    assignee: sortedUnique(stories.map((s) => s.assignee)),
    sprint: sortedUnique(stories.map((s) => s.sprint)),
    state: sortedUnique(stories.map((s) => s.state)),
    epic: sortedUnique(stories.map((s) => s.epicId)),
  };
}

/**
 * Number of active filter controls (one per non-empty dimension — regardless
 * of how many values are selected within it — plus one per active toggle).
 * Drives the filter bar's "N filters active" / Clear-all affordance.
 */
export function activeFilterCount(f: Filters): number {
  let count = 0;
  if (f.assignee.length > 0) count++;
  if (f.sprint.length > 0) count++;
  if (f.state.length > 0) count++;
  if (f.epic.length > 0) count++;
  if (f.week.length > 0) count++;
  if (f.pendingOnly) count++;
  if (f.overdueOnly) count++;
  if (f.reopenedOnly) count++;
  return count;
}
