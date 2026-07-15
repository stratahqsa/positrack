import { describe, expect, it } from "vitest";
import { hasP2Count, missingEstCount, readyToMoveCount, watchList } from "../lib/effort";
import { baseSnapshot } from "./fixtures";
import type { Epic, Rollup } from "../lib/types";

/**
 * Effort Report watch-list + info-bar derivations (docs/reports-dashboard/
 * plans/06-effort.md Task 1). Cases lifted from docs/reports-dashboard/
 * reference/specs/PRD_3_Phase1_Effort_Report_v16.md ("Watch List (S5)" §,
 * "Missing-estimate flag (S1)" §) and Examples_3_Effort_Report_v16_
 * Implementation_Guide.md §8 (worked watch-list examples) + §10 T13.
 */

const EMPTY_ROLLUP: Rollup = { server: 0, ui: 0, testing: 0 };

/** Minimal, fully-typed Epic fixture (mirrors release.test.ts's local
 *  makeEffortEpic convention). Defaults to a PENDING epic with no P2
 *  leakage; tests override just the fields under test. */
function makeEpic(overrides: Partial<Epic> = {}): Epic {
  return {
    id: "PXB1-0000",
    summary: "Fixture epic",
    created: 0,
    resolved: null,
    assignee: "Fixture Assignee",
    epic_state: "OPEN",
    stories: [],
    rollup_all: { ...EMPTY_ROLLUP },
    epic_est: { ...EMPTY_ROLLUP },
    rollup: { ...EMPTY_ROLLUP },
    category: "PENDING",
    missing_est: false,
    total: 0,
    spent: 0,
    overshoot: false,
    ...overrides,
  };
}

/** Empty-Effort fixture (all sections/totals zeroed via fixtures.ts's
 *  baseSnapshot) with just the `pending`/`mixed`/`done` buckets the caller
 *  cares about filled in — everything else stays at its zero default. */
function makeEffort(
  overrides: Partial<{ pending: Epic[]; mixed: Epic[]; done: Epic[]; noStories: Epic[] }> = {},
) {
  const effort = baseSnapshot().effort;
  effort.sections.pending = overrides.pending ?? [];
  effort.sections.mixed = overrides.mixed ?? [];
  effort.sections.done = overrides.done ?? [];
  effort.sections.no_stories = overrides.noStories ?? [];
  return effort;
}

describe("watchList (PRD_3 'Watch List (S5)' / Examples_3 §8)", () => {
  it("PXB1-3101-style row (from S2): p1_pending=2, p2_stories=1 -> source S2, NOT ready ('2 P1 remaining')", () => {
    const epic = makeEpic({ id: "PXB1-3101", category: "MIXED", p1_pending: 2, p2_stories: 1, has_p2: true });
    const effort = makeEffort({ mixed: [epic] });

    const list = watchList(effort);

    expect(list).toHaveLength(1);
    expect(list[0].epic).toBe(epic);
    expect(list[0].source).toBe("S2");
    expect(list[0].p1_pending).toBe(2);
    expect(list[0].p2_stories).toBe(1);
    expect(list[0].ready).toBe(false);
  });

  it("PXB1-3140-style row (from S1): p1_pending=0, p2_stories=3 -> source S1, ready (T13: '✓ Ready to move to P2')", () => {
    const epic = makeEpic({ id: "PXB1-3140", category: "PENDING", p1_pending: 0, p2_stories: 3, has_p2: true });
    const effort = makeEffort({ pending: [epic] });

    const list = watchList(effort);

    expect(list).toHaveLength(1);
    expect(list[0].epic).toBe(epic);
    expect(list[0].source).toBe("S1");
    expect(list[0].p1_pending).toBe(0);
    expect(list[0].p2_stories).toBe(3);
    expect(list[0].ready).toBe(true);
  });

  it("§8 aggregate example: 1 S1 (ready) + 1 S2 (not ready) -> S1 entries precede S2 entries", () => {
    const s1Epic = makeEpic({ id: "PXB1-3140", category: "PENDING", p1_pending: 0, p2_stories: 3, has_p2: true });
    const s2Epic = makeEpic({ id: "PXB1-3101", category: "MIXED", p1_pending: 2, p2_stories: 1, has_p2: true });
    const effort = makeEffort({ pending: [s1Epic], mixed: [s2Epic] });

    const list = watchList(effort);

    expect(list.map((w) => [w.epic.id, w.source, w.ready])).toEqual([
      ["PXB1-3140", "S1", true],
      ["PXB1-3101", "S2", false],
    ]);
  });

  it("a PENDING epic with p2_stories=0 is excluded (no Phase 2 leakage -> not a watch item)", () => {
    const epic = makeEpic({ id: "PXB1-clean", category: "PENDING", p1_pending: 1, p2_stories: 0, has_p2: false });
    const effort = makeEffort({ pending: [epic] });

    expect(watchList(effort)).toHaveLength(0);
  });

  it("a MIXED epic with p2_stories=0 is excluded", () => {
    const epic = makeEpic({ id: "PXB1-clean2", category: "MIXED", p1_pending: 1, p2_stories: 0, has_p2: false });
    const effort = makeEffort({ mixed: [epic] });

    expect(watchList(effort)).toHaveLength(0);
  });

  it("p2_stories/p1_pending absent (older snapshot, optional fields) -> defaults to 0, excluded, never crashes", () => {
    const epic = makeEpic({ id: "PXB1-old", category: "PENDING" });
    delete epic.p2_stories;
    delete epic.p1_pending;
    const effort = makeEffort({ pending: [epic] });

    expect(() => watchList(effort)).not.toThrow();
    expect(watchList(effort)).toHaveLength(0);
  });

  it("DONE and NO_STORIES sections are never read, even if an epic there happens to carry p2_stories>0", () => {
    const doneEpic = makeEpic({ id: "PXB1-done", category: "DONE", p2_stories: 5, p1_pending: 0, has_p2: true });
    const noStoriesEpic = makeEpic({ id: "PXB1-ns", category: "NO_STORIES", p2_stories: 5, p1_pending: 0, has_p2: true });
    const effort = makeEffort({ done: [doneEpic], noStories: [noStoriesEpic] });

    expect(watchList(effort)).toHaveLength(0);
  });

  it("empty effort (no epics anywhere) -> empty watch list", () => {
    expect(watchList(makeEffort())).toEqual([]);
  });
});

describe("missingEstCount (PRD_3 §4 'Missing-estimate flag (S1)')", () => {
  it("counts PENDING epics flagged missing_est", () => {
    const flagged = makeEpic({ id: "PXB1-flag1", category: "PENDING", missing_est: true });
    const clean = makeEpic({ id: "PXB1-clean", category: "PENDING", missing_est: false });
    const effort = makeEffort({ pending: [flagged, clean] });

    expect(missingEstCount(effort)).toBe(1);
  });

  it("scoped to S1 only: a MIXED epic flagged missing_est does NOT count", () => {
    const mixedFlagged = makeEpic({ id: "PXB1-mixedflag", category: "MIXED", missing_est: true });
    const effort = makeEffort({ mixed: [mixedFlagged] });

    expect(missingEstCount(effort)).toBe(0);
  });

  it("scoped to S1 only: a DONE epic flagged missing_est does NOT count", () => {
    const doneFlagged = makeEpic({ id: "PXB1-doneflag", category: "DONE", missing_est: true });
    const effort = makeEffort({ done: [doneFlagged] });

    expect(missingEstCount(effort)).toBe(0);
  });

  it("no pending epics flagged -> 0", () => {
    const effort = makeEffort({ pending: [makeEpic({ missing_est: false })] });
    expect(missingEstCount(effort)).toBe(0);
  });
});

describe("hasP2Count / readyToMoveCount (info-bar counts, Examples_3 §8 top-bar text)", () => {
  it("'2 Phase 1 epics contain Phase 2 stories (S1: 1, S2: 1). ✓ 1 epic(s) ready to move.'", () => {
    const s1Ready = makeEpic({ id: "PXB1-3140", category: "PENDING", p1_pending: 0, p2_stories: 3, has_p2: true });
    const s2NotReady = makeEpic({ id: "PXB1-3101", category: "MIXED", p1_pending: 2, p2_stories: 1, has_p2: true });
    const effort = makeEffort({ pending: [s1Ready], mixed: [s2NotReady] });

    expect(hasP2Count(effort)).toBe(2);
    expect(readyToMoveCount(effort)).toBe(1);
  });

  it("hasP2Count always equals watchList(effort).length", () => {
    const a = makeEpic({ id: "PXB1-a", category: "PENDING", p1_pending: 0, p2_stories: 1, has_p2: true });
    const b = makeEpic({ id: "PXB1-b", category: "MIXED", p1_pending: 1, p2_stories: 2, has_p2: true });
    const c = makeEpic({ id: "PXB1-c", category: "MIXED", p1_pending: 0, p2_stories: 1, has_p2: true });
    const effort = makeEffort({ pending: [a], mixed: [b, c] });

    expect(hasP2Count(effort)).toBe(watchList(effort).length);
    expect(hasP2Count(effort)).toBe(3);
  });

  it("readyToMoveCount is 0 when no watch-list epic has p1_pending=0", () => {
    const notReady = makeEpic({ id: "PXB1-nr", category: "PENDING", p1_pending: 4, p2_stories: 1, has_p2: true });
    const effort = makeEffort({ pending: [notReady] });

    expect(readyToMoveCount(effort)).toBe(0);
  });

  it("empty effort -> both counts are 0", () => {
    const effort = makeEffort();
    expect(hasP2Count(effort)).toBe(0);
    expect(readyToMoveCount(effort)).toBe(0);
  });
});
