import type { Epic, Story } from "./types";
import { epicFlags, isUnowned, overspend } from "./format";

/**
 * Client-side filtering model for the Effort view. Pure functions only — no
 * React, no DOM — so the same logic drives the filter bar, the section tables,
 * the KPI/leaderboard click-to-filter, and (de)serialization to the URL.
 *
 * Everything here is defensive: the snapshot's per-epic/story `priority`,
 * `module`, and `type` fields are OPTIONAL and absent on older snapshots. Option
 * lists are derived from whatever is actually present, and a filter dimension
 * with no available options simply never constrains anything.
 */

/** Sentinel owner value meaning "epic needs an owner" (blank OR role-parked). */
export const NEEDS_OWNER = "__needs_owner__";
/** Sentinel priority value meaning "no priority set". */
export const NO_PRIORITY = "__none__";

export type RedFilter = "needs-owner" | "overshoot" | "unestimated";

export type SortKey = "created" | "total" | "spent" | "overshoot";
export type SortDir = "asc" | "desc";

export interface SortState {
  key: SortKey;
  dir: SortDir;
}

/**
 * Full filter state. Empty arrays / null / "" all mean "no constraint on this
 * dimension". `type` is a single value: "" or "EPIC" = epic-level (no child
 * constraint); any other value constrains to epics having a child of that type.
 */
export interface FilterState {
  owners: string[];
  states: string[];
  priorities: string[];
  type: string;
  reds: RedFilter[];
  search: string;
  sort: SortState | null;
}

export const EMPTY_FILTERS: FilterState = {
  owners: [],
  states: [],
  priorities: [],
  type: "",
  reds: [],
  search: "",
  sort: null,
};

/** True when no dimension constrains the result. */
export function isFiltersEmpty(f: FilterState): boolean {
  return (
    f.owners.length === 0 &&
    f.states.length === 0 &&
    f.priorities.length === 0 &&
    !f.type &&
    f.reds.length === 0 &&
    f.search.trim() === ""
  );
}

/** Count of active *filter* dimensions (sort is not a filter). */
export function activeFilterCount(f: FilterState): number {
  return (
    f.owners.length +
    f.states.length +
    f.priorities.length +
    (f.type ? 1 : 0) +
    f.reds.length +
    (f.search.trim() ? 1 : 0)
  );
}

// ── Field accessors (defensive) ────────────────────────────────────────────

/** Normalised owner key for an epic: the real assignee, or NEEDS_OWNER. */
export function epicOwnerKey(e: Epic): string {
  return epicFlags(e).needsOwner ? NEEDS_OWNER : e.assignee.trim();
}

/** Priority option key for an epic ("" → NO_PRIORITY). */
export function epicPriorityKey(e: Epic): string {
  const p = (e.priority ?? "").trim();
  return p === "" ? NO_PRIORITY : p;
}

/** Does this story match the chosen child type? Case-insensitive. */
export function storyMatchesType(s: Story, type: string): boolean {
  if (!type || type === "EPIC") return true;
  return (s.type ?? "").trim().toUpperCase() === type.trim().toUpperCase();
}

// ── Option derivation ──────────────────────────────────────────────────────

export interface Option {
  value: string;
  label: string;
  count: number;
}

/** Canonical priority ordering for display. */
const PRIORITY_ORDER = ["Urgent", "High", "Medium", "Low"];

function priorityRank(v: string): number {
  const i = PRIORITY_ORDER.findIndex(
    (p) => p.toUpperCase() === v.toUpperCase(),
  );
  return i === -1 ? PRIORITY_ORDER.length : i;
}

/**
 * Distinct owner options across the given epics, plus a "Needs owner"
 * pseudo-option when any epic needs one. Real owners sorted alphabetically.
 */
export function ownerOptions(epics: Epic[]): Option[] {
  const counts = new Map<string, number>();
  let needs = 0;
  for (const e of epics) {
    if (epicFlags(e).needsOwner) {
      needs++;
    } else {
      const k = e.assignee.trim();
      if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  const opts: Option[] = [...counts.entries()]
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => a.label.localeCompare(b.label));
  if (needs > 0) {
    opts.unshift({ value: NEEDS_OWNER, label: "Needs owner", count: needs });
  }
  return opts;
}

/** Distinct epic-state options present, alphabetical. */
export function stateOptions(epics: Epic[]): Option[] {
  const counts = new Map<string, number>();
  for (const e of epics) {
    const k = e.epic_state?.trim();
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Priority options present (epic-level), ranked Urgent→High→Medium→Low then
 * any unknown labels, then "(none)". Empty when no epic carries a priority —
 * callers should hide the Priority control in that case.
 */
export function priorityOptions(epics: Epic[]): Option[] {
  const counts = new Map<string, number>();
  let anyPresent = false;
  for (const e of epics) {
    if (e.priority === undefined) continue;
    anyPresent = true;
    const k = epicPriorityKey(e);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  if (!anyPresent) return [];
  return [...counts.entries()]
    .map(([value, count]) => ({
      value,
      label: value === NO_PRIORITY ? "(none)" : value,
      count,
    }))
    .sort((a, b) => {
      if (a.value === NO_PRIORITY) return 1;
      if (b.value === NO_PRIORITY) return -1;
      return priorityRank(a.value) - priorityRank(b.value);
    });
}

/**
 * Child-type options present across all stories. Empty when no story carries a
 * `type` (older snapshots) — callers should hide the Type control then. The
 * "Epic" (all) choice is represented by the empty selection, not an option here.
 */
export function typeOptions(epics: Epic[]): Option[] {
  const counts = new Map<string, number>();
  for (const e of epics) {
    for (const s of e.stories ?? []) {
      if (s.type === undefined) continue;
      const k = s.type.trim().toUpperCase();
      if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: titleCase(value), count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function titleCase(v: string): string {
  // "QA & AUTOMATION" → "QA & Automation"; "STORY" → "Story"; keep "UI"/"QA".
  return v
    .split(" ")
    .map((w) =>
      w.length <= 2
        ? w
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join(" ");
}

// ── Matching ───────────────────────────────────────────────────────────────

function matchesSearch(e: Epic, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  if (
    e.id.toLowerCase().includes(needle) ||
    e.summary.toLowerCase().includes(needle)
  ) {
    return true;
  }
  for (const s of e.stories ?? []) {
    if (
      s.id.toLowerCase().includes(needle) ||
      s.summary.toLowerCase().includes(needle)
    ) {
      return true;
    }
  }
  return false;
}

function matchesRed(e: Epic, reds: RedFilter[]): boolean {
  if (reds.length === 0) return true;
  const f = epicFlags(e);
  // OR across the selected RED conditions.
  return reds.some((r) => {
    if (r === "needs-owner") return f.needsOwner;
    if (r === "overshoot") return f.overshoot;
    return f.missingEst; // "unestimated"
  });
}

/** Does the epic pass every active filter dimension? */
export function epicMatches(e: Epic, f: FilterState): boolean {
  if (f.owners.length && !f.owners.includes(epicOwnerKey(e))) return false;
  if (f.states.length && !f.states.includes(e.epic_state?.trim())) return false;
  if (f.priorities.length && !f.priorities.includes(epicPriorityKey(e)))
    return false;
  if (f.type && f.type !== "EPIC") {
    const hasChild = (e.stories ?? []).some((s) => storyMatchesType(s, f.type));
    if (!hasChild) return false;
  }
  if (!matchesRed(e, f.reds)) return false;
  if (!matchesSearch(e, f.search.trim())) return false;
  return true;
}

/** Apply all filters to an epic list (preserves input order). */
export function filterEpics(epics: Epic[], f: FilterState): Epic[] {
  return epics.filter((e) => epicMatches(e, f));
}

// ── Sorting ────────────────────────────────────────────────────────────────

function sortValue(e: Epic, key: SortKey): number {
  switch (key) {
    case "created":
      return e.created ?? 0;
    case "total":
      return e.total ?? 0;
    case "spent":
      return e.spent ?? 0;
    case "overshoot":
      return overspend(e);
  }
}

/** Stable sort of epics by the given sort state (no-op when null). */
export function sortEpics(epics: Epic[], sort: SortState | null): Epic[] {
  if (!sort) return epics;
  const dir = sort.dir === "asc" ? 1 : -1;
  return epics
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      const d = sortValue(a.e, sort.key) - sortValue(b.e, sort.key);
      return d !== 0 ? d * dir : a.i - b.i; // stable tie-break
    })
    .map((x) => x.e);
}

/** Filter then sort in one pass. */
export function selectEpics(epics: Epic[], f: FilterState): Epic[] {
  return sortEpics(filterEpics(epics, f), f.sort);
}

// ── URL (de)serialization ──────────────────────────────────────────────────
//
// Compact, human-legible query params. Multi-select dimensions are
// comma-joined; the search box is `q`; sort is `sort=<key>.<dir>`. Absent params
// mean "no constraint", so a clean URL yields EMPTY_FILTERS.

const SEP = ",";

export function filtersToParams(f: FilterState): URLSearchParams {
  const p = new URLSearchParams();
  if (f.owners.length) p.set("owner", f.owners.join(SEP));
  if (f.states.length) p.set("state", f.states.join(SEP));
  if (f.priorities.length) p.set("prio", f.priorities.join(SEP));
  if (f.type) p.set("type", f.type);
  if (f.reds.length) p.set("red", f.reds.join(SEP));
  if (f.search.trim()) p.set("q", f.search.trim());
  if (f.sort) p.set("sort", `${f.sort.key}.${f.sort.dir}`);
  return p;
}

/** Serialize just the filter state to a query string (no leading "?"). */
export function filtersToQuery(f: FilterState): string {
  return filtersToParams(f).toString();
}

const RED_VALUES: RedFilter[] = ["needs-owner", "overshoot", "unestimated"];
const SORT_KEYS: SortKey[] = ["created", "total", "spent", "overshoot"];

function splitList(v: string | null): string[] {
  if (!v) return [];
  return v
    .split(SEP)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parse filter state from URL params, ignoring anything malformed. */
export function filtersFromParams(
  p: URLSearchParams | ReadonlyURLSearchParamsLike,
): FilterState {
  const get = (k: string) => p.get(k);
  const reds = splitList(get("red")).filter((r): r is RedFilter =>
    (RED_VALUES as string[]).includes(r),
  );
  let sort: SortState | null = null;
  const rawSort = get("sort");
  if (rawSort) {
    const [key, dir] = rawSort.split(".");
    if ((SORT_KEYS as string[]).includes(key)) {
      sort = { key: key as SortKey, dir: dir === "asc" ? "asc" : "desc" };
    }
  }
  return {
    owners: splitList(get("owner")),
    states: splitList(get("state")),
    priorities: splitList(get("prio")),
    type: get("type") ?? "",
    reds,
    search: get("q") ?? "",
    sort,
  };
}

/** Minimal read-only shape shared by Next's ReadonlyURLSearchParams. */
interface ReadonlyURLSearchParamsLike {
  get(name: string): string | null;
}

// ── Chip descriptors (for the active-filter chip row) ──────────────────────

export interface Chip {
  /** Stable key for React + for the remove handler to target. */
  key: string;
  label: string;
  /** Which dimension + which value to drop when the chip's × is clicked. */
  dim: "owner" | "state" | "priority" | "type" | "red" | "search";
  value: string;
}

const RED_LABEL: Record<RedFilter, string> = {
  "needs-owner": "Needs owner",
  overshoot: "Overshoot",
  unestimated: "Unestimated",
};

/** Build the list of active-filter chips in a stable, readable order. */
export function filterChips(f: FilterState): Chip[] {
  const chips: Chip[] = [];
  for (const v of f.owners) {
    chips.push({
      key: `owner:${v}`,
      dim: "owner",
      value: v,
      label: v === NEEDS_OWNER ? "Owner: Needs owner" : `Owner: ${v}`,
    });
  }
  for (const v of f.states) {
    chips.push({ key: `state:${v}`, dim: "state", value: v, label: `State: ${v}` });
  }
  for (const v of f.priorities) {
    chips.push({
      key: `prio:${v}`,
      dim: "priority",
      value: v,
      label: `Priority: ${v === NO_PRIORITY ? "(none)" : v}`,
    });
  }
  if (f.type && f.type !== "EPIC") {
    chips.push({
      key: `type:${f.type}`,
      dim: "type",
      value: f.type,
      label: `Type: ${titleCase(f.type)}`,
    });
  }
  for (const v of f.reds) {
    chips.push({
      key: `red:${v}`,
      dim: "red",
      value: v,
      label: `RED: ${RED_LABEL[v]}`,
    });
  }
  if (f.search.trim()) {
    chips.push({
      key: "search",
      dim: "search",
      value: f.search.trim(),
      label: `Search: "${f.search.trim()}"`,
    });
  }
  return chips;
}
