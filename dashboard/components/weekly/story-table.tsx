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
  | "assignee"
  | "sprint"
  | "epic"
  | "devEst"
  | "uiEst"
  | "qaEst"
  | "spent"
  | "ddTs"
  | "qaTs"
  | "resolved";
type SortDir = "asc" | "desc";
interface SortState {
  key: SortKey;
  dir: SortDir;
}

/** PRD_4 §6: "Default sort: QA Deadline ascending." */
const DEFAULT_SORT: SortState = { key: "qaTs", dir: "asc" };

const COLUMNS: { key: SortKey; label: string; align?: "right"; tint?: boolean }[] = [
  { key: "storyId", label: "Story" },
  { key: "summary", label: "Summary" },
  { key: "state", label: "State" },
  { key: "assignee", label: "Assignee" },
  { key: "sprint", label: "Sprint" },
  { key: "epic", label: "Epic" },
  { key: "devEst", label: "Dev", align: "right" },
  { key: "uiEst", label: "UI", align: "right" },
  { key: "qaEst", label: "QA", align: "right" },
  { key: "spent", label: "Spent", align: "right", tint: true },
  { key: "ddTs", label: "Dev DL" },
  { key: "qaTs", label: "QA DL" },
  { key: "resolved", label: "Resolved" },
];
const COLUMN_COUNT = COLUMNS.length;

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
    case "assignee":
      return s.assignee || null;
    case "sprint":
      return s.sprint || null;
    case "epic":
      return (s.epicId ? epicNames[s.epicId] : null) ?? s.epicId ?? null;
    case "devEst":
      return s.devEst;
    case "uiEst":
      return s.uiEst;
    case "qaEst":
      return s.qaEst;
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
  epicLabel,
  expanded,
  canExpand,
  onToggle,
}: {
  story: ScheduleStory;
  epicLabel: string;
  expanded: boolean;
  canExpand: boolean;
  onToggle: () => void;
}) {
  const isReopen = !story.done && (story.state ?? "").toLowerCase().includes("re-open");
  const verdict = verdictVsQa(story.resolved, story.qaTs);

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
              aria-label={`${expanded ? "Collapse" : "Expand"} ${story.bugs.length} open bug${story.bugs.length === 1 ? "" : "s"} for ${story.storyId}`}
              className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-danger/90 transition-colors hover:bg-danger/10"
            >
              <Bug className="size-3.5" />
              <span className="tabular text-[10.5px] font-semibold">{story.bugs.length}</span>
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
      <td className="px-2 py-2 align-top text-fg/80">
        {story.assignee || <span className="text-faint">—</span>}
      </td>
      <td className="px-2 py-2 align-top text-muted">
        {story.sprint || <span className="text-faint">—</span>}
      </td>
      <td className="max-w-[160px] px-2 py-2 align-top">
        <span className="line-clamp-2 text-muted" title={story.epicId ?? undefined}>
          {epicLabel}
        </span>
      </td>
      <td className="px-2 py-2 text-right tabular align-top">{fmtHours(story.devEst)}</td>
      <td className="px-2 py-2 text-right tabular align-top">{fmtHours(story.uiEst)}</td>
      <td className="px-2 py-2 text-right tabular align-top">{fmtHours(story.qaEst)}</td>
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

/** DrillBug rows are always open (the upstream drill-down keeps open bugs
 *  only — Examples_4 §8), so there's no "done" state to consider here. */
function BugRow({ bug }: { bug: DrillBug }) {
  return (
    <tr className="border-t border-border/30 bg-danger/[0.03] text-[11.5px]">
      <td colSpan={COLUMN_COUNT} className="py-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 border-danger/40 py-1.5 pl-6 pr-2">
          <Bug className="size-3 shrink-0 text-danger/70" />
          <IssueLink id={bug.bugId} showIcon={false} className="text-[11.5px]" />
          <span className="min-w-0 flex-1 truncate text-fg/70">{bug.summary}</span>
          <Badge variant={stateVariant(bug.state, false)} size="sm">
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

function TotalsRow({
  totals,
}: {
  totals: { devEst: number; uiEst: number; qaEst: number; spent: number };
}) {
  return (
    <tr className="border-t-2 border-border-strong bg-elevated/60 text-[12px] font-semibold">
      <td className="px-2 py-2 text-fg/90" colSpan={6}>
        Totals
      </td>
      <td className="px-2 py-2 text-right tabular">{fmtHours(totals.devEst)}</td>
      <td className="px-2 py-2 text-right tabular">{fmtHours(totals.uiEst)}</td>
      <td className="px-2 py-2 text-right tabular">{fmtHours(totals.qaEst)}</td>
      <td className="px-2 py-2 text-right tabular">{fmtHours(totals.spent)}</td>
      <td className="px-2 py-2 font-normal text-[10.5px] text-faint" colSpan={3}>
        {fmtMd(totals.devEst + totals.uiEst + totals.qaEst)} total effort
      </td>
    </tr>
  );
}

/**
 * The 13-column sortable Weekly Deadline story table (docs/reports-dashboard/
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
}: {
  stories: ScheduleStory[];
  epicNames: Record<string, string>;
}) {
  const [sort, setSort] = React.useState<SortState>(DEFAULT_SORT);
  const [rows, setRows] = React.useState<ScheduleStory[]>(() =>
    sortStories(stories, DEFAULT_SORT, epicNames),
  );
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());

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

  const totals = React.useMemo(() => computeTotals(stories), [stories]);

  if (stories.length === 0) {
    return <div className="px-4 py-6 text-center text-[12px] text-faint">No stories due this week.</div>;
  }

  return (
    <div className="overflow-x-auto scroll-slim">
      <table className="w-full min-w-[1180px] border-collapse">
        <thead className="sticky top-0 z-10 bg-surface-2/95 backdrop-blur">
          <tr>
            {COLUMNS.map((c) => (
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
            const epicLabel = (story.epicId ? epicNames[story.epicId] : null) ?? story.epicId ?? "—";
            return (
              <React.Fragment key={story.storyId}>
                <StoryRow
                  story={story}
                  epicLabel={epicLabel}
                  expanded={isExpanded}
                  canExpand={canExpand}
                  onToggle={() => toggleExpanded(story.storyId)}
                />
                {isExpanded && canExpand
                  ? story.bugs.map((bug) => <BugRow key={bug.bugId} bug={bug} />)
                  : null}
              </React.Fragment>
            );
          })}
          <TotalsRow totals={totals} />
        </tbody>
      </table>
    </div>
  );
}
