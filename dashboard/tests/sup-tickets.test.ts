import { describe, expect, it } from "vitest";
import type { SupTicket } from "../lib/types";
import {
  EMPTY_SUP_FILTERS,
  activeFilterCount,
  breakdownBy,
  computeSupKpi,
  filterSupTickets,
  supTicketOptions,
} from "../lib/sup-tickets";

function ticket(overrides: Partial<SupTicket>): SupTicket {
  return {
    id: "SUP-1",
    summary: "test",
    created: 0,
    state: "New",
    location: null,
    assignee: "",
    reporter: "",
    age_days: null,
    ...overrides,
  };
}

const TICKETS: SupTicket[] = [
  ticket({ id: "SUP-1", state: "Escalated", location: "SA", assignee: "Dev Lead", reporter: "Alice", age_days: 1 }),
  ticket({ id: "SUP-2", state: "Escalated", location: "UAE", assignee: "Dev Lead", reporter: "Bob", age_days: 37 }),
  ticket({ id: "SUP-3", state: "New", location: "SA", assignee: "Shad A M", reporter: "Alice", age_days: 2 }),
  ticket({ id: "SUP-4", state: "On hold", location: null, assignee: "", reporter: "", age_days: 467 }),
];

describe("filterSupTickets", () => {
  it("returns everything when no filters are active", () => {
    expect(filterSupTickets(TICKETS, EMPTY_SUP_FILTERS)).toHaveLength(4);
  });

  it("combines the 4 dimensions with AND (PM-confirmed, 2026-08-08)", () => {
    const result = filterSupTickets(TICKETS, { ...EMPTY_SUP_FILTERS, state: ["Escalated"], location: ["SA"] });
    expect(result.map((t) => t.id)).toEqual(["SUP-1"]);
  });

  it("OR's within a single dimension", () => {
    const result = filterSupTickets(TICKETS, { ...EMPTY_SUP_FILTERS, state: ["Escalated", "New"] });
    expect(result.map((t) => t.id).sort()).toEqual(["SUP-1", "SUP-2", "SUP-3"]);
  });

  it("matches blank location/assignee/reporter via their placeholder labels", () => {
    const result = filterSupTickets(TICKETS, { ...EMPTY_SUP_FILTERS, location: ["(No location)"] });
    expect(result.map((t) => t.id)).toEqual(["SUP-4"]);
  });
});

describe("supTicketOptions", () => {
  it("derives sorted, deduped options from the full ticket list", () => {
    const options = supTicketOptions(TICKETS);
    expect(options.state).toEqual(["Escalated", "New", "On hold"]);
    expect(options.location).toEqual(["(No location)", "SA", "UAE"]);
  });
});

describe("activeFilterCount", () => {
  it("sums across all 4 dimensions", () => {
    expect(activeFilterCount({ reporter: ["a"], state: ["b", "c"], location: [], assignee: ["d"] })).toBe(4);
    expect(activeFilterCount(EMPTY_SUP_FILTERS)).toBe(0);
  });
});

describe("breakdownBy", () => {
  it("matches the shape and rounding of scripts/reports/sup_posx.py's _breakdown()", () => {
    const rows = breakdownBy(TICKETS, "state");
    expect(rows.map((r) => r.state)).toEqual(["Escalated", "New", "On hold"]);
    expect(rows[0]).toEqual({ state: "Escalated", count: 2, bar: 1, pct: 50 });
    expect(rows[1]).toEqual({ state: "New", count: 1, bar: 0.5, pct: 25 });
  });

  it("groups by location using the same (No location) placeholder as the filter dropdown", () => {
    const rows = breakdownBy(TICKETS, "location");
    const byLabel = Object.fromEntries(rows.map((r) => [r.state, r.count]));
    expect(byLabel).toEqual({ SA: 2, UAE: 1, "(No location)": 1 });
  });

  it("recomputes over whatever subset is passed in, not the full set", () => {
    const filtered = filterSupTickets(TICKETS, { ...EMPTY_SUP_FILTERS, location: ["SA"] });
    const rows = breakdownBy(filtered, "state");
    expect(rows.map((r) => r.state).sort()).toEqual(["Escalated", "New"]);
    expect(rows.every((r) => r.pct === 50)).toBe(true);
  });
});

describe("computeSupKpi", () => {
  it("matches build_sup_posx()'s kpi shape over the full ticket set", () => {
    expect(computeSupKpi(TICKETS)).toEqual({
      pending: 4,
      oldest_days: 467,
      top_state: "Escalated",
      top_location: "SA",
    });
  });

  it("recomputes from a filtered subset", () => {
    const filtered = filterSupTickets(TICKETS, { ...EMPTY_SUP_FILTERS, location: ["UAE"] });
    expect(computeSupKpi(filtered)).toEqual({
      pending: 1,
      oldest_days: 37,
      top_state: "Escalated",
      top_location: "UAE",
    });
  });

  it("returns nulls for an empty ticket set rather than throwing", () => {
    expect(computeSupKpi([])).toEqual({ pending: 0, oldest_days: null, top_state: null, top_location: null });
  });
});
