"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/format";
import type { DrillBug } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { IssueLink } from "@/components/ui/issue-link";
import { priorityVariant, stateVariant } from "@/components/weekly/badge-tone";

type SortKey = "bugId" | "summary" | "state" | "created" | "assignee" | "priority";
type SortDir = "asc" | "desc";
interface SortState {
  key: SortKey;
  dir: SortDir;
}

/** Oldest first — same "how long has this been open" default as the story
 *  table's own created-date sort on this page. */
const DEFAULT_SORT: SortState = { key: "created", dir: "asc" };

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "bugId", label: "ID" },
  { key: "summary", label: "Summary" },
  { key: "state", label: "State" },
  { key: "created", label: "Created" },
  { key: "assignee", label: "Assignee" },
  { key: "priority", label: "Priority" },
];

function sortValue(b: DrillBug, key: SortKey): string | number {
  switch (key) {
    case "bugId":
      return b.bugId;
    case "summary":
      return b.summary ?? "";
    case "state":
      return b.state ?? "";
    case "created":
      return b.created ?? 0;
    case "assignee":
      return b.assignee || "";
    case "priority":
      return b.priority || "";
  }
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === "string" || typeof b === "string") return String(a).localeCompare(String(b));
  return a - b;
}

function sortBugs(rows: DrillBug[], sort: SortState): DrillBug[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const cmp = compare(sortValue(a, sort.key), sortValue(b, sort.key));
    // Stable tie-break by bug id, same convention as bugs/bug-table.tsx.
    return cmp !== 0 ? sign * cmp : a.bugId.localeCompare(b.bugId);
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
 * Compact sortable ticket table for Android bugs (DrillBug[]) — mirrors
 * support/sup-ticket-table.tsx's shape/density exactly, with Android's own
 * column set. No Resolved/dev-ticket column here: this table only ever
 * shows pending (open) bugs grouped into one state at a time (via
 * android-bug-breakdown.tsx's click-to-expand), so a per-row State badge is
 * mostly a confirmation of the row group it's under, and the dev ticket
 * link already lives on the story-level bug drill-down elsewhere on this
 * page.
 */
export function AndroidBugTable({ rows, tz }: { rows: DrillBug[]; tz: string }) {
  const [sort, setSort] = React.useState<SortState>(DEFAULT_SORT);
  const [sorted, setSorted] = React.useState<DrillBug[]>(() => sortBugs(rows, DEFAULT_SORT));

  React.useEffect(() => {
    setSorted(sortBugs(rows, sort));
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
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="border-b border-border/50">
            {COLUMNS.map((c) => (
              <Th key={c.key} label={c.label} sortKey={c.key} sort={sort} onSort={handleSort} />
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((b) => (
            <tr key={b.bugId} className="border-t border-border/30 text-[12px] transition-colors hover:bg-elevated/40">
              <td className="whitespace-nowrap px-2 py-2 align-top">
                <IssueLink id={b.bugId} showIcon={false} />
              </td>
              <td className="max-w-[320px] px-2 py-2 align-top">
                <span className="text-fg/85">{b.summary}</span>
              </td>
              <td className="px-2 py-2 align-top">
                <Badge variant={stateVariant(b.state, b.done ?? false)} size="sm">
                  {b.state || "—"}
                </Badge>
              </td>
              <td className="whitespace-nowrap px-2 py-2 align-top text-[11px] text-muted">
                {b.created != null ? fmtDateTime(b.created, tz) : <span className="text-faint">—</span>}
              </td>
              <td className="px-2 py-2 align-top text-fg/80">
                {b.assignee || <span className="text-faint">—</span>}
              </td>
              <td className="px-2 py-2 align-top">
                {b.priority ? (
                  <Badge variant={priorityVariant(b.priority)} size="sm">
                    {b.priority}
                  </Badge>
                ) : (
                  <span className="text-faint">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
