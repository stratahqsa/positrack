"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import type { Epic } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { IssueLink } from "@/components/ui/issue-link";
import { priorityVariant } from "@/components/weekly/badge-tone";

type SortKey = "id" | "summary" | "assignee" | "priority" | "created";
type SortDir = "asc" | "desc";
interface SortState {
  key: SortKey;
  dir: SortDir;
}

/** Newest first — "No Stories" epics are epics that exist but have no child
 *  stories yet, so the most recently created ones are the most likely to
 *  still need attention. Click any header to change it, same as every other
 *  sortable table on this dashboard. */
const DEFAULT_SORT: SortState = { key: "created", dir: "desc" };

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "id", label: "Epic" },
  { key: "summary", label: "Summary" },
  { key: "assignee", label: "Assignee" },
  { key: "priority", label: "Priority" },
  { key: "created", label: "Created" },
];

function sortValue(epic: Epic, key: SortKey): string | number | null {
  switch (key) {
    case "id":
      return epic.id;
    case "summary":
      return epic.summary ?? "";
    case "assignee":
      return epic.assignee || null;
    case "priority":
      return epic.priority || null;
    case "created":
      return epic.created;
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

function sortEpics(epics: Epic[], sort: SortState): Epic[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...epics].sort((a, b) => {
    const cmp = compare(sortValue(a, sort.key), sortValue(b, sort.key));
    // Stable tie-break by epic ID, matching epic-effort-table.tsx's convention.
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
 * Sortable table for the Effort report's "No Stories" section — epics with
 * zero child stories, so unlike epic-effort-table.tsx (Done/Pending/Mixed)
 * there's no effort/expand logic to carry: just Epic/Summary/Assignee/
 * Priority/Created, each column click-to-sort. A dedicated component rather than a
 * 4th EpicEffortTable variant, since that component's column set and row
 * logic (rollup effort, sub-row expand, Est badge) are all built around
 * epics that DO have stories — forcing "no stories" through it would mean
 * stripping most of what it does, for a table this small.
 */
export function NoStoriesTable({ epics }: { epics: Epic[] }) {
  const [sort, setSort] = React.useState<SortState>(DEFAULT_SORT);
  const [rows, setRows] = React.useState<Epic[]>(() => sortEpics(epics, DEFAULT_SORT));

  React.useEffect(() => {
    setRows(sortEpics(epics, sort));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epics]);

  function handleSort(key: SortKey) {
    const dir: SortDir = sort.key === key && sort.dir === "asc" ? "desc" : "asc";
    const next: SortState = { key, dir };
    setSort(next);
    setRows((prev) => sortEpics(prev, next));
  }

  if (epics.length === 0) {
    return <div className="px-4 py-6 text-center text-[12px] text-faint">No epics without stories.</div>;
  }

  return (
    <div className="overflow-x-auto scroll-slim">
      <table className="w-full min-w-[620px] border-collapse">
        <thead className="bg-surface-2/95">
          <tr>
            {COLUMNS.map((c) => (
              <Th key={c.key} label={c.label} sortKey={c.key} sort={sort} onSort={handleSort} />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((epic) => (
            <tr key={epic.id} className="border-t border-border/50 text-[12px] hover:bg-elevated/40">
              <td className="whitespace-nowrap px-2 py-2 align-top">
                <IssueLink id={epic.id} showIcon={false} />
              </td>
              <td className="max-w-[320px] px-2 py-2 align-top">
                <span className="line-clamp-2 text-fg/85">{epic.summary}</span>
              </td>
              <td className="px-2 py-2 align-top text-fg/80">
                {epic.assignee || <span className="text-faint">Unassigned</span>}
              </td>
              <td className="px-2 py-2 align-top">
                {epic.priority ? (
                  <Badge variant={priorityVariant(epic.priority)} size="sm">
                    {epic.priority}
                  </Badge>
                ) : (
                  <span className="text-faint">—</span>
                )}
              </td>
              <td className="whitespace-nowrap px-2 py-2 align-top text-muted">{fmtDate(epic.created)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
