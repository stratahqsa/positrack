"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronRight, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtHours, fmtMd } from "@/lib/format";
import { isDoneState, isPendingPhase1, pendingP1Spent } from "@/lib/effort";
import type { Epic, Rollup, Story } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { IssueLink } from "@/components/ui/issue-link";
import { scopeLabel, stateVariant } from "@/components/weekly/badge-tone";

/**
 * Sortable epic table reused by S0 (done), S1 (pending), and S2 (mixed) —
 * docs/reports-dashboard/plans/06-effort.md Task 2 / PRD_3 §5. Columns and
 * the per-row effort source vary by `variant`:
 *  - "done": Epic·Summary(+resolved)·Dev·UI·QA·Total·Spent. An epic lands in
 *    this section because ITS OWN resolved date is after the 29-Jun cutoff —
 *    that says nothing about when each individual child story resolved (an
 *    8-story epic can qualify because its LAST story closed post-cutoff,
 *    while the other 7 closed months earlier). So both the sub-row list AND
 *    the epic-line Dev/UI/QA/Total/Spent are scoped to just the stories that
 *    themselves resolved after `cutoffMs` (2026-07-26) — summing exactly
 *    what's shown, same "row and total can never disagree" principle as
 *    "pending"/"mixed" below. Falls back to ALL stories (the old rollup_all-
 *    equivalent behavior) when `cutoffMs` isn't supplied.
 *  - "pending"/"mixed": Epic·Summary·Assignee·Created·Dev·UI·QA·Total·Spent
 *    (+Est ⚠/✓ for pending only). Reads `rollup`/`total` directly — spot
 *    verified these already equal sum(rollup) exactly, so no separate
 *    "totals" prop is threaded in; the TOTAL row below is computed by
 *    summing the same per-row accessor used for the cells above it, so rows
 *    and their total can never visually disagree.
 *
 *    Spent is the exception for "mixed": `Epic.spent` is a whole-epic,
 *    all-stories-ever total (a work-item sweep — see core/ytcore.py), which
 *    would mismatch a Total that's already pending-P1-only. So "mixed" scopes
 *    Spent down to `pendingP1Spent()` — summing each pending-P1 story's own
 *    `spent` field — matching the PM's already-validated scheduled-report
 *    recipe. "pending"/"done" keep the whole-epic `Epic.spent` unchanged.
 */
export type EpicTableVariant = "done" | "pending" | "mixed";

type SortKey = "id" | "summary" | "assignee" | "created" | "resolved" | "dev" | "ui" | "qa" | "total" | "spent";
type SortDir = "asc" | "desc";
interface SortState {
  key: SortKey;
  dir: SortDir;
}

/** PRD_3 §5: S1 defaults to Total desc. S2 mirrors that (its Total is
 *  meaningful — pending-P1 remaining effort). S0's Total is always 0 (see
 *  file doc above), so it defaults to most-recently-resolved first instead. */
const DEFAULT_SORT: Record<EpicTableVariant, SortState> = {
  done: { key: "resolved", dir: "desc" },
  pending: { key: "total", dir: "desc" },
  mixed: { key: "total", dir: "desc" },
};

const COLUMN_KEYS: Record<EpicTableVariant, SortKey[]> = {
  done: ["id", "summary", "dev", "ui", "qa", "total", "spent"],
  pending: ["id", "summary", "assignee", "created", "dev", "ui", "qa", "total", "spent"],
  mixed: ["id", "summary", "assignee", "created", "dev", "ui", "qa", "total", "spent"],
};

const LABELS: Record<SortKey, string> = {
  id: "Epic",
  summary: "Summary",
  assignee: "Assignee",
  created: "Created",
  resolved: "Resolved",
  dev: "Dev",
  ui: "UI",
  qa: "QA",
  total: "Total",
  spent: "Spent",
};

const RIGHT_ALIGN = new Set<SortKey>(["dev", "ui", "qa", "total", "spent"]);

/** Which of an epic's stories expand into sub-rows, per variant: "pending"
 *  shows ALL stories (PENDING epics have zero done stories by the category
 *  rule itself — PRD_3 §4 "PENDING: has stories, none done"); "mixed" filters
 *  down to the pending ones (PRD_3 §5 "expandable pending sub-rows"); "done"
 *  filters down to stories that themselves resolved after `cutoffMs` (see
 *  file doc above) — falls back to ALL stories when no cutoff is supplied.
 *  "pending"/"mixed" still include pending Phase-2/Phase-3 stories (for
 *  visibility — the epic's "P2/P3 · n" badge already flags the scope
 *  leakage); that's deliberately looser than `isPendingPhase1` below, which
 *  additionally excludes any later phase for the Spent/estimate rollups. */
function subStories(epic: Epic, variant: EpicTableVariant, cutoffMs?: number): Story[] {
  if (variant === "mixed") return epic.stories.filter((s) => !isDoneState(s.state));
  if (variant === "done" && cutoffMs != null) {
    return epic.stories.filter((s) => s.resolved != null && s.resolved > cutoffMs);
  }
  return epic.stories;
}

interface RowEffort {
  dev: number;
  ui: number;
  qa: number;
  total: number;
  spent: number;
}

function rollupEffort(r: Rollup): { dev: number; ui: number; qa: number } {
  return { dev: r.server, ui: r.ui, qa: r.testing };
}

function rowEffort(epic: Epic, variant: EpicTableVariant, cutoffMs?: number): RowEffort {
  if (variant === "done") {
    const stories = subStories(epic, variant, cutoffMs);
    const dev = stories.reduce((t, s) => t + s.est.server, 0);
    const ui = stories.reduce((t, s) => t + s.est.ui, 0);
    const qa = stories.reduce((t, s) => t + s.est.testing, 0);
    const spent = stories.reduce((t, s) => t + (s.spent ?? 0), 0);
    return { dev, ui, qa, total: dev + ui + qa, spent };
  }
  const r = rollupEffort(epic.rollup);
  const spent = variant === "mixed" ? pendingP1Spent(epic) : epic.spent;
  return { ...r, total: epic.total, spent };
}

function sortValue(
  epic: Epic,
  key: SortKey,
  variant: EpicTableVariant,
  cutoffMs?: number,
): string | number | null {
  switch (key) {
    case "id":
      return epic.id;
    case "summary":
      return epic.summary ?? "";
    case "assignee":
      return epic.assignee || null;
    case "created":
      return epic.created;
    case "resolved":
      return epic.resolved;
    case "dev":
      return rowEffort(epic, variant, cutoffMs).dev;
    case "ui":
      return rowEffort(epic, variant, cutoffMs).ui;
    case "qa":
      return rowEffort(epic, variant, cutoffMs).qa;
    case "total":
      return rowEffort(epic, variant, cutoffMs).total;
    case "spent":
      return rowEffort(epic, variant, cutoffMs).spent;
  }
}

/** Nulls always sort last regardless of direction (mirrors weekly/story-table.tsx). */
function compare(a: string | number | null, b: string | number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "string" || typeof b === "string") return String(a).localeCompare(String(b));
  return a - b;
}

function sortEpics(epics: Epic[], sort: SortState, variant: EpicTableVariant, cutoffMs?: number): Epic[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...epics].sort((a, b) => {
    const cmp = compare(sortValue(a, sort.key, variant, cutoffMs), sortValue(b, sort.key, variant, cutoffMs));
    // Stable tie-break by epic ID, matching weekly/story-table.tsx's convention.
    return cmp !== 0 ? sign * cmp : a.id.localeCompare(b.id);
  });
}

function computeTotals(epics: Epic[], variant: EpicTableVariant, cutoffMs?: number): RowEffort {
  return epics.reduce<RowEffort>(
    (acc, epic) => {
      const eff = rowEffort(epic, variant, cutoffMs);
      return {
        dev: acc.dev + eff.dev,
        ui: acc.ui + eff.ui,
        qa: acc.qa + eff.qa,
        total: acc.total + eff.total,
        spent: acc.spent + eff.spent,
      };
    },
    { dev: 0, ui: 0, qa: 0, total: 0, spent: 0 },
  );
}

function Th({
  label,
  sortKey,
  align,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  align?: "right";
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
          active ? "text-accent" : "text-faint",
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

/** PRD_3 §4 "Missing-estimate flag (S1)": ⚠ amber when flagged, ✓ green
 *  otherwise. S1-only column. */
function EstBadge({ missingEst }: { missingEst: boolean }) {
  return missingEst ? (
    <Badge variant="warn" size="sm" title="Incomplete estimate: (Dev==0 AND UI==0) OR QA==0">
      <TriangleAlert className="size-3" /> Missing
    </Badge>
  ) : (
    <Badge variant="good" size="sm">
      <Check className="size-3" /> OK
    </Badge>
  );
}

function EffortCells({ eff }: { eff: RowEffort }) {
  return (
    <>
      <td className="px-2 py-2 text-right tabular align-top">{fmtHours(eff.dev)}</td>
      <td className="px-2 py-2 text-right tabular align-top">{fmtHours(eff.ui)}</td>
      <td className="px-2 py-2 text-right tabular align-top">{fmtHours(eff.qa)}</td>
      <td className="px-2 py-2 text-right tabular align-top">
        <div>{fmtHours(eff.total)}</div>
        <div className="text-[9.5px] text-faint">{fmtMd(eff.total)}</div>
      </td>
      <td className="px-2 py-2 text-right tabular align-top">{fmtHours(eff.spent)}</td>
    </>
  );
}

function EpicDataRow({
  epic,
  variant,
  cutoffMs,
  subCount,
  expanded,
  onToggle,
}: {
  epic: Epic;
  variant: EpicTableVariant;
  cutoffMs?: number;
  subCount: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const eff = rowEffort(epic, variant, cutoffMs);
  const canExpand = subCount > 0;
  const doneCount = epic.stories.length - subCount; // only meaningful for "mixed" (subCount = pending count there)

  const rowTone =
    variant === "done"
      ? "bg-good/[0.05] hover:bg-good/[0.08]"
      : variant === "pending" && epic.missing_est
        ? "bg-warn/[0.06] hover:bg-warn/[0.1]"
        : "hover:bg-elevated/40";

  return (
    <tr className={cn("border-t border-border/50 text-[12px] transition-colors", rowTone)}>
      <td className="whitespace-nowrap px-2 py-2 align-top">
        <div className="flex items-center gap-1.5">
          {canExpand ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-label={`${expanded ? "Collapse" : "Expand"} ${subCount} stor${subCount === 1 ? "y" : "ies"} for ${epic.id}`}
              className="inline-flex items-center justify-center rounded p-0.5 text-faint transition-colors hover:bg-elevated/60 hover:text-fg"
            >
              <ChevronRight className={cn("size-3.5 transition-transform", expanded && "rotate-90")} />
            </button>
          ) : (
            <span className="inline-block size-3.5 shrink-0" aria-hidden="true" />
          )}
          <IssueLink id={epic.id} showIcon={false} />
        </div>
      </td>

      {variant === "done" ? (
        <td className="max-w-[320px] px-2 py-2 align-top">
          <span className="line-clamp-2 text-fg/85">{epic.summary}</span>
          <div className="mt-0.5 text-[10.5px] text-faint">Resolved {fmtDate(epic.resolved)}</div>
        </td>
      ) : (
        <td className="max-w-[320px] px-2 py-2 align-top">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="line-clamp-2 text-fg/85">{epic.summary}</span>
            {epic.has_p2 ? (
              <Badge variant="violet" size="sm">
                P2/P3 · {epic.p2_stories ?? 0}
              </Badge>
            ) : null}
          </div>
          {variant === "mixed" ? (
            <div className="mt-0.5 text-[10.5px] text-faint">
              {doneCount} done / {subCount} pending
            </div>
          ) : null}
        </td>
      )}

      {variant !== "done" ? (
        <>
          <td className="px-2 py-2 align-top text-fg/80">
            {epic.assignee || <span className="text-faint">Unassigned</span>}
          </td>
          <td className="whitespace-nowrap px-2 py-2 align-top text-muted">{fmtDate(epic.created)}</td>
        </>
      ) : null}

      <EffortCells eff={eff} />

      {variant === "pending" ? (
        <td className="px-2 py-2 align-top">
          <EstBadge missingEst={epic.missing_est} />
        </td>
      ) : null}
    </tr>
  );
}

/** Sub-row: one story under an expanded epic. Renders one real `<td>` per
 *  column, matching EpicDataRow's exact column set for `variant` (id/summary/
 *  [assignee/created]/dev/ui/qa/total/spent/[est]) so a story's Assignee and
 *  Dev/UI/QA values land in the SAME columns as the epic row above it, instead
 *  of one flowing colSpan line that couldn't align with anything. */
function StorySubRow({ story, variant }: { story: Story; variant: EpicTableVariant }) {
  const done = isDoneState(story.state);
  const dev = story.est.server;
  const ui = story.est.ui;
  const qa = story.est.testing;

  return (
    <tr className={cn("border-t border-border/30 text-[11.5px]", done ? "bg-good/[0.03]" : "bg-elevated/20")}>
      <td className="whitespace-nowrap py-1.5 pl-8 pr-2 align-top">
        <div className="flex items-center gap-1.5">
          <IssueLink id={story.id} showIcon={false} className="text-[11.5px]" />
          <Badge variant={stateVariant(story.state, done)} size="sm">
            {story.state || "—"}
          </Badge>
          {scopeLabel(story.scope) ? (
            <Badge variant="violet" size="sm">
              {scopeLabel(story.scope)}
            </Badge>
          ) : null}
        </div>
      </td>
      <td className="max-w-[320px] px-2 py-1.5 align-top">
        <span className="line-clamp-2 text-fg/70">{story.summary}</span>
      </td>
      {variant !== "done" ? (
        <>
          <td className="px-2 py-1.5 align-top text-muted">
            {story.assignee || <span className="text-faint">—</span>}
          </td>
          <td className="whitespace-nowrap px-2 py-1.5 align-top text-muted">{fmtDate(story.created)}</td>
        </>
      ) : null}
      <td className="px-2 py-1.5 text-right tabular align-top text-muted">{fmtHours(dev)}</td>
      <td className="px-2 py-1.5 text-right tabular align-top text-muted">{fmtHours(ui)}</td>
      <td className="px-2 py-1.5 text-right tabular align-top text-muted">{fmtHours(qa)}</td>
      <td className="px-2 py-1.5 text-right tabular align-top text-muted">{fmtHours(dev + ui + qa)}</td>
      <td className="px-2 py-1.5 text-right tabular align-top text-muted">{fmtHours(story.spent ?? 0)}</td>
      {variant === "pending" ? <td /> : null}
    </tr>
  );
}

function TotalsRow({ totals, variant, columnCount }: { totals: RowEffort; variant: EpicTableVariant; columnCount: number }) {
  // Everything left of Dev/UI/QA/Total/Spent (5 cols) minus the trailing Est
  // column (1 col, pending only, added back separately below) — e.g. pending's
  // columnCount=10 -> labelSpan=4 (id/summary/assignee/created), not 5.
  const labelSpan = columnCount - 5 - (variant === "pending" ? 1 : 0);
  return (
    <tr className="border-t-2 border-border-strong bg-elevated/60 text-[12px] font-semibold">
      <td className="px-2 py-2 text-fg/90" colSpan={labelSpan}>
        Total
      </td>
      <EffortCells eff={totals} />
      {variant === "pending" ? <td /> : null}
    </tr>
  );
}

export function EpicEffortTable({
  epics,
  variant,
  cutoffMs,
}: {
  epics: Epic[];
  variant: EpicTableVariant;
  /** "done" variant only: stories/effort scoped to `resolved > cutoffMs` — see file doc. */
  cutoffMs?: number;
}) {
  const defaultSort = DEFAULT_SORT[variant];
  const [sort, setSort] = React.useState<SortState>(defaultSort);
  const [rows, setRows] = React.useState<Epic[]>(() => sortEpics(epics, defaultSort, variant, cutoffMs));
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    setRows(sortEpics(epics, sort, variant, cutoffMs));
    // Intentionally NOT depending on `sort` — mirrors weekly/story-table.tsx:
    // sort changes are applied directly in handleSort below, and re-running
    // this effect on every header click would just redundantly re-sort. This
    // view has no filter bar today (effort is epic/category-centric, out of
    // scope for v1 per the plan), but keeping the resync effect matches the
    // reused architecture and protects against `epics` changing for any
    // future reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epics, variant, cutoffMs]);

  function handleSort(key: SortKey) {
    const dir: SortDir = sort.key === key && sort.dir === "asc" ? "desc" : "asc";
    const next: SortState = { key, dir };
    setSort(next);
    setRows((prev) => sortEpics(prev, next, variant, cutoffMs));
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const totals = React.useMemo(() => computeTotals(epics, variant, cutoffMs), [epics, variant, cutoffMs]);
  const columnCount = COLUMN_KEYS[variant].length + (variant === "pending" ? 1 : 0);

  if (epics.length === 0) {
    return <div className="px-4 py-6 text-center text-[12px] text-faint">No epics in this section.</div>;
  }

  return (
    <div className="overflow-x-auto scroll-slim">
      <table className="w-full min-w-[820px] border-collapse">
        <thead className="sticky top-0 z-10 bg-surface-2/95 backdrop-blur">
          <tr>
            {COLUMN_KEYS[variant].map((key) => (
              <Th
                key={key}
                label={LABELS[key]}
                sortKey={key}
                align={RIGHT_ALIGN.has(key) ? "right" : undefined}
                sort={sort}
                onSort={handleSort}
              />
            ))}
            {variant === "pending" ? (
              <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-faint">Est</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((epic) => {
            const subs = subStories(epic, variant, cutoffMs);
            const isExpanded = expanded.has(epic.id);
            return (
              <React.Fragment key={epic.id}>
                <EpicDataRow
                  epic={epic}
                  variant={variant}
                  cutoffMs={cutoffMs}
                  subCount={subs.length}
                  expanded={isExpanded}
                  onToggle={() => toggleExpanded(epic.id)}
                />
                {isExpanded && subs.length > 0
                  ? subs.map((story) => <StorySubRow key={story.id} story={story} variant={variant} />)
                  : null}
              </React.Fragment>
            );
          })}
          <TotalsRow totals={totals} variant={variant} columnCount={columnCount} />
        </tbody>
      </table>
    </div>
  );
}
