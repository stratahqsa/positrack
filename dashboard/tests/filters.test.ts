import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS,
  activeFilterCount,
  applyFilters,
  deriveFilterOptions,
  parseFilters,
  toQueryString,
  type Filters,
} from "../lib/filters";
import { baseStory } from "./fixtures";

/**
 * URL-based global filter model: Filters <-> URLSearchParams (both the client
 * `useSearchParams()` shape and the Next.js server `searchParams` record
 * shape), plus the pure `applyFilters` predicate. See docs/reports-dashboard/
 * plans/03-weekly-deadline-filters.md Task 3 for the field/behavior contract.
 */

describe("EMPTY_FILTERS", () => {
  it("is all-empty arrays and false toggles", () => {
    expect(EMPTY_FILTERS).toEqual<Filters>({
      assignee: [],
      sprint: [],
      state: [],
      epic: [],
      week: [],
      pendingOnly: false,
      overdueOnly: false,
      reopenedOnly: false,
    });
  });
});

describe("parseFilters", () => {
  it("parses an empty URLSearchParams to the empty filters", () => {
    expect(parseFilters(new URLSearchParams())).toEqual(EMPTY_FILTERS);
  });

  it("parses repeated keys on a URLSearchParams as multi-select arrays", () => {
    const sp = new URLSearchParams();
    sp.append("assignee", "Fahad K");
    sp.append("assignee", "Anjali R");
    sp.append("week", "0");
    sp.append("week", "2");
    sp.append("pendingOnly", "1");

    const f = parseFilters(sp);
    expect(f.assignee).toEqual(["Fahad K", "Anjali R"]);
    expect(f.week).toEqual([0, 2]);
    expect(f.week.every((n) => typeof n === "number")).toBe(true);
    expect(f.pendingOnly).toBe(true);
    expect(f.overdueOnly).toBe(false);
  });

  it("parses the Next.js server searchParams record shape (string | string[] | undefined)", () => {
    const f = parseFilters({
      assignee: "Fahad K",
      sprint: ["Sprint 14", "Sprint 15"],
      state: undefined,
      reopenedOnly: "1",
    });
    expect(f.assignee).toEqual(["Fahad K"]);
    expect(f.sprint).toEqual(["Sprint 14", "Sprint 15"]);
    expect(f.state).toEqual([]);
    expect(f.reopenedOnly).toBe(true);
    expect(f.overdueOnly).toBe(false);
  });
});

describe("toQueryString", () => {
  it("omits empty keys entirely for EMPTY_FILTERS", () => {
    expect(toQueryString(EMPTY_FILTERS)).toBe("");
  });

  it("emits repeated params for multi-select dims and only-when-true toggles", () => {
    const f: Filters = {
      ...EMPTY_FILTERS,
      assignee: ["Fahad K", "Anjali R"],
      overdueOnly: true,
    };
    const qs = toQueryString(f);
    const sp = new URLSearchParams(qs);
    expect(sp.getAll("assignee")).toEqual(["Fahad K", "Anjali R"]);
    expect(sp.get("overdueOnly")).toBe("1");
    expect(sp.has("pendingOnly")).toBe(false);
    expect(sp.has("reopenedOnly")).toBe(false);
  });
});

describe("round-trip", () => {
  it("parseFilters(toQueryString(f)) recovers f for a fully-populated filter set", () => {
    const f: Filters = {
      assignee: ["Fahad K", "Anjali R"],
      sprint: ["Sprint 14"],
      state: ["OPEN", "RE-OPEN"],
      epic: ["PXB1-3101"],
      week: [0, 1, 3],
      pendingOnly: true,
      overdueOnly: false,
      reopenedOnly: true,
    };
    const roundTripped = parseFilters(new URLSearchParams(toQueryString(f)));
    expect(roundTripped).toEqual(f);
  });

  it("round-trips the empty filter set back to itself", () => {
    const roundTripped = parseFilters(new URLSearchParams(toQueryString(EMPTY_FILTERS)));
    expect(roundTripped).toEqual(EMPTY_FILTERS);
  });
});

describe("applyFilters", () => {
  const now = Date.UTC(2026, 6, 9);
  const stories = [
    baseStory({
      storyId: "S1",
      assignee: "Fahad K",
      sprint: "Sprint 14",
      state: "OPEN",
      epicId: "PXB1-3101",
      done: false,
      qaTs: Date.UTC(2026, 6, 1), // in the past -> overdue (not done)
    }),
    baseStory({
      storyId: "S2",
      assignee: "Anjali R",
      sprint: "Sprint 15",
      state: "RE-OPEN",
      epicId: "PXB1-3200",
      done: false,
      qaTs: Date.UTC(2026, 6, 20), // in the future -> not overdue
    }),
    baseStory({
      storyId: "S3",
      assignee: "Fahad K",
      sprint: "Sprint 15",
      state: "DONE",
      done: true,
      epicId: "PXB1-3101",
      qaTs: Date.UTC(2026, 6, 1),
    }),
  ];

  it("empty filters returns every story unchanged", () => {
    expect(applyFilters(stories, EMPTY_FILTERS, now)).toEqual(stories);
  });

  it("multi-select OR within a dimension", () => {
    const f: Filters = { ...EMPTY_FILTERS, assignee: ["Fahad K", "Anjali R"] };
    expect(applyFilters(stories, f, now).map((s) => s.storyId)).toEqual(["S1", "S2", "S3"]);

    const f2: Filters = { ...EMPTY_FILTERS, sprint: ["Sprint 14"] };
    expect(applyFilters(stories, f2, now).map((s) => s.storyId)).toEqual(["S1"]);
  });

  it("AND across dimensions", () => {
    const f: Filters = { ...EMPTY_FILTERS, assignee: ["Fahad K"], state: ["OPEN"] };
    // S3 is also Fahad K but DONE, not OPEN -> excluded; S1 matches both.
    expect(applyFilters(stories, f, now).map((s) => s.storyId)).toEqual(["S1"]);
  });

  it("epic dimension filters on epicId", () => {
    const f: Filters = { ...EMPTY_FILTERS, epic: ["PXB1-3200"] };
    expect(applyFilters(stories, f, now).map((s) => s.storyId)).toEqual(["S2"]);
  });

  it("pendingOnly excludes done stories", () => {
    const f: Filters = { ...EMPTY_FILTERS, pendingOnly: true };
    expect(applyFilters(stories, f, now).map((s) => s.storyId)).toEqual(["S1", "S2"]);
  });

  it("overdueOnly keeps not-done stories whose qaTs is before now", () => {
    const f: Filters = { ...EMPTY_FILTERS, overdueOnly: true };
    // S1: not done, qa in the past -> overdue. S2: not done, qa in the future -> not overdue.
    // S3: qa in the past but done -> not overdue (done excludes it).
    expect(applyFilters(stories, f, now).map((s) => s.storyId)).toEqual(["S1"]);
  });

  it("overdueOnly excludes stories with no QA deadline", () => {
    const withNullQa = [...stories, baseStory({ storyId: "S4", done: false, qaTs: null })];
    const f: Filters = { ...EMPTY_FILTERS, overdueOnly: true };
    expect(applyFilters(withNullQa, f, now).map((s) => s.storyId)).toEqual(["S1"]);
  });

  it("reopenedOnly matches state containing 're-open' case-insensitively", () => {
    const f: Filters = { ...EMPTY_FILTERS, reopenedOnly: true };
    expect(applyFilters(stories, f, now).map((s) => s.storyId)).toEqual(["S2"]);
  });

  it("the week dimension is not applied by applyFilters (resolved at the week-group level, not per-story)", () => {
    const f: Filters = { ...EMPTY_FILTERS, week: [5] };
    expect(applyFilters(stories, f, now).map((s) => s.storyId)).toEqual(["S1", "S2", "S3"]);
  });
});

describe("deriveFilterOptions", () => {
  it("returns sorted, deduped, non-empty option lists per dimension", () => {
    const stories = [
      baseStory({ assignee: "Fahad K", sprint: "Sprint 15", state: "OPEN", epicId: "PXB1-3200" }),
      baseStory({ assignee: "Anjali R", sprint: "Sprint 14", state: "RE-OPEN", epicId: "PXB1-3101" }),
      baseStory({ assignee: "Fahad K", sprint: "Sprint 14", state: "OPEN", epicId: "PXB1-3101" }),
      // Blank/null values must not appear in the derived options.
      baseStory({ assignee: "", sprint: "", state: "OPEN", epicId: null }),
    ];

    const options = deriveFilterOptions(stories);
    expect(options.assignee).toEqual(["Anjali R", "Fahad K"]);
    expect(options.sprint).toEqual(["Sprint 14", "Sprint 15"]);
    expect(options.state).toEqual(["OPEN", "RE-OPEN"]);
    expect(options.epic).toEqual(["PXB1-3101", "PXB1-3200"]);
  });

  it("returns empty arrays for an empty story list", () => {
    expect(deriveFilterOptions([])).toEqual({ assignee: [], sprint: [], state: [], epic: [] });
  });
});

describe("activeFilterCount", () => {
  it("is 0 for the empty filters", () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
  });

  it("counts one per active dimension (regardless of how many values selected) plus one per active toggle", () => {
    const f: Filters = {
      ...EMPTY_FILTERS,
      assignee: ["Fahad K", "Anjali R"], // 2 values, still +1
      state: ["OPEN"],
      pendingOnly: true,
    };
    expect(activeFilterCount(f)).toBe(3);
  });

  it("counts all 8 controls when everything is active", () => {
    const f: Filters = {
      assignee: ["A"],
      sprint: ["S"],
      state: ["ST"],
      epic: ["E"],
      week: [0],
      pendingOnly: true,
      overdueOnly: true,
      reopenedOnly: true,
    };
    expect(activeFilterCount(f)).toBe(8);
  });
});
