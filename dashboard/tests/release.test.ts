import { describe, expect, it } from "vitest";
import {
  assigneeByEpic,
  buildEpicView,
  epicBadge,
  grandTotals,
  groupByMilestone,
} from "../lib/release";
import { baseSnapshot, baseStory } from "./fixtures";
import type { Epic, Rollup, ScheduleEpic } from "../lib/types";

/**
 * Release Schedule logic. Cases lifted from docs/reports-dashboard/reference/specs/
 * Examples_2_Release_Schedule_Tracker_Implementation_Guide.md (badge §3, visibility
 * §4, milestone §5, resolved-date §6, NEW §7, grand totals §9, acceptance tests §11)
 * and PRD_2_Phase1_Release_Schedule_Tracker.md §5.
 *
 * Constants mirror weekly.test.ts's convention of deriving cutoffs via Date.parse
 * on the config ISO strings rather than hardcoding epoch numbers.
 */

const MTG_CUTOFF = Date.parse("2026-07-03T10:30:00Z"); // 3 Jul 2026 4:00 PM IST
const JUN29_CUTOFF = Date.parse("2026-06-29T10:30:00Z"); // 29 Jun 2026 4:00 PM IST
const DISPLAY_CUTOFF = Date.parse("2026-07-03T00:00:00Z"); // meeting calendar day

const EMPTY_ROLLUP: Rollup = { server: 0, ui: 0, testing: 0 };

/** Minimal, fully-typed effort.sections Epic fixture (assigneeByEpic only reads id/assignee). */
function makeEffortEpic(overrides: Partial<Epic> = {}): Epic {
  return {
    id: "PXB1-0000",
    summary: "Fixture effort epic",
    created: 0,
    resolved: null,
    assignee: "",
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

/** Minimal ScheduleEpic fixture (schedule.epics only ever carries these 4 fields). */
function makeScheduleEpic(overrides: Partial<ScheduleEpic> = {}): ScheduleEpic {
  return {
    id: "PXB1-0000",
    summary: "Fixture schedule epic",
    resolved: null,
    created: null,
    ...overrides,
  };
}

describe("assigneeByEpic", () => {
  it("maps epic id -> assignee across all four effort.sections buckets (done/pending/mixed/no_stories)", () => {
    const snap = baseSnapshot();
    snap.effort.sections = {
      done: [makeEffortEpic({ id: "PXB1-1", assignee: "Alice" })],
      pending: [makeEffortEpic({ id: "PXB1-2", assignee: "Bob" })],
      mixed: [makeEffortEpic({ id: "PXB1-3", assignee: "Carol" })],
      no_stories: [makeEffortEpic({ id: "PXB1-4", assignee: "Dev Lead" })],
      p2_backlog: [],
    };

    const map = assigneeByEpic(snap);

    expect(map["PXB1-1"]).toBe("Alice");
    expect(map["PXB1-2"]).toBe("Bob");
    expect(map["PXB1-3"]).toBe("Carol");
    expect(map["PXB1-4"]).toBe("Dev Lead");
  });

  it("an epic id absent from effort.sections resolves to '' via the caller's ?? fallback", () => {
    const snap = baseSnapshot();
    snap.effort.sections.done = [makeEffortEpic({ id: "PXB1-1", assignee: "Alice" })];

    const map = assigneeByEpic(snap);

    expect(map["PXB1-999"] ?? "").toBe("");
  });
});

describe("epicBadge (Examples_2 §3 — all four cases, plus the override)", () => {
  it("PXB1-3101-style: 2 done + 2 pending -> NOT_DONE (any pending)", () => {
    const stories = [
      baseStory({ storyId: "PXB1-3412", state: "RE-OPEN", done: false }),
      baseStory({ storyId: "PXB1-3415", state: "OPEN", done: false }),
      baseStory({ storyId: "PXB1-3390", state: "Fixed", done: true, resolved: Date.UTC(2026, 6, 5) }),
      baseStory({ storyId: "PXB1-3388", state: "Fixed", done: true, resolved: Date.UTC(2026, 6, 1) }),
    ];
    expect(epicBadge(stories, null, MTG_CUTOFF)).toBe("NOT_DONE");
  });

  it("PXB1-3120-style: 3 stories, all Verified/done -> DONE", () => {
    const stories = [
      baseStory({ storyId: "PXB1-a", state: "Verified", done: true, resolved: Date.UTC(2026, 5, 30) }),
      baseStory({ storyId: "PXB1-b", state: "Verified", done: true, resolved: Date.UTC(2026, 6, 2) }),
      baseStory({ storyId: "PXB1-c", state: "Verified", done: true, resolved: Date.UTC(2026, 5, 27) }),
    ];
    expect(epicBadge(stories, null, MTG_CUTOFF)).toBe("DONE");
  });

  it("PXB1-3140-style (T3): exactly 1 story, state TESTING -> shows 'TESTING', not NOT_DONE", () => {
    const stories = [baseStory({ storyId: "PXB1-3140s", state: "TESTING", done: false })];
    expect(epicBadge(stories, null, MTG_CUTOFF)).toBe("TESTING");
  });

  it("PXB1-3155-style (T4/no-stories row): 0 stories -> NO_STORIES", () => {
    expect(epicBadge([], null, MTG_CUTOFF)).toBe("NO_STORIES");
  });

  it("vacuous-truth guard: 0 stories must NOT fall through to the 'all done' check as DONE", () => {
    // [].every(...) is vacuously true in JS -- NO_STORIES must be checked first.
    expect(epicBadge([], null, MTG_CUTOFF)).not.toBe("DONE");
  });

  it("PXB1-3160-style (T5): 2 OPEN stories, but epic resolved 5 Jul (> MTG_CUTOFF) -> DONE override", () => {
    const stories = [
      baseStory({ storyId: "PXB1-x", state: "OPEN", done: false }),
      baseStory({ storyId: "PXB1-y", state: "OPEN", done: false }),
    ];
    const epicResolvedMs = Date.UTC(2026, 6, 5);
    expect(epicBadge(stories, epicResolvedMs, MTG_CUTOFF)).toBe("DONE");
  });

  it("epic resolved exactly AT the cutoff (not strictly after) does NOT override -- strict '>' required", () => {
    const stories = [baseStory({ storyId: "PXB1-x", state: "OPEN", done: false })];
    expect(epicBadge(stories, MTG_CUTOFF, MTG_CUTOFF)).toBe("OPEN"); // falls through to single-story state
  });

  it("epic resolved BEFORE the cutoff with pending stories does NOT override -> normal rules apply", () => {
    const stories = [
      baseStory({ storyId: "PXB1-x", state: "OPEN", done: false }),
      baseStory({ storyId: "PXB1-y", state: "OPEN", done: false }),
    ];
    const epicResolvedMs = Date.UTC(2026, 5, 20); // well before MTG_CUTOFF
    expect(epicBadge(stories, epicResolvedMs, MTG_CUTOFF)).toBe("NOT_DONE");
  });

  it("a single DONE story -> badge is DONE (the 'all done' check wins over the single-story-state display)", () => {
    const stories = [baseStory({ storyId: "PXB1-solo", state: "Verified", done: true, resolved: Date.UTC(2026, 6, 2) })];
    expect(epicBadge(stories, null, MTG_CUTOFF)).toBe("DONE");
  });
});

describe("buildEpicView -- story visibility (Examples_2 §4)", () => {
  it("NOT_DONE epic (PXB1-3101 worked example): pending stories visible, done-after-mtg visible, done-before-mtg hidden (T6/T7)", () => {
    const epic = makeScheduleEpic({ id: "PXB1-3101" });
    const reopen = baseStory({ storyId: "PXB1-3412", state: "RE-OPEN", done: false });
    const open = baseStory({ storyId: "PXB1-3415", state: "OPEN", done: false });
    const doneAfterMtg = baseStory({
      storyId: "PXB1-3390",
      state: "Fixed",
      done: true,
      resolved: Date.UTC(2026, 6, 5), // 5 Jul > mtg 3 Jul
    });
    const doneBeforeMtg = baseStory({
      storyId: "PXB1-3388",
      state: "Fixed",
      done: true,
      resolved: Date.UTC(2026, 6, 1), // 1 Jul < mtg 3 Jul
    });
    const stories = [reopen, open, doneAfterMtg, doneBeforeMtg];

    const view = buildEpicView(epic, stories, "Anjali R", MTG_CUTOFF, JUN29_CUTOFF, 0);

    expect(view.badge).toBe("NOT_DONE");
    expect(view.visibleStories.map((s) => s.storyId).sort()).toEqual(
      ["PXB1-3412", "PXB1-3415", "PXB1-3390"].sort(),
    );
    expect(view.visibleStories.map((s) => s.storyId)).not.toContain("PXB1-3388");
  });

  it("DONE epic (PXB1-3120 worked example): stories resolved 30 Jun & 2 Jul visible (> jun29); 27 Jun hidden (T8)", () => {
    const epic = makeScheduleEpic({ id: "PXB1-3120" });
    const s30jun = baseStory({ storyId: "PXB1-s1", state: "Verified", done: true, resolved: Date.UTC(2026, 5, 30) });
    const s2jul = baseStory({ storyId: "PXB1-s2", state: "Verified", done: true, resolved: Date.UTC(2026, 6, 2) });
    const s27jun = baseStory({ storyId: "PXB1-s3", state: "Verified", done: true, resolved: Date.UTC(2026, 5, 27) });
    const stories = [s30jun, s2jul, s27jun];

    const view = buildEpicView(epic, stories, "Someone", MTG_CUTOFF, JUN29_CUTOFF, 0);

    expect(view.badge).toBe("DONE");
    expect(view.visibleStories.map((s) => s.storyId).sort()).toEqual(["PXB1-s1", "PXB1-s2"].sort());
    expect(view.visibleStories.map((s) => s.storyId)).not.toContain("PXB1-s3");
  });
});

describe("buildEpicView -- rollup (Examples_2 §4)", () => {
  it("NOT_DONE epic: rollup sums ONLY pending stories, excluding the done-since-mtg one shown for visibility", () => {
    const epic = makeScheduleEpic({ id: "PXB1-3101" });
    const reopen = baseStory({ storyId: "PXB1-3412", state: "RE-OPEN", done: false, devEst: 960, uiEst: 480, qaEst: 240, spent: 1110 });
    const open = baseStory({ storyId: "PXB1-3415", state: "OPEN", done: false, devEst: 240, uiEst: 0, qaEst: 120, spent: 60 });
    const doneAfterMtg = baseStory({
      storyId: "PXB1-3390",
      state: "Fixed",
      done: true,
      resolved: Date.UTC(2026, 6, 5),
      devEst: 5000,
      uiEst: 5000,
      qaEst: 5000,
      spent: 5000, // large decoys to prove this story is excluded from the sum
    });
    const stories = [reopen, open, doneAfterMtg];

    const view = buildEpicView(epic, stories, "Anjali R", MTG_CUTOFF, JUN29_CUTOFF, 0);

    expect(view.rollup).toEqual({ dev: 1200, ui: 480, qa: 360, spent: 1170 });
  });

  it("DONE epic: rollup sums over the visible (resolved > jun29) stories, matching visibleStories exactly", () => {
    const epic = makeScheduleEpic({ id: "PXB1-3120" });
    const s30jun = baseStory({ storyId: "PXB1-s1", state: "Verified", done: true, resolved: Date.UTC(2026, 5, 30), devEst: 100, uiEst: 0, qaEst: 0, spent: 100 });
    const s2jul = baseStory({ storyId: "PXB1-s2", state: "Verified", done: true, resolved: Date.UTC(2026, 6, 2), devEst: 200, uiEst: 0, qaEst: 0, spent: 200 });
    const s27jun = baseStory({ storyId: "PXB1-s3", state: "Verified", done: true, resolved: Date.UTC(2026, 5, 27), devEst: 9999, uiEst: 0, qaEst: 0, spent: 9999 });
    const stories = [s30jun, s2jul, s27jun];

    const view = buildEpicView(epic, stories, "Someone", MTG_CUTOFF, JUN29_CUTOFF, 0);

    expect(view.rollup).toEqual({ dev: 300, ui: 0, qa: 0, spent: 300 });
  });
});

describe("buildEpicView -- milestone (Examples_2 §5, T9/T18)", () => {
  it("milestone = max(ddTs, qaTs) across ALL stories, including hidden/pending ones", () => {
    const epic = makeScheduleEpic({ id: "PXB1-3101" });
    const stories = [
      baseStory({ storyId: "PXB1-a", ddTs: Date.UTC(2026, 6, 8), qaTs: Date.UTC(2026, 6, 14) }),
      baseStory({ storyId: "PXB1-b", ddTs: Date.UTC(2026, 6, 10), qaTs: Date.UTC(2026, 6, 13) }),
    ];

    const view = buildEpicView(epic, stories, "Anjali R", MTG_CUTOFF, JUN29_CUTOFF, 0);

    expect(view.milestoneMs).toBe(Date.UTC(2026, 6, 14)); // 14 Jul, the max across both stories
  });

  it("T18: epic without any story deadlines but resolved -> milestone falls back to epic.resolved", () => {
    const epicResolvedMs = Date.UTC(2026, 6, 6);
    const epic = makeScheduleEpic({ id: "PXB1-fallback", resolved: epicResolvedMs });
    const stories = [baseStory({ storyId: "PXB1-a", ddTs: null, qaTs: null, done: true, resolved: epicResolvedMs })];

    const view = buildEpicView(epic, stories, "Someone", MTG_CUTOFF, JUN29_CUTOFF, 0);

    expect(view.milestoneMs).toBe(epicResolvedMs);
  });

  it("no deadlines anywhere and epic unresolved -> milestone is null (never crashes)", () => {
    const epic = makeScheduleEpic({ id: "PXB1-nodate", resolved: null });
    const stories = [baseStory({ storyId: "PXB1-a", ddTs: null, qaTs: null, done: false })];

    const view = buildEpicView(epic, stories, "Someone", MTG_CUTOFF, JUN29_CUTOFF, 0);

    expect(view.milestoneMs).toBeNull();
  });
});

describe("buildEpicView -- resolved date + verdict (Examples_2 §6, T13)", () => {
  it("DONE epic: resolvedMs = max story resolved date; early (green) verdict when on/before milestone", () => {
    const epic = makeScheduleEpic({ id: "PXB1-3120" });
    const stories = [
      baseStory({ storyId: "PXB1-a", done: true, resolved: Date.UTC(2026, 6, 2), ddTs: Date.UTC(2026, 6, 6), qaTs: null }),
    ];

    const view = buildEpicView(epic, stories, "Someone", MTG_CUTOFF, JUN29_CUTOFF, 0);

    expect(view.resolvedMs).toBe(Date.UTC(2026, 6, 2));
    expect(view.milestoneMs).toBe(Date.UTC(2026, 6, 6));
    expect(view.resolvedVerdict).toEqual({ label: "4d early", late: false });
  });

  it("T13: DONE epic resolved 08 Jul vs milestone 06 Jul -> late (red) verdict", () => {
    const epic = makeScheduleEpic({ id: "PXB1-3122" });
    const stories = [
      baseStory({ storyId: "PXB1-a", done: true, resolved: Date.UTC(2026, 6, 8), ddTs: Date.UTC(2026, 6, 6), qaTs: null }),
    ];

    const view = buildEpicView(epic, stories, "Someone", MTG_CUTOFF, JUN29_CUTOFF, 0);

    expect(view.resolvedVerdict).toEqual({ label: "+2d late", late: true });
  });

  it("NOT_DONE epic: resolvedVerdict is null even if some story happens to have a resolved date", () => {
    const epic = makeScheduleEpic({ id: "PXB1-mixed" });
    const stories = [
      baseStory({ storyId: "PXB1-a", done: true, resolved: Date.UTC(2026, 6, 5), ddTs: Date.UTC(2026, 6, 6), qaTs: null }),
      baseStory({ storyId: "PXB1-b", done: false, ddTs: Date.UTC(2026, 6, 10), qaTs: null }),
    ];

    const view = buildEpicView(epic, stories, "Someone", MTG_CUTOFF, JUN29_CUTOFF, 0);

    expect(view.badge).toBe("NOT_DONE");
    expect(view.resolvedVerdict).toBeNull();
  });

  it("DONE-via-override epic whose stories haven't individually resolved -> resolvedMs/resolvedVerdict are null (no fallback to epic.resolved)", () => {
    const epicResolvedMs = Date.UTC(2026, 6, 5);
    const epic = makeScheduleEpic({ id: "PXB1-3160", resolved: epicResolvedMs });
    const stories = [
      baseStory({ storyId: "PXB1-x", state: "OPEN", done: false }),
      baseStory({ storyId: "PXB1-y", state: "OPEN", done: false }),
    ];

    const view = buildEpicView(epic, stories, "Someone", MTG_CUTOFF, JUN29_CUTOFF, 0);

    expect(view.badge).toBe("DONE");
    expect(view.resolvedMs).toBeNull();
    expect(view.resolvedVerdict).toBeNull();
  });
});

describe("buildEpicView -- isNew (Examples_2 §7, T14)", () => {
  it("epic created after MTG_CUTOFF -> isNew true", () => {
    const epic = makeScheduleEpic({ id: "PXB1-new", created: Date.UTC(2026, 6, 5) });
    const view = buildEpicView(epic, [], "Someone", MTG_CUTOFF, JUN29_CUTOFF, 0);
    expect(view.isNew).toBe(true);
  });

  it("epic created before MTG_CUTOFF -> isNew false", () => {
    const epic = makeScheduleEpic({ id: "PXB1-old", created: Date.UTC(2026, 5, 1) });
    const view = buildEpicView(epic, [], "Someone", MTG_CUTOFF, JUN29_CUTOFF, 0);
    expect(view.isNew).toBe(false);
  });

  it("epic with null created -> isNew false (guard)", () => {
    const epic = makeScheduleEpic({ id: "PXB1-nulldate", created: null });
    const view = buildEpicView(epic, [], "Someone", MTG_CUTOFF, JUN29_CUTOFF, 0);
    expect(view.isNew).toBe(false);
  });
});

describe("buildEpicView -- passthrough fields", () => {
  it("carries id/summary/assignee/stories(all) through unchanged", () => {
    const epic = makeScheduleEpic({ id: "PXB1-p", summary: "Some summary" });
    const stories = [baseStory({ storyId: "PXB1-a", done: false })];

    const view = buildEpicView(epic, stories, "Fahad K", MTG_CUTOFF, JUN29_CUTOFF, 0);

    expect(view.id).toBe("PXB1-p");
    expect(view.summary).toBe("Some summary");
    expect(view.assignee).toBe("Fahad K");
    expect(view.stories).toBe(stories); // ALL stories, unfiltered
  });
});

describe("groupByMilestone (Examples_2 §5)", () => {
  it("T9: sorts groups by milestone ascending", () => {
    const e14jul = buildEpicView(
      makeScheduleEpic({ id: "PXB1-3101" }),
      [baseStory({ storyId: "s1", done: false, ddTs: Date.UTC(2026, 6, 8), qaTs: Date.UTC(2026, 6, 14) })],
      "A",
      MTG_CUTOFF,
      JUN29_CUTOFF,
      0,
    );
    const e07jul = buildEpicView(
      makeScheduleEpic({ id: "PXB1-3140" }),
      [baseStory({ storyId: "s2", done: false, ddTs: Date.UTC(2026, 6, 6), qaTs: Date.UTC(2026, 6, 7) })],
      "B",
      MTG_CUTOFF,
      JUN29_CUTOFF,
      0,
    );

    const now = Date.UTC(2026, 6, 9); // Thu 9 Jul 2026, per the guide's worked example
    const groups = groupByMilestone([e14jul, e07jul], DISPLAY_CUTOFF, now);

    expect(groups.map((g) => g.ms)).toEqual([Date.UTC(2026, 6, 7), Date.UTC(2026, 6, 14)]);
  });

  it("T10: a milestone before the display cutoff (2026-07-03) is not rendered", () => {
    const before = buildEpicView(
      makeScheduleEpic({ id: "PXB1-early" }),
      [baseStory({ storyId: "s1", done: false, ddTs: Date.UTC(2026, 6, 2), qaTs: Date.UTC(2026, 6, 2) })],
      "A",
      MTG_CUTOFF,
      JUN29_CUTOFF,
      0,
    );
    const after = buildEpicView(
      makeScheduleEpic({ id: "PXB1-late" }),
      [baseStory({ storyId: "s2", done: false, ddTs: Date.UTC(2026, 6, 10), qaTs: Date.UTC(2026, 6, 10) })],
      "B",
      MTG_CUTOFF,
      JUN29_CUTOFF,
      0,
    );

    const groups = groupByMilestone([before, after], DISPLAY_CUTOFF, Date.UTC(2026, 6, 9));

    expect(groups).toHaveLength(1);
    expect(groups[0].epics.map((e) => e.id)).toEqual(["PXB1-late"]);
  });

  it("merges epics sharing the exact same milestone ms into one group", () => {
    const ms = Date.UTC(2026, 6, 10);
    const e1 = buildEpicView(
      makeScheduleEpic({ id: "PXB1-1" }),
      [baseStory({ storyId: "s1", done: false, ddTs: ms, qaTs: ms })],
      "A",
      MTG_CUTOFF,
      JUN29_CUTOFF,
      0,
    );
    const e2 = buildEpicView(
      makeScheduleEpic({ id: "PXB1-2" }),
      [baseStory({ storyId: "s2", done: false, ddTs: ms, qaTs: ms })],
      "B",
      MTG_CUTOFF,
      JUN29_CUTOFF,
      0,
    );

    const groups = groupByMilestone([e1, e2], DISPLAY_CUTOFF, Date.UTC(2026, 6, 9));

    expect(groups).toHaveLength(1);
    expect(groups[0].counts.epics).toBe(2);
  });

  it("T12: urgency ≤3d boundary (run 9 Jul, milestone 10 Jul -> +1 day -> d3)", () => {
    const e = buildEpicView(
      makeScheduleEpic({ id: "PXB1-3163" }),
      [baseStory({ storyId: "s1", done: false, ddTs: Date.UTC(2026, 6, 10), qaTs: Date.UTC(2026, 6, 10) })],
      "A",
      MTG_CUTOFF,
      JUN29_CUTOFF,
      0,
    );

    const groups = groupByMilestone([e], DISPLAY_CUTOFF, Date.UTC(2026, 6, 9));

    expect(groups[0].daysFromNow).toBe(1);
    expect(groups[0].urgency).toBe("d3");
  });

  it("urgency tier boundaries: 0d overdue, 3d/7d/14d thresholds, >14d far", () => {
    const now = Date.UTC(2026, 6, 9);
    const mk = (id: string, dayOffset: number) =>
      buildEpicView(
        makeScheduleEpic({ id }),
        [baseStory({ storyId: `${id}-s`, done: false, ddTs: now + dayOffset * 86_400_000, qaTs: now + dayOffset * 86_400_000 })],
        "A",
        MTG_CUTOFF,
        JUN29_CUTOFF,
        0,
      );

    const overdue = mk("PXB1-overdue", -2);
    const d3 = mk("PXB1-d3", 3);
    const d7 = mk("PXB1-d7", 7);
    const d14 = mk("PXB1-d14", 14);
    const far = mk("PXB1-far", 15);

    const groups = groupByMilestone([overdue, d3, d7, d14, far], DISPLAY_CUTOFF, now);
    const byId = new Map(groups.map((g) => [g.epics[0].id, g.urgency]));

    expect(byId.get("PXB1-overdue")).toBe("overdue");
    expect(byId.get("PXB1-d3")).toBe("d3");
    expect(byId.get("PXB1-d7")).toBe("d7");
    expect(byId.get("PXB1-d14")).toBe("d14");
    expect(byId.get("PXB1-far")).toBe("far");
  });

  it("T11: a milestone group whose epics are ALL done turns 'alldone', overriding the date-based tier (even when overdue)", () => {
    const doneEpic = buildEpicView(
      makeScheduleEpic({ id: "PXB1-3120" }),
      [baseStory({ storyId: "s1", done: true, resolved: Date.UTC(2026, 6, 2), ddTs: Date.UTC(2026, 6, 6), qaTs: Date.UTC(2026, 6, 6) })],
      "A",
      MTG_CUTOFF,
      JUN29_CUTOFF,
      0,
    );

    // milestone (06 Jul) is 3 days in the past relative to "now" (09 Jul) -> would be "overdue" if not all-done.
    const groups = groupByMilestone([doneEpic], DISPLAY_CUTOFF, Date.UTC(2026, 6, 9));

    expect(groups[0].daysFromNow).toBe(-3);
    expect(groups[0].urgency).toBe("alldone");
  });

  it("a mixed group (not all done) keeps its date-based urgency even if some epics are done", () => {
    const doneEpic = buildEpicView(
      makeScheduleEpic({ id: "PXB1-done" }),
      [baseStory({ storyId: "s1", done: true, resolved: Date.UTC(2026, 6, 2), ddTs: Date.UTC(2026, 6, 10), qaTs: Date.UTC(2026, 6, 10) })],
      "A",
      MTG_CUTOFF,
      JUN29_CUTOFF,
      0,
    );
    const pendingEpic = buildEpicView(
      makeScheduleEpic({ id: "PXB1-pending" }),
      [baseStory({ storyId: "s2", done: false, ddTs: Date.UTC(2026, 6, 10), qaTs: Date.UTC(2026, 6, 10) })],
      "B",
      MTG_CUTOFF,
      JUN29_CUTOFF,
      0,
    );

    const groups = groupByMilestone([doneEpic, pendingEpic], DISPLAY_CUTOFF, Date.UTC(2026, 6, 9));

    expect(groups[0].urgency).not.toBe("alldone");
    expect(groups[0].urgency).toBe("d3"); // +1 day from 9 Jul to 10 Jul
  });

  it("epics with a null milestone are collected into a trailing 'no date' group, sorted to the end regardless of other dates", () => {
    const dated = buildEpicView(
      makeScheduleEpic({ id: "PXB1-dated" }),
      [baseStory({ storyId: "s1", done: false, ddTs: Date.UTC(2026, 6, 20), qaTs: Date.UTC(2026, 6, 20) })],
      "A",
      MTG_CUTOFF,
      JUN29_CUTOFF,
      0,
    );
    const noDate = buildEpicView(
      makeScheduleEpic({ id: "PXB1-nodate", resolved: null }),
      [baseStory({ storyId: "s2", done: false, ddTs: null, qaTs: null })],
      "B",
      MTG_CUTOFF,
      JUN29_CUTOFF,
      0,
    );

    const groups = groupByMilestone([noDate, dated], DISPLAY_CUTOFF, Date.UTC(2026, 6, 9));

    expect(groups).toHaveLength(2);
    expect(groups[groups.length - 1].epics.map((e) => e.id)).toEqual(["PXB1-nodate"]);
  });

  it("never crashes computing urgency/daysFromNow for the no-date group (defensive null guard)", () => {
    const noDate = buildEpicView(
      makeScheduleEpic({ id: "PXB1-nodate", resolved: null }),
      [baseStory({ storyId: "s1", done: false, ddTs: null, qaTs: null })],
      "B",
      MTG_CUTOFF,
      JUN29_CUTOFF,
      0,
    );

    expect(() => groupByMilestone([noDate], DISPLAY_CUTOFF, Date.UTC(2026, 6, 9))).not.toThrow();
    const groups = groupByMilestone([noDate], DISPLAY_CUTOFF, Date.UTC(2026, 6, 9));
    expect(groups[0].urgency).toBe("far");
  });

  it("counts + totals aggregate across all epics in the group (header example: N epics / M stories, pending+done split)", () => {
    const ms = Date.UTC(2026, 6, 14);
    const epicA = buildEpicView(
      makeScheduleEpic({ id: "PXB1-A" }),
      [
        baseStory({ storyId: "a1", done: false, ddTs: ms, qaTs: ms, devEst: 100, uiEst: 0, qaEst: 0, spent: 50 }),
        baseStory({ storyId: "a2", done: false, ddTs: ms, qaTs: ms, devEst: 200, uiEst: 0, qaEst: 0, spent: 25 }),
      ],
      "A",
      MTG_CUTOFF,
      JUN29_CUTOFF,
      0,
    );
    const epicB = buildEpicView(
      makeScheduleEpic({ id: "PXB1-B" }),
      [baseStory({ storyId: "b1", done: false, ddTs: ms, qaTs: ms, devEst: 50, uiEst: 0, qaEst: 0, spent: 10 })],
      "B",
      MTG_CUTOFF,
      JUN29_CUTOFF,
      0,
    );

    const groups = groupByMilestone([epicA, epicB], DISPLAY_CUTOFF, Date.UTC(2026, 6, 9));

    expect(groups[0].counts).toEqual({ epics: 2, stories: 3, pending: 3, done: 0 });
    expect(groups[0].totals).toEqual({ dev: 350, ui: 0, qa: 0, spent: 85 });
  });
});

describe("grandTotals (Examples_2 §9, T16)", () => {
  it("sums totals across all given groups", () => {
    const groups = groupByMilestone(
      [
        buildEpicView(
          makeScheduleEpic({ id: "PXB1-A" }),
          [baseStory({ storyId: "a1", done: false, ddTs: Date.UTC(2026, 6, 10), qaTs: Date.UTC(2026, 6, 10), devEst: 100, uiEst: 10, qaEst: 5, spent: 1 })],
          "A",
          MTG_CUTOFF,
          JUN29_CUTOFF,
          0,
        ),
        buildEpicView(
          makeScheduleEpic({ id: "PXB1-B" }),
          [baseStory({ storyId: "b1", done: false, ddTs: Date.UTC(2026, 6, 20), qaTs: Date.UTC(2026, 6, 20), devEst: 200, uiEst: 20, qaEst: 10, spent: 2 })],
          "B",
          MTG_CUTOFF,
          JUN29_CUTOFF,
          0,
        ),
      ],
      DISPLAY_CUTOFF,
      Date.UTC(2026, 6, 9),
    );

    const totals = grandTotals(groups);

    expect(totals).toEqual({ dev: 300, ui: 30, qa: 15, spent: 3, finalMs: Date.UTC(2026, 6, 20) });
  });

  it("finalMs is the latest milestone across groups, ignoring the no-date sentinel", () => {
    const groups = groupByMilestone(
      [
        buildEpicView(
          makeScheduleEpic({ id: "PXB1-dated" }),
          [baseStory({ storyId: "s1", done: false, ddTs: Date.UTC(2026, 6, 10), qaTs: Date.UTC(2026, 6, 10) })],
          "A",
          MTG_CUTOFF,
          JUN29_CUTOFF,
          0,
        ),
        buildEpicView(
          makeScheduleEpic({ id: "PXB1-nodate", resolved: null }),
          [baseStory({ storyId: "s2", done: false, ddTs: null, qaTs: null })],
          "B",
          MTG_CUTOFF,
          JUN29_CUTOFF,
          0,
        ),
      ],
      DISPLAY_CUTOFF,
      Date.UTC(2026, 6, 9),
    );

    expect(grandTotals(groups).finalMs).toBe(Date.UTC(2026, 6, 10));
  });

  it("empty groups array -> all zeros, finalMs null", () => {
    expect(grandTotals([])).toEqual({ dev: 0, ui: 0, qa: 0, spent: 0, finalMs: null });
  });

  it("only a no-date group present -> finalMs null (no real date to report)", () => {
    const noDate = buildEpicView(
      makeScheduleEpic({ id: "PXB1-nodate", resolved: null }),
      [baseStory({ storyId: "s1", done: false, ddTs: null, qaTs: null })],
      "B",
      MTG_CUTOFF,
      JUN29_CUTOFF,
      0,
    );
    const groups = groupByMilestone([noDate], DISPLAY_CUTOFF, Date.UTC(2026, 6, 9));

    expect(grandTotals(groups).finalMs).toBeNull();
  });
});
