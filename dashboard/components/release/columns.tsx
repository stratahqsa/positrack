"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { nextSort, type ReleaseSortKey, type ReleaseSortState } from "@/lib/release-sort";

/**
 * Shared column grid for the Release Schedule's epic and story lines (bug
 * lines keep their own flex layout). Every epic/story row and its header use
 * GRID_CLASS so the columns line up across levels; MIN_WIDTH_CLASS keeps the
 * grid from crushing on narrow screens -- the milestone section scrolls
 * sideways instead.
 */
export const GRID_CLASS =
  "grid grid-cols-[20px_104px_136px_minmax(220px,1fr)_128px_68px_68px_68px_76px_76px_84px_84px_104px] items-center gap-x-3";
export const MIN_WIDTH_CLASS = "min-w-[1420px]";

const COLUMNS: { key: ReleaseSortKey; label: string; right?: boolean; title?: string }[] = [
  { key: "ticket", label: "Ticket" },
  { key: "state", label: "State" },
  { key: "description", label: "Description" },
  { key: "assignee", label: "Assignee" },
  { key: "devEst", label: "Dev est", right: true },
  { key: "uiEst", label: "UI est", right: true },
  { key: "qaEst", label: "QA est", right: true },
  { key: "totalEst", label: "Total est", right: true },
  { key: "spent", label: "Spent", right: true },
  { key: "maxDevDl", label: "Max dev DL", right: true, title: "Epic: latest Dev deadline across all its stories. Story: its own Dev deadline." },
  { key: "maxQaDl", label: "Max QA DL", right: true, title: "Epic: latest QA deadline across all its stories. Story: its own QA deadline." },
  { key: "count", label: "Stories/Bugs", right: true, title: "Epic: stories shown / total. Story: open bugs (click the bug badge to expand)." },
];

export function ColumnHeader({
  sort,
  onSort,
  tone = "epic",
}: {
  sort: ReleaseSortState;
  onSort: (next: ReleaseSortState) => void;
  tone?: "epic" | "story";
}) {
  return (
    <div
      role="row"
      className={cn(
        GRID_CLASS,
        "border-b border-border/50 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide",
        tone === "story" ? "bg-elevated/30 pl-4" : "bg-surface-2/40",
      )}
    >
      <span aria-hidden="true" />
      {COLUMNS.map((c) => {
        const active = sort?.key === c.key;
        return (
          <div
            key={c.key}
            role="columnheader"
            aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"}
            className={cn("min-w-0", c.right && "text-right")}
          >
            <button
              type="button"
              onClick={() => onSort(nextSort(sort, c.key))}
              title={c.title}
              aria-label={`Sort by ${c.label}${active ? ` (${sort!.dir === "asc" ? "ascending" : "descending"})` : ""}`}
              className={cn(
                "inline-flex max-w-full items-center gap-1 rounded transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
                c.right && "flex-row-reverse",
                active ? "text-accent" : "text-faint",
              )}
            >
              <span className="truncate">{c.label}</span>
              {active ? (
                sort!.dir === "asc" ? (
                  <ArrowUp className="size-3 shrink-0" />
                ) : (
                  <ArrowDown className="size-3 shrink-0" />
                )
              ) : (
                <ArrowUpDown className="size-3 shrink-0 opacity-40" />
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
