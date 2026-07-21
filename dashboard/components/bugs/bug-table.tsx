"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTimeIst } from "@/lib/format";
import type { Bug } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { IssueLink } from "@/components/ui/issue-link";
import { priorityVariant, stateVariant } from "@/components/weekly/badge-tone";

type SortKey = "id" | "summary" | "created" | "state" | "priority" | "assignee" | "module" | "reporter";
type SortDir = "asc" | "desc";
interface SortState {
  key: SortKey;
  dir: SortDir;
}

/** PRD_1 §5: "rows sorted by created ascending" — kept as the default so a
 *  page load looks identical to before sorting existed; clicking a header
 *  overrides it. */
const DEFAULT_SORT: SortState = { key: "created", dir: "asc" };

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "id", label: "ID" },
  { key: "summary", label: "Summary" },
  { key: "created", label: "Created" },
  { key: "state", label: "State" },
  { key: "assignee", label: "Assignee" },
  { key: "module", label: "Module" },
  { key: "reporter", label: "Reporter" },
];

/** Priority column is opt-in (see `showPriority` below) — every other call
 *  site already scopes its rows to a single priority (the "High"/"Medium"/
 *  "Low" sections, the older-open-High list), so a Priority column there
 *  would just repeat the section title. Module Insights spans every
 *  priority, so it turns this on. */
const PRIORITY_COLUMN: { key: SortKey; label: string } = { key: "priority", label: "Priority" };

function sortValue(bug: Bug, key: SortKey): string | number {
  switch (key) {
    case "id":
      return bug.id;
    case "summary":
      return bug.summary ?? "";
    case "created":
      return bug.created;
    case "state":
      return bug.state ?? "";
    case "priority":
      return bug.priority || "";
    case "assignee":
      return bug.assignee || "";
    case "module":
      return bug.module || "";
    case "reporter":
      return bug.reporter || "";
  }
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === "string" || typeof b === "string") return String(a).localeCompare(String(b));
  return a - b;
}

function sortBugs(bugs: Bug[], sort: SortState): Bug[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...bugs].sort((a, b) => {
    const cmp = compare(sortValue(a, sort.key), sortValue(b, sort.key));
    // Stable tie-break by ID, same convention as weekly/story-table.tsx.
    return cmp !== 0 ? sign * cmp : a.id.localeCompare(b.id);
  });
}

function Th({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <th className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}${active ? ` (${sort.dir === "asc" ? "ascending" : "descending"})` : ""}`}
        className={cn(
          "inline-flex items-center gap-1 rounded transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
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

/**
 * Reusable bug listing table (docs/reports-dashboard/plans/05-bug-analysis.md
 * Task 2 / PRD_1 §5 §1-§2): ID · Summary · Created (IST, muted) · State ·
 * Assignee · Module · Reporter. Shared by §1's three priority sub-groups and
 * §2's older-open-High list.
 *
 * Client component with clickable, sortable headers (same re-sort-the-array
 * pattern as weekly/story-table.tsx — never touch the DOM directly). Default
 * order is `created` ascending, matching the original always-sorted-by-created
 * behavior, so nothing changes visually until a header is clicked.
 */
export function BugTable({ rows, showPriority = false }: { rows: Bug[]; showPriority?: boolean }) {
  const [sort, setSort] = React.useState<SortState>(DEFAULT_SORT);
  const [sorted, setSorted] = React.useState<Bug[]>(() => sortBugs(rows, DEFAULT_SORT));
  const columns = showPriority ? [...COLUMNS.slice(0, 4), PRIORITY_COLUMN, ...COLUMNS.slice(4)] : COLUMNS;

  React.useEffect(() => {
    setSorted(sortBugs(rows, sort));
    // Intentionally NOT depending on `sort` — see weekly/story-table.tsx for
    // why (header clicks apply the sort directly in handleSort below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  function handleSort(key: SortKey) {
    const dir: SortDir = sort.key === key && sort.dir === "asc" ? "desc" : "asc";
    const next: SortState = { key, dir };
    setSort(next);
    setSorted((prev) => sortBugs(prev, next));
  }

  if (rows.length === 0) {
    return <div className="px-4 py-4 text-center text-[12px] text-faint">No bugs.</div>;
  }

  return (
    <div className="overflow-x-auto scroll-slim">
      <table className="w-full min-w-[820px] border-collapse">
        <thead>
          <tr className="border-b border-border/50">
            {columns.map((c) => (
              <Th key={c.key} label={c.label} sortKey={c.key} sort={sort} onSort={handleSort} />
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((bug) => (
            <tr key={bug.id} className="border-t border-border/30 text-[12px] transition-colors hover:bg-elevated/40">
              <td className="whitespace-nowrap px-2 py-2 align-top">
                <IssueLink id={bug.id} showIcon={false} />
              </td>
              <td className="max-w-[320px] px-2 py-2 align-top">
                <span className="text-fg/85">{bug.summary}</span>
              </td>
              <td className="whitespace-nowrap px-2 py-2 align-top text-[11px] text-muted">
                {fmtDateTimeIst(bug.created)}
              </td>
              <td className="px-2 py-2 align-top">
                {/* Bugs in this block are always open/unresolved (upstream
                    queries filter #Unresolved — PRD_1 §4 Q1-Q4), so there's
                    no "done" state to consider, same as DrillBug rows in
                    weekly/story-table.tsx. */}
                <Badge variant={stateVariant(bug.state, false)} size="sm">
                  {bug.state || "—"}
                </Badge>
              </td>
              {showPriority ? (
                <td className="px-2 py-2 align-top">
                  <Badge variant={priorityVariant(bug.priority)} size="sm">
                    {bug.priority || "No Priority"}
                  </Badge>
                </td>
              ) : null}
              <td className="px-2 py-2 align-top text-fg/80">
                {bug.assignee || <span className="text-faint">—</span>}
              </td>
              <td className="px-2 py-2 align-top text-muted">
                {bug.module || <span className="text-faint">—</span>}
              </td>
              <td className="px-2 py-2 align-top text-muted">
                {bug.reporter || <span className="text-faint">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
