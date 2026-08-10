"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Bug, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtHours, fmtMd, verdictVsQa } from "@/lib/format";
import type { DrillBug, ScheduleStory } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { IssueLink } from "@/components/ui/issue-link";
import { priorityVariant, stateVariant } from "@/components/weekly/badge-tone";

type SortKey =
  | "storyId"
  | "summary"
  | "state"
  | "created"
  | "assignee"
  | "sprint"
  | "epic"
  | "devEst"
  | "uiEst"
  | "qaEst"
  | "totalEst"
  | "spent"
  | "ddTs"
  | "qaTs"
  | "resolved";
type SortDir = "asc" | "desc";
interface SortState {
  key: SortKey;
  dir: SortDir;
}

/** PRD_4 §6: "Default sort: QA Deadline ascending." Callers that need a
 *  different default (e.g. Android's created-date sort) pass their own via
 *  the `defaultSort` prop; this stays the fallback for Weekly Deadline. */
const DEFAULT_SORT: SortState = { key: "qaTs", dir: "asc" };

type Column = { key: SortKey; label: string; align?: "right"; tint?: boolean };

const BASE_COLUMNS: Column[] = [
  { key: "storyId", label: "Story" },
  { key: "summary", label: "Summary" },
  { key: "state", label: "State" },
  { key: "assignee", label: "Assignee" },
  { key: "sprint", label: "Sprint" },
  { key: "epic", label: "Epic" },
  { key: "devEst", label: "Dev", align: "right" },
  { key: "uiEst", label: "UI", align: "right" },
  { key: "qaEst", label: "QA", align: "right" },
  { key: "totalEst", label: "Total Est", align: "right" },
  { key: "spent", label: "Spent", align: "right", tint: true },
  { key: "ddTs", label: "Dev DL" },
  { key: "qaTs", label: "QA DL" },
  { key: "resolved", label: "Resolved" },
];
const CREATED_COLUMN: Column = { key: "created", label: "Created" };

/** Created is opt-in (`showCreated`) — inserted right after State, before
 *  Assignee. Weekly Deadline doesn't request it, so its column set/width is
 *  unchanged; Android does (its stories have no meaningful default sort key
 *  like QA Deadline, so "how long has this been open" is the useful lead
 *  signal). */
function buildColumns(showCreated: boolean): Column[] {
  if (!showCreated) return BASE_COLUMNS;
  const idx = BASE_COLUMNS.findIndex((c) => c.key === "assignee");
  return [...BASE_COLUMNS.slice(0, idx), CREATED_COLUMN, ...BASE_COLUMNS.slice(idx)];
}

/**
 * The epic a story rolls up to, for display/linking. `epicId` is scope-gated
 * upstream (scripts/reports/schedule.py's match_epics() only sets it when
 * the parent epic is ALSO in the current Phase-1-scope epic fetch) — an
 * epic that's since drifted to Phase 2/3 (because one of ITS pending
 * stories moved) drops out of that fetch, leaving `epicId` null even though
 * the story's own parent link is intact. `parentId` is captured
 * unconditionally, so it's the fallback here — this is what makes a
 * scope-drifted epic still show up (as a bare ticket id, since its title
 * isn't in `epicNames` either) instead of a blank cell (2026-07-25).
 */
function resolveEpic(
  story: ScheduleStory,
  epicNames: Record<string, string>,
): { id: string | null; label: string } {
  const id = story.epicId ?? story.parentId;
  const label = (id ? epicNames[id] : null) ?? id ?? "—";
  return { id, label };
}

function sortValue(
  s: ScheduleStory,
  key: SortKey,
  epicNames: Record<string, string>,
): string | number | null {
  switch (key) {
    case "storyId":
      return s.storyId;
    case "summary":
      return s.summary ?? "";
    case "state":
      return s.state ?? "";
    case "created":
      return s.created;
    case "assignee":
      return s.assignee || null;
    case "sprint":
      return s.sprint || null;
    case "epic": {
      const r = resolveEpic(s, epicNames);
      return r.id ? r.label : null;
    }
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
    case "ddTs":
      return s.ddTs;
    case "qaTs":
      return s.qaTs;
    case "resolved":
      return s.resolved;
  }
}

/** Nulls always sort last regardless of direction (missing data sinks, it
 *  never jumps to the top just because the direction flipped to desc). */
function compare(a: string | number | null, b: string | number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "string" || typeof b === "string") return String(a).localeCompare(String(b));
  return a - b;
}

function sortStories(
  stories: ScheduleStory[],
  sort: SortState,
  epicNames: Record<string, string>,
): ScheduleStory[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...stories].sort((a, b) => {
    const cmp = compare(sortValue(a, sort.key, epicNames), sortValue(b, sort.key, epicNames));
    // Stable tie-break by story ID — matches lib/weekly.ts's bucketByWeek
    // convention, so equal-value rows don't visibly jitter between renders.
    return cmp !== 0 ? sign * cmp : a.storyId.localeCompare(b.storyId);
  });
}

function computeTotals(stories: ScheduleStory[]) {
  return stories.reduce(
    (acc, s) => ({
      devEst: acc.devEst + s.devEst,
      uiEst: acc.uiEst + s.uiEst,
      qaEst: acc.qaEst + s.qaEst,
      spent: acc.spent + s.spent,
    }),
    { devEst: 0, uiEst: 0, qaEst: 0, spent: 0 },
  );
}

function Th({
  label,
  sortKey,
  align,
  tint,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  align?: "right";
  tint?: boolean;
  sort: SortState;
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <th className={cn("px-2 py-2 text-[10px] font-semibold uppercase tracking-wide", align === "right" && "text-right")}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}${active ? ` (${sort.dir === "asc" ? "ascending" : "descending"})` : ""}`}
        className={cn(
          "inline-flex items-center gap-1 rounded transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
          align === "right" && "flex-row-reverse",
          active ? "text-accent" : tint ? "text-violet/80" : "text-faint",
        )}
      >
        {label}
        {active ? (
          sort.dir === "asc" ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : (
          <ArrowUpDown className="size-3 opacity-40" />
        )}
      </button>
    </th>
  );
}

function StoryRow({
  story,
  epicId,
  epicLabel,
  expanded,
  canExpand,
  onToggle,
  showCreated,
}: {
  story: ScheduleStory;
  epicId: string | null;
  epicLabel: string;
  expanded: boolean;
  canExpand: boolean;
  onToggle: () => void;
  showCreated: boolean;
}) {
  const isReopen = !story.done && (story.state ?? "").toLowerCase().includes("re-open");
  const verdict = verdictVsQa(story.resolved, story.qaTs);
  const openBugCount = story.bugs.filter((b) => !b.done).length;

  return (
    <tr
      className={cn(
        "border-t border-border/50 text-[12px] transition-colors",
        story.done
          ? "bg-good/[0.06] hover:bg-good/[0.1]"
          : isReopen
            ? "bg-danger/[0.06] hover:bg-danger/[0.1]"
            : "hover:bg-elevated/40",
      )}
    >
      <td className="whitespace-nowrap px-2 py-2 align-top">
        <div className="flex items-center gap-1.5">
          {canExpand ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-label={`${expanded ? "Collapse" : "Expand"} bugs for ${story.storyId}`}
              className={cn(
                "inline-flex items-center gap-0.5 rounded px-1 py-0.5 transition-colors",
                openBugCount > 0 ? "text-danger/90 hover:bg-danger/10" : "text-muted hover:bg-elevated/60",
              )}
            >
              <Bug className="size-3.5" />
              <span className="tabular text-[10.5px] font-semibold">{openBugCount}</span>
              <ChevronRight className={cn("size-3 transition-transform", expanded && "rotate-90")} />
            </button>
          ) : null}
          <IssueLink id={story.storyId} showIcon={false} />
        </div>
      </td>
      <td className="max-w-[260px] px-2 py-2 align-top">
        <span className="line-clamp-2 text-fg/85">{story.summary}</span>
      </td>
      <td className="px-2 py-2 align-top">
        <Badge variant={stateVariant(story.state, story.done)} size="sm">
          {story.state || "—"}
        </Badge>
      </td>
      {showCreated ? (
        <td className="whitespace-nowrap px-2 py-2 align-top text-muted">{fmtDate(story.created)}</td>
      ) : null}
      <td className="px-2 py-2 align-top text-fg/80">
        {story.assignee || <span className="text-faint">—</span>}
      </td>
      <td className="px-2 py-2 align-top text-muted">
        {story.sprint || <span className="text-faint">—</span>}
      </td>
      <td className="max-w-[180px] px-2 py-2 align-top">
        {epicId ? (
          <div className="flex flex-col gap-0.5">
            <IssueLink id={epicId} showIcon={false} />
            {epicLabel !== epicId ? (
              <span className="line-clamp-2 text-[11px] text-muted">{epicLabel}</span>
            ) : null}
          </div>
        ) : (
          <span className="text-faint">—</span>
        )}
      </td>
      <td className="px-2 py-2 text-right tabular align-top">{fmtHours(story.devEst)}</td>
      <td className="px-2 py-2 text-right tabular align-top">{fmtHours(story.uiEst)}</td>
      <td className="px-2 py-2 text-right tabular align-top">{fmtHours(story.qaEst)}</td>
      <td className="px-2 py-2 text-right tabular align-top">
        {fmtHours(story.devEst + story.uiEst + story.qaEst)}
      </td>
      <td className="px-2 py-2 text-right tabular align-top">{fmtHours(story.spent)}</td>
      <td className="whitespace-nowrap px-2 py-2 align-top text-muted">{fmtDate(story.ddTs)}</td>
      <td className="whitespace-nowrap px-2 py-2 align-top text-muted">{fmtDate(story.qaTs)}</td>
      <td className="whitespace-nowrap px-2 py-2 align-top">
        {story.resolved != null ? (
          <div className="flex items-center gap-1.5">
            <span className="text-fg/80">{fmtDate(story.resolved)}</span>
            {verdict ? (
              <Badge variant={verdict.late ? "danger" : "good"} size="sm">
                {verdict.label}
              </Badge>
            ) : null}
          </div>
        ) : (
          <span className="text-faint">—</span>
        )}
      </td>
    </tr>
  );
}

/** Most callers' bugs are always open (Weekly Deadline's RE-OPEN drill-down
 *  only ever fetches open bugs — Examples_4 §8), but Android's drill-down
 *  keeps resolved/done bugs too (same as the standalone skill report), so
 *  this branches on `bug.done` — absent/false renders exactly as before. */
function BugRow({ bug, columnCount }: { bug: DrillBug; columnCount: number }) {
  const done = bug.done ?? false;
  return (
    <tr className={cn("border-t border-border/30 text-[11.5px]", done ? "bg-good/[0.03]" : "bg-danger/[0.03]")}>
      <td colSpan={columnCount} className="py-0">
        <div
          className={cn(
            "flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 py-1.5 pl-6 pr-2",
            done ? "border-good/40" : "border-danger/40",
          )}
        >
          <Bug className={cn("size-3 shrink-0", done ? "text-good/70" : "text-danger/70")} />
          <IssueLink id={bug.bugId} showIcon={false} className="text-[11.5px]" />
          <span className="min-w-0 flex-1 truncate text-fg/70">{bug.summary}</span>
          <Badge variant={stateVariant(bug.state, done)} size="sm">
            {bug.state || "—"}
          </Badge>
          <span className="text-muted">{bug.assignee || "—"}</span>
          <Badge variant={priorityVariant(bug.priority)} size="sm">
            {bug.priority || "—"}
          </Badge>
          <span className="inline-flex items-center gap-1 text-faint">
            dev <IssueLink id={bug.devTicketId} showIcon={false} className="text-[11px]" />
          </span>
        </div>
      </td>
    </tr>
  );
}

/** Nested toggle at the bottom of a story's expanded bug list — resolved
 *  bugs stay hidden until this is clicked, same as the standalone skill
 *  report (open bugs are the default/primary signal; resolved history is
 *  opt-in, not shown automatically). */
function ShowResolvedRow({
  count,
  expanded,
  onToggle,
  columnCount,
}: {
  count: number;
  expanded: boolean;
  onToggle: () => void;
  columnCount: number;
}) {
  return (
    <tr className="border-t border-border/30 bg-elevated/20 text-[11.5px]">
      <td colSpan={columnCount} className="py-0">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex w-full items-center gap-1.5 border-l-2 border-border-strong py-1.5 pl-6 pr-2 text-muted transition-colors hover:text-fg"
        >
          <ChevronRight className={cn("size-3 shrink-0 transition-transform", expanded && "rotate-90")} />
          {expanded ? "Hide" : "Show"} {count} resolved bug{count === 1 ? "" : "s"}
        </button>
      </td>
    </tr>
  );
}

function TotalsRow({
  totals,
  labelColSpan,
}: {
  totals: { devEst: number; uiEst: number; qaEst: number; spent: number };
  labelColSpan: number;
}) {
  return (
    <tr className="border-t-2 border-border-strong bg-elevated/60 text-[12px] font-semibold">
      <td className="px-2 py-2 text-fg/90" colSpan={labelColSpan}>
        Totals
      </td>
      <td className="px-2 py-2 text-right tabular">{fmtHours(totals.devEst)}</td>
      <td className="px-2 py-2 text-right tabular">{fmtHours(totals.uiEst)}</td>
      <td className="px-2 py-2 text-right tabular">{fmtHours(totals.qaEst)}</td>
      <td className="px-2 py-2 text-right tabular">
        {fmtHours(totals.devEst + totals.uiEst + totals.qaEst)}
      </td>
      <td className="px-2 py-2 text-right tabular">{fmtHours(totals.spent)}</td>
      <td className="px-2 py-2 font-normal text-[10.5px] text-faint" colSpan={3}>
        {fmtMd(totals.devEst + totals.uiEst + totals.qaEst)} total effort
      </td>
    </tr>
  );
}

/**
 * The 14-column sortable Weekly Deadline story table (docs/reports-dashboard/
 * plans/03-weekly-deadline-filters.md Task 5) — the critical interaction.
 *
 * Architecture: `rows` is ONE array of story objects in component state (each
 * already carrying its own `bugs[]`); there is no parallel/separate state for
 * bug rows. `<tbody>` is built by mapping that single sorted array — for each
 * story, its `<tr>` is rendered and, immediately after it in the SAME map
 * iteration (via a keyed React.Fragment), its bug `<tr>`s render if expanded.
 * That's what keeps a story's bug rows structurally attached to it: they're
 * never a separate list that has to be kept in sync, they're produced by the
 * very same iteration step that produces the story row. Sorting mutates only
 * `sort`/`rows` state (re-sorting the whole array with the new comparator) —
 * the DOM is never touched directly — so React just re-renders the table
 * from the new array order, bug rows and all, with the totals row emitted
 * once after the map so it's always last.
 *
 * `rows` starts as `stories` (sorted with the default comparator) and is kept
 * in sync via an effect keyed on the `stories`/`epicNames` props: when the
 * global filter bar changes the URL, the server re-renders this week's
 * `stories` prop, and the effect re-sorts the NEW set with whatever sort the
 * user currently has active (React doesn't auto-reinitialize useState from
 * changed props at the same tree position, so without this the table would
 * keep showing stale rows after a filter change).
 */
export function StoryTable({
  stories,
  epicNames,
  defaultSort,
  showCreated = false,
}: {
  stories: ScheduleStory[];
  epicNames: Record<string, string>;
  /** Overrides DEFAULT_SORT (QA Deadline ascending). Omit to keep Weekly
   *  Deadline's PRD-mandated default unchanged. */
  defaultSort?: SortState;
  /** Inserts a Created column after State. Off by default (Weekly Deadline
   *  doesn't request it). */
  showCreated?: boolean;
}) {
  const initialSort = defaultSort ?? DEFAULT_SORT;
  const columns = React.useMemo(() => buildColumns(showCreated), [showCreated]);
  const [sort, setSort] = React.useState<SortState>(initialSort);
  const [rows, setRows] = React.useState<ScheduleStory[]>(() =>
    sortStories(stories, initialSort, epicNames),
  );
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
  const [resolvedExpanded, setResolvedExpanded] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    setRows(sortStories(stories, sort, epicNames));
    // Intentionally NOT depending on `sort`: sort changes are applied
    // directly in handleSort below. Depending on it here too would just
    // re-run this same re-sort redundantly on every header click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stories, epicNames]);

  function handleSort(key: SortKey) {
    const dir: SortDir = sort.key === key && sort.dir === "asc" ? "desc" : "asc";
    const next: SortState = { key, dir };
    setSort(next);
    setRows((prev) => sortStories(prev, next, epicNames));
  }

  function toggleExpanded(storyId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(storyId)) next.delete(storyId);
      else next.add(storyId);
      return next;
    });
  }

  function toggleResolvedExpanded(storyId: string) {
    setResolvedExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(storyId)) next.delete(storyId);
      else next.add(storyId);
      return next;
    });
  }

  const totals = React.useMemo(() => computeTotals(stories), [stories]);

  if (stories.length === 0) {
    return <div className="px-4 py-6 text-center text-[12px] text-faint">No stories due this week.</div>;
  }

  return (
    <div className="overflow-x-auto scroll-slim">
      <table className="w-full min-w-[1260px] border-collapse">
        <thead className="sticky top-0 z-10 bg-surface-2/95 backdrop-blur">
          <tr>
            {columns.map((c) => (
              <Th
                key={c.key}
                label={c.label}
                sortKey={c.key}
                align={c.align}
                tint={c.tint}
                sort={sort}
                onSort={handleSort}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((story) => {
            const isExpanded = expanded.has(story.storyId);
            const canExpand = story.bugs.length > 0;
            const { id: epicId, label: epicLabel } = resolveEpic(story, epicNames);
            return (
              <React.Fragment key={story.storyId}>
                <StoryRow
                  story={story}
                  epicId={epicId}
                  epicLabel={epicLabel}
                  expanded={isExpanded}
                  canExpand={canExpand}
                  onToggle={() => toggleExpanded(story.storyId)}
                  showCreated={showCreated}
                />
                {isExpanded && canExpand ? (
                  <>
                    {story.bugs
                      .filter((b) => !b.done)
                      .map((bug) => (
                        <BugRow key={bug.bugId} bug={bug} columnCount={columns.length} />
                      ))}
                    {(() => {
                      const resolvedBugs = story.bugs.filter((b) => b.done);
                      if (resolvedBugs.length === 0) return null;
                      const showResolved = resolvedExpanded.has(story.storyId);
                      return (
                        <React.Fragment key="resolved">
                          <ShowResolvedRow
                            count={resolvedBugs.length}
                            expanded={showResolved}
                            onToggle={() => toggleResolvedExpanded(story.storyId)}
                            columnCount={columns.length}
                          />
                          {showResolved
                            ? resolvedBugs.map((bug) => (
                                <BugRow key={bug.bugId} bug={bug} columnCount={columns.length} />
                              ))
                            : null}
                        </React.Fragment>
                      );
                    })()}
                  </>
                ) : null}
              </React.Fragment>
            );
          })}
          <TotalsRow totals={totals} labelColSpan={showCreated ? 7 : 6} />
        </tbody>
      </table>
    </div>
  );
}
