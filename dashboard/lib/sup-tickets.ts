import type { StateBreakdownRow, SupTicket } from "@/lib/types";

export function reporterLabel(t: SupTicket): string {
  return t.reporter || "(No reporter)";
}
export function assigneeLabel(t: SupTicket): string {
  return t.assignee || "(Unassigned)";
}
export function locationLabel(t: SupTicket): string {
  return t.location ?? "(No location)";
}

export interface SupFilters {
  reporter: string[];
  state: string[];
  location: string[];
  assignee: string[];
}

export const EMPTY_SUP_FILTERS: SupFilters = { reporter: [], state: [], location: [], assignee: [] };

export function activeFilterCount(f: SupFilters): number {
  return f.reporter.length + f.state.length + f.location.length + f.assignee.length;
}

/** AND across the 4 dimensions (PM-confirmed, 2026-08-08); OR within a
 *  dimension (selecting two states shows tickets matching either). */
export function filterSupTickets(tickets: SupTicket[], f: SupFilters): SupTicket[] {
  return tickets.filter(
    (t) =>
      (f.reporter.length === 0 || f.reporter.includes(reporterLabel(t))) &&
      (f.state.length === 0 || f.state.includes(t.state)) &&
      (f.location.length === 0 || f.location.includes(locationLabel(t))) &&
      (f.assignee.length === 0 || f.assignee.includes(assigneeLabel(t))),
  );
}

function sortedOptions(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

/** Filter dropdown options are always derived from the FULL ticket list
 *  (not the currently-filtered subset) -- so picking Location=SA doesn't
 *  make other states/reporters disappear from their own dropdowns just
 *  because no SA ticket happens to have them right now. */
export function supTicketOptions(tickets: SupTicket[]): SupFilters {
  return {
    reporter: sortedOptions(tickets.map(reporterLabel)),
    state: sortedOptions(tickets.map((t) => t.state)),
    location: sortedOptions(tickets.map(locationLabel)),
    assignee: sortedOptions(tickets.map(assigneeLabel)),
  };
}

/**
 * Client-side port of scripts/reports/sup_posx.py's `_breakdown()` -- same
 * {state,count,bar,pct} shape (the "state" field holds a location name for
 * the By Location panel, same as the Python source). Lets By State/By
 * Location recompute from whatever filtered ticket subset the page's
 * shared filters currently produce, rather than staying pinned to the
 * full-set breakdown the Python engine originally computed (2026-08-08 fix
 * -- filtering used to only narrow the ticket table, leaving the bar
 * charts and KPI strip showing the unfiltered totals).
 */
export function breakdownBy(tickets: SupTicket[], key: "state" | "location"): StateBreakdownRow[] {
  const counts = new Map<string, number>();
  for (const t of tickets) {
    const label = key === "state" ? t.state : locationLabel(t);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const total = tickets.length || 1;
  const max = Math.max(1, ...counts.values());
  return Array.from(counts, ([state, count]) => ({
    state,
    count,
    bar: Math.round((count / max) * 1000) / 1000,
    pct: Math.round((count / total) * 1000) / 10,
  })).sort((a, b) => b.count - a.count);
}

export interface SupKpi {
  pending: number;
  oldest_days: number | null;
  top_state: string | null;
  top_location: string | null;
}

/** Client-side port of build_sup_posx()'s kpi block, recomputed over
 *  whatever ticket subset (filtered or not) is passed in. */
export function computeSupKpi(tickets: SupTicket[]): SupKpi {
  const byState = breakdownBy(tickets, "state");
  const byLocation = breakdownBy(tickets, "location");
  const ages = tickets.map((t) => t.age_days).filter((d): d is number => d != null);
  return {
    pending: tickets.length,
    oldest_days: ages.length ? Math.max(...ages) : null,
    top_state: byState[0]?.state ?? null,
    top_location: byLocation[0]?.state ?? null,
  };
}
