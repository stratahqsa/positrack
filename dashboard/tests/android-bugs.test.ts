import { describe, expect, it } from "vitest";
import type { DrillBug } from "../lib/types";
import { pendingBugStateBreakdown } from "../lib/android-bugs";

function bug(overrides: Partial<DrillBug>): DrillBug {
  return {
    bugId: "APP-1",
    summary: "test",
    state: "Open",
    assignee: "",
    priority: "",
    devTicketId: "PXB1-1",
    ...overrides,
  };
}

describe("pendingBugStateBreakdown", () => {
  it("matches the shape and rounding of lib/sup-tickets.ts's breakdownBy()", () => {
    const bugs = [
      bug({ bugId: "APP-1", state: "Open" }),
      bug({ bugId: "APP-2", state: "Open" }),
      bug({ bugId: "APP-3", state: "On Hold" }),
      bug({ bugId: "APP-4", state: "On Hold" }),
      bug({ bugId: "APP-5", state: "On Hold" }),
      bug({ bugId: "APP-6", state: "Code-Review" }),
    ];
    const rows = pendingBugStateBreakdown(bugs);
    expect(rows.map((r) => r.state)).toEqual(["On Hold", "Open", "Code-Review"]);
    expect(rows[0]).toEqual({ state: "On Hold", count: 3, bar: 1, pct: 50 });
    expect(rows[1]).toEqual({ state: "Open", count: 2, bar: 0.667, pct: 33.3 });
    expect(rows[2]).toEqual({ state: "Code-Review", count: 1, bar: 0.333, pct: 16.7 });
  });

  it("groups blank state under the placeholder label", () => {
    const rows = pendingBugStateBreakdown([bug({ bugId: "APP-1", state: "" })]);
    expect(rows).toEqual([{ state: "—", count: 1, bar: 1, pct: 100 }]);
  });

  it("returns an empty array for no bugs, never dividing by zero", () => {
    expect(pendingBugStateBreakdown([])).toEqual([]);
  });
});
