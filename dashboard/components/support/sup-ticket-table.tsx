"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/format";
import type { SupTicket } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { IssueLink } from "@/components/ui/issue-link";
import { categoricalVariant } from "@/lib/categorical-color";
import { supStateVariant } from "@/components/support/sup-state-tone";

type SortKey = "id" | "summary" | "created" | "reporter" | "age_days" | "state" | "assignee" | "location";
type SortDir = "asc" | "desc";
interface SortState {
  key: SortKey;
  dir: SortDir;
}

/** PM-confirmed (2026-08-08): newest first — with filters now available and
 *  the KPI strip's own "Oldest ticket" stat already covering the staleness
 *  angle, this table reads better as a general browse/triage view than an
 *  oldest-first backlog list. Flip to ascending any time via the Created
 *  header, same as every other sortable table on this dashboard. */
const DEFAULT_SORT: SortState = { key: "created", dir: "desc" };

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "id", label: "ID" },
  { key: "summary", label: "Summary" },
  { key: "created", label: "Created" },
  { key: "reporter", label: "Reporter" },
  { key: "age_days", label: "Age" },
  { key: "state", label: "State" },
  { key: "assignee", label: "Assignee" },
  { key: "location", label: "Location" },
];

function sortValue(t: SupTicket, key: SortKey): string | number {
  switch (key) {
    case "id":
      return t.id;
    case "summary":
      return t.summary ?? "";
    case "created":
      return t.created;
    case "reporter":
      return t.reporter || "";
    case "age_days":
      return t.age_days ?? -1;
    case "state":
      return t.state ?? "";
    case "assignee":
      return t.assignee || "";
    case "location":
      return t.location || "";
  }
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === "string" || typeof b === "string") return String(a).localeCompare(String(b));
  return a - b;
}

function sortTickets(rows: SupTicket[], sort: SortState): SupTicket[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const cmp = compare(sortValue(a, sort.key), sortValue(b, sort.key));
    // Stable tie-break by ID, same convention as bugs/bug-table.tsx.
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
 * Reusable ticket listing table for the Support Tickets page — mirrors
 * bugs/bug-table.tsx exactly (same sortable-header pattern, same visual
 * density), with SUP's own column set: ID · Summary · Created · Reporter ·
 * Age · State · Assignee · Location. Shared by the By State / By Location
 * expand rows (components/support/expandable-breakdown.tsx) and the "All
 * Pending Tickets" full listing, so a column added here shows up everywhere
 * at once.
 */
export function SupTicketTable({ rows, tz }: { rows: SupTicket[]; tz: string }) {
  const [sort, setSort] = React.useState<SortState>(DEFAULT_SORT);
  const [sorted, setSorted] = React.useState<SupTicket[]>(() => sortTickets(rows, DEFAULT_SORT));

  React.useEffect(() => {
    setSorted(sortTickets(rows, sort));
    // Intentionally NOT depending on `sort` — see bugs/bug-table.tsx for why
    // (header clicks apply the sort directly in handleSort below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  function handleSort(key: SortKey) {
    const dir: SortDir = sort.key === key && sort.dir === "asc" ? "desc" : "asc";
    const next: SortState = { key, dir };
    setSort(next);
    setSorted((prev) => sortTickets(prev, next));
  }

  if (rows.length === 0) {
    return <div className="px-4 py-4 text-center text-[12px] text-faint">No tickets.</div>;
  }

  return (
    <div className="overflow-x-auto scroll-slim">
      <table className="w-full min-w-[760px] border-collapse">
        <thead>
          <tr className="border-b border-border/50">
            {COLUMNS.map((c) => (
              <Th key={c.key} label={c.label} sortKey={c.key} sort={sort} onSort={handleSort} />
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <tr key={t.id} className="border-t border-border/30 text-[12px] transition-colors hover:bg-elevated/40">
              <td className="whitespace-nowrap px-2 py-2 align-top">
                <IssueLink id={t.id} showIcon={false} />
              </td>
              <td className="max-w-[320px] px-2 py-2 align-top">
                <span className="text-fg/85">{t.summary}</span>
              </td>
              <td className="whitespace-nowrap px-2 py-2 align-top text-[11px] text-muted">
                {fmtDateTime(t.created, tz)}
              </td>
              <td className="px-2 py-2 align-top text-muted">
                {t.reporter || <span className="text-faint">—</span>}
              </td>
              <td className="whitespace-nowrap px-2 py-2 align-top text-[11px] text-muted">
                {t.age_days != null ? `${Math.round(t.age_days)}d` : <span className="text-faint">—</span>}
              </td>
              <td className="px-2 py-2 align-top">
                <Badge variant={supStateVariant(t.state)} size="sm">
                  {t.state || "—"}
                </Badge>
              </td>
              <td className="px-2 py-2 align-top text-fg/80">
                {t.assignee || <span className="text-faint">—</span>}
              </td>
              <td className="px-2 py-2 align-top">
                {t.location ? (
                  <Badge variant={categoricalVariant(t.location)} size="sm">
                    {t.location}
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
