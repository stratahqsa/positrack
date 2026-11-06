import type { ScheduleStory } from "@/lib/types";
import type { EpicView } from "@/lib/release";

/**
 * Column sorting for the Release Schedule's epic and story lines. Pure (no
 * React) so the sort rules are unit-tested. Bug lines are not sortable.
 */
export type ReleaseSortKey =
  | "ticket"
  | "state"
  | "description"
  | "assignee"
  | "devEst"
  | "uiEst"
  | "qaEst"
  | "totalEst"
  | "spent"
  | "maxDevDl"
  | "maxQaDl"
  | "count";

export interface ReleaseSort {
  key: ReleaseSortKey;
  dir: "asc" | "desc";
}

/** `null` = the default (snapshot) order. */
export type ReleaseSortState = ReleaseSort | null;

/** Header click: a new column starts ascending; the same column cycles
 *  ascending -> descending -> back to the default order. */
export function nextSort(current: ReleaseSortState, key: ReleaseSortKey): ReleaseSortState {
  if (!current || current.key !== key) return { key, dir: "asc" };
  if (current.dir === "asc") return { key, dir: "desc" };
  return null;
}

type Sortable = string | number | null;

/** "PXB1-10171" -> 10171, so tickets sort numerically, not alphabetically. */
function ticketNumber(id: string): number {
  const m = /(\d+)\s*$/.exec(id);
  return m ? Number(m[1]) : Number.NaN;
}

function epicValue(e: EpicView, key: ReleaseSortKey): Sortable {
  switch (key) {
    case "ticket":
      return ticketNumber(e.id);
    case "state":
      return e.badge;
    case "description":
      return e.summary;
    case "assignee":
      return e.assignee || null;
    case "devEst":
      return e.rollup.dev;
    case "uiEst":
      return e.rollup.ui;
    case "qaEst":
      return e.rollup.qa;
    case "totalEst":
      return e.rollup.dev + e.rollup.ui + e.rollup.qa;
    case "spent":
      return e.rollup.spent;
    case "maxDevDl":
      return e.maxDevDeadlineMs;
    case "maxQaDl":
      return e.maxQaDeadlineMs;
    case "count":
      return e.stories.length;
  }
}

function storyValue(s: ScheduleStory, key: ReleaseSortKey): Sortable {
  switch (key) {
    case "ticket":
      return ticketNumber(s.storyId);
    case "state":
      return s.state || null;
    case "description":
      return s.summary;
    case "assignee":
      return s.assignee || null;
    case "devEst":
      return s.devEst;
    case "uiEst":
      return s.uiEst;
    case "qaEst":
      return s.qaEst;
    case "totalEst":
      return s.devEst + s.uiEst + s.qaEst;
    case "spent":
      return s.spent;
    case "maxDevDl":
      return s.ddTs;
    case "maxQaDl":
      return s.qaTs;
    case "count":
      return s.bugs.length;
  }
}

/** Blank / NaN values always sort last, whichever direction is chosen. */
function isBlank(v: Sortable): boolean {
  return v == null || (typeof v === "number" && Number.isNaN(v));
}

function compare(a: Sortable, b: Sortable, dir: "asc" | "desc"): number {
  const ab = isBlank(a);
  const bb = isBlank(b);
  if (ab || bb) return ab === bb ? 0 : ab ? 1 : -1;
  const cmp =
    typeof a === "string" || typeof b === "string"
      ? String(a).localeCompare(String(b), undefined, { sensitivity: "base" })
      : (a as number) - (b as number);
  return dir === "asc" ? cmp : -cmp;
}

function sortBy<T>(items: T[], sort: ReleaseSortState, value: (item: T, key: ReleaseSortKey) => Sortable): T[] {
  if (!sort) return items;
  // Array.prototype.sort is stable, so equal rows keep their default order.
  return [...items].sort((x, y) => compare(value(x, sort.key), value(y, sort.key), sort.dir));
}

export function sortEpics(epics: EpicView[], sort: ReleaseSortState): EpicView[] {
  return sortBy(epics, sort, epicValue);
}

export function sortStories(stories: ScheduleStory[], sort: ReleaseSortState): ScheduleStory[] {
  return sortBy(stories, sort, storyValue);
}
