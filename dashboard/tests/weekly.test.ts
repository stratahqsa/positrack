import { describe, expect, it } from "vitest";
import { bucketByWeek, bucketFutureWeeks, weeklyInclude } from "../lib/weekly";
import { baseStory } from "./fixtures";

/**
 * Weekly inclusion filter + week bucketing. Cases lifted verbatim from
 * docs/reports-dashboard/reference/specs/
 * Examples_4_Weekly_Deadline_View_Implementation_Guide.md §6 (truth table,
 * "today" = Thu 9 Jul 2026) and §7 (week bucketing, anchor 2026-06-30).
 */

const ANCHOR = Date.UTC(2026, 5, 30); // 30 Jun 2026 (month is 0-based)
const JUN29_CUTOFF = Date.parse("2026-06-29T10:30:00Z");
const NOW = Date.UTC(2026, 6, 9); // Thu 9 Jul 2026 -> current week = Week 2
const WEEK_END = Date.UTC(2026, 6, 14) - 1; // last ms of Week 2 (07-13 Jul)

describe("weeklyInclude (Examples_4 §6 truth table)", () => {
  it("PXB1-3412 RE-OPEN, both deadlines + estimates -> include", () => {
    const s = baseStory({
      storyId: "PXB1-3412",
      state: "RE-OPEN",
      done: false,
      ddTs: Date.UTC(2026, 6, 8),
      qaTs: Date.UTC(2026, 6, 14),
      devEst: 960,
      uiEst: 480,
      qaEst: 240,
    });
    expect(weeklyInclude(s, JUN29_CUTOFF, WEEK_END)).toBe(true);
  });

  it("PXB1-3390 DONE, resolved 05 Jul (> jun29 cutoff) -> include", () => {
    const s = baseStory({
      storyId: "PXB1-3390",
      state: "DONE",
      done: true,
      resolved: Date.UTC(2026, 6, 5),
      ddTs: Date.UTC(2026, 6, 3),
      qaTs: Date.UTC(2026, 6, 6),
      devEst: 480,
      uiEst: 0,
      qaEst: 240,
    });
    expect(weeklyInclude(s, JUN29_CUTOFF, WEEK_END)).toBe(true);
  });

  it("PXB1-3255 DONE, resolved 25 Jun (<= jun29 cutoff) -> exclude (done too early)", () => {
    const s = baseStory({
      storyId: "PXB1-3255",
      state: "DONE",
      done: true,
      resolved: Date.UTC(2026, 5, 25),
      ddTs: Date.UTC(2026, 5, 22),
      qaTs: Date.UTC(2026, 5, 24),
      devEst: 480,
      uiEst: 0,
      qaEst: 240,
    });
    expect(weeklyInclude(s, JUN29_CUTOFF, WEEK_END)).toBe(false);
  });

  it("PXB1-3470 OPEN, missing QA deadline -> exclude", () => {
    const s = baseStory({
      storyId: "PXB1-3470",
      state: "OPEN",
      done: false,
      ddTs: Date.UTC(2026, 6, 9),
      qaTs: null,
      devEst: 960,
      uiEst: 0,
      qaEst: 480,
    });
    expect(weeklyInclude(s, JUN29_CUTOFF, WEEK_END)).toBe(false);
  });

  it("PXB1-3488 DEVELOPMENT, zero estimates -> exclude (no estimate)", () => {
    const s = baseStory({
      storyId: "PXB1-3488",
      state: "DEVELOPMENT",
      done: false,
      ddTs: Date.UTC(2026, 6, 10),
      qaTs: Date.UTC(2026, 6, 15),
      devEst: 0,
      uiEst: 0,
      qaEst: 0,
    });
    expect(weeklyInclude(s, JUN29_CUTOFF, WEEK_END)).toBe(false);
  });

  it("PXB1-3550 OPEN, dd 21 Jul > WEEK_END 13 Jul -> exclude", () => {
    const s = baseStory({
      storyId: "PXB1-3550",
      state: "OPEN",
      done: false,
      ddTs: Date.UTC(2026, 6, 21),
      qaTs: Date.UTC(2026, 6, 27),
      devEst: 480,
      uiEst: 0,
      qaEst: 240,
    });
    expect(weeklyInclude(s, JUN29_CUTOFF, WEEK_END)).toBe(false);
  });

  it("PXB1-3111 OPEN, dd 12 Jun (before anchor) -> include, folds into Week 1", () => {
    const s = baseStory({
      storyId: "PXB1-3111",
      state: "OPEN",
      done: false,
      ddTs: Date.UTC(2026, 5, 12),
      qaTs: Date.UTC(2026, 5, 20),
      devEst: 960,
      uiEst: 480,
      qaEst: 480,
    });
    expect(weeklyInclude(s, JUN29_CUTOFF, WEEK_END)).toBe(true);
  });
});

describe("bucketByWeek", () => {
  it("buckets the §6 truth table: only included stories appear, in the right weeks, sorted by qaTs then storyId", () => {
    const stories = [
      baseStory({
        storyId: "PXB1-3412",
        state: "RE-OPEN",
        done: false,
        ddTs: Date.UTC(2026, 6, 8),
        qaTs: Date.UTC(2026, 6, 14),
        devEst: 960,
        uiEst: 480,
        qaEst: 240,
      }),
      baseStory({
        storyId: "PXB1-3390",
        state: "DONE",
        done: true,
        resolved: Date.UTC(2026, 6, 5),
        ddTs: Date.UTC(2026, 6, 3),
        qaTs: Date.UTC(2026, 6, 6),
        devEst: 480,
        uiEst: 0,
        qaEst: 240,
      }),
      baseStory({
        storyId: "PXB1-3255",
        state: "DONE",
        done: true,
        resolved: Date.UTC(2026, 5, 25),
        ddTs: Date.UTC(2026, 5, 22),
        qaTs: Date.UTC(2026, 5, 24),
        devEst: 480,
        uiEst: 0,
        qaEst: 240,
      }),
      baseStory({
        storyId: "PXB1-3470",
        state: "OPEN",
        done: false,
        ddTs: Date.UTC(2026, 6, 9),
        qaTs: null,
        devEst: 960,
        uiEst: 0,
        qaEst: 480,
      }),
      baseStory({
        storyId: "PXB1-3488",
        state: "DEVELOPMENT",
        done: false,
        ddTs: Date.UTC(2026, 6, 10),
        qaTs: Date.UTC(2026, 6, 15),
        devEst: 0,
        uiEst: 0,
        qaEst: 0,
      }),
      baseStory({
        storyId: "PXB1-3550",
        state: "OPEN",
        done: false,
        ddTs: Date.UTC(2026, 6, 21),
        qaTs: Date.UTC(2026, 6, 27),
        devEst: 480,
        uiEst: 0,
        qaEst: 240,
      }),
      baseStory({
        storyId: "PXB1-3111",
        state: "OPEN",
        done: false,
        ddTs: Date.UTC(2026, 5, 12),
        qaTs: Date.UTC(2026, 5, 20),
        devEst: 960,
        uiEst: 480,
        qaEst: 480,
      }),
    ];

    const groups = bucketByWeek(stories, ANCHOR, JUN29_CUTOFF, NOW);

    expect(groups).toHaveLength(2);

    expect(groups[0].index).toBe(0);
    expect(groups[0].label).toBe("Week 1 (30 Jun – 06 Jul)");
    expect(groups[0].startMs).toBe(Date.UTC(2026, 5, 30));
    expect(groups[0].endMs).toBe(Date.UTC(2026, 6, 7) - 1);
    expect(groups[0].isCurrent).toBe(false);
    // qa asc: 3111 (20 Jun) before 3390 (06 Jul)
    expect(groups[0].stories.map((s) => s.storyId)).toEqual(["PXB1-3111", "PXB1-3390"]);

    expect(groups[1].index).toBe(1);
    expect(groups[1].label).toBe("Week 2 (07 Jul – 13 Jul)");
    expect(groups[1].startMs).toBe(Date.UTC(2026, 6, 7));
    expect(groups[1].endMs).toBe(Date.UTC(2026, 6, 14) - 1);
    expect(groups[1].isCurrent).toBe(true);
    expect(groups[1].stories.map((s) => s.storyId)).toEqual(["PXB1-3412"]);

    const allBucketed = groups.flatMap((g) => g.stories.map((s) => s.storyId));
    for (const excludedId of ["PXB1-3255", "PXB1-3470", "PXB1-3488", "PXB1-3550"]) {
      expect(allBucketed).not.toContain(excludedId);
    }
  });

  it("§7 Example 3 dd -> bucket mapping (12 Jun/06 Jul -> Week 1; 07 Jul/08 Jul -> Week 2)", () => {
    const mk = (id: string, ddTs: number) =>
      baseStory({ storyId: id, ddTs, qaTs: ddTs, devEst: 100 });

    const stories = [
      mk("A-12JUN", Date.UTC(2026, 5, 12)),
      mk("B-06JUL", Date.UTC(2026, 6, 6)),
      mk("C-07JUL", Date.UTC(2026, 6, 7)),
      mk("D-08JUL", Date.UTC(2026, 6, 8)),
    ];

    const groups = bucketByWeek(stories, ANCHOR, JUN29_CUTOFF, NOW);
    const byId = new Map(
      groups.flatMap((g) => g.stories.map((s) => [s.storyId, g.index] as const)),
    );

    expect(byId.get("A-12JUN")).toBe(0);
    expect(byId.get("B-06JUL")).toBe(0);
    expect(byId.get("C-07JUL")).toBe(1);
    expect(byId.get("D-08JUL")).toBe(1);
  });

  it("renders empty weeks in between so the timeline stays continuous (Examples_4 §12)", () => {
    const laterNow = Date.UTC(2026, 6, 21); // Tue 21 Jul 2026 -> current week = Week 4 (index 3)
    const stories = [
      baseStory({ storyId: "WK1", ddTs: Date.UTC(2026, 5, 12), qaTs: Date.UTC(2026, 5, 12), devEst: 100 }),
      baseStory({ storyId: "WK4", ddTs: Date.UTC(2026, 6, 21), qaTs: Date.UTC(2026, 6, 21), devEst: 100 }),
    ];

    const groups = bucketByWeek(stories, ANCHOR, JUN29_CUTOFF, laterNow);

    expect(groups).toHaveLength(4);
    expect(groups.map((g) => g.index)).toEqual([0, 1, 2, 3]);
    expect(groups[0].stories.map((s) => s.storyId)).toEqual(["WK1"]);
    expect(groups[1].stories).toEqual([]);
    expect(groups[2].stories).toEqual([]);
    expect(groups[3].stories.map((s) => s.storyId)).toEqual(["WK4"]);
    expect(groups[3].isCurrent).toBe(true);
  });

  it("tie-breaks equal qaTs by storyId ascending", () => {
    const sameQa = Date.UTC(2026, 6, 6);
    const stories = [
      baseStory({ storyId: "PXB1-9999", ddTs: Date.UTC(2026, 6, 6), qaTs: sameQa, devEst: 100 }),
      baseStory({ storyId: "PXB1-1000", ddTs: Date.UTC(2026, 6, 6), qaTs: sameQa, devEst: 100 }),
    ];

    const groups = bucketByWeek(stories, ANCHOR, JUN29_CUTOFF, NOW);

    expect(groups[0].stories.map((s) => s.storyId)).toEqual(["PXB1-1000", "PXB1-9999"]);
  });
});

/**
 * "Looking Ahead" preview (2026-08, PM-confirmed): up to 2 weeks after the
 * current one, but ONLY for weeks that actually have qualifying stories --
 * unlike bucketByWeek's always-continuous main timeline. NOW = Thu 9 Jul
 * 2026 -> current week = Week 2 (index 1), so the two preview weeks are
 * Week 3 (index 2, 14-20 Jul) and Week 4 (index 3, 21-27 Jul).
 */
describe("bucketFutureWeeks", () => {
  it("returns nothing when no story falls in the next 2 weeks", () => {
    const stories = [baseStory({ storyId: "THIS-WEEK", ddTs: Date.UTC(2026, 6, 9), qaTs: Date.UTC(2026, 6, 9), devEst: 100 })];
    expect(bucketFutureWeeks(stories, ANCHOR, JUN29_CUTOFF, NOW)).toEqual([]);
  });

  it("includes a week 1 out with a qualifying story, marked isFuture and not isCurrent", () => {
    const stories = [
      baseStory({ storyId: "WK3", ddTs: Date.UTC(2026, 6, 15), qaTs: Date.UTC(2026, 6, 20), devEst: 100 }),
    ];
    const groups = bucketFutureWeeks(stories, ANCHOR, JUN29_CUTOFF, NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].index).toBe(2);
    expect(groups[0].isFuture).toBe(true);
    expect(groups[0].isCurrent).toBe(false);
    expect(groups[0].stories.map((s) => s.storyId)).toEqual(["WK3"]);
  });

  it("drops an empty future week entirely instead of rendering it empty", () => {
    // Only Week 4 (index 3) has a story; Week 3 (index 2) has none and must
    // not appear at all (unlike bucketByWeek's continuous-timeline groups).
    const stories = [
      baseStory({ storyId: "WK4", ddTs: Date.UTC(2026, 6, 22), qaTs: Date.UTC(2026, 6, 27), devEst: 100 }),
    ];
    const groups = bucketFutureWeeks(stories, ANCHOR, JUN29_CUTOFF, NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].index).toBe(3);
  });

  it("does not include a 3rd week out (beyond the default weeksAhead=2)", () => {
    const stories = [
      // Week 5 (index 4, 28 Jul - 3 Aug) -- one week too far.
      baseStory({ storyId: "WK5", ddTs: Date.UTC(2026, 6, 29), qaTs: Date.UTC(2026, 7, 3), devEst: 100 }),
    ];
    expect(bucketFutureWeeks(stories, ANCHOR, JUN29_CUTOFF, NOW)).toEqual([]);
  });

  it("applies the same baseInclude rules as the main timeline (e.g. missing QA deadline excludes)", () => {
    const stories = [
      baseStory({ storyId: "NO-QA", ddTs: Date.UTC(2026, 6, 15), qaTs: null, devEst: 100 }),
    ];
    expect(bucketFutureWeeks(stories, ANCHOR, JUN29_CUTOFF, NOW)).toEqual([]);
  });

  it("sorts by qaTs ascending within a future week", () => {
    const stories = [
      baseStory({ storyId: "PXB1-9999", ddTs: Date.UTC(2026, 6, 15), qaTs: Date.UTC(2026, 6, 20), devEst: 100 }),
      baseStory({ storyId: "PXB1-1000", ddTs: Date.UTC(2026, 6, 15), qaTs: Date.UTC(2026, 6, 18), devEst: 100 }),
    ];
    const groups = bucketFutureWeeks(stories, ANCHOR, JUN29_CUTOFF, NOW);
    expect(groups[0].stories.map((s) => s.storyId)).toEqual(["PXB1-1000", "PXB1-9999"]);
  });
});
