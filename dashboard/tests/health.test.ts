import { describe, expect, it } from "vitest";
import {
  accountability,
  bugPressure,
  lateThisWeekStories,
  onTrackVerdict,
  overdueStories,
  overshootingEpics,
  redEpics,
  reopenedStories,
  remainingEffort,
  thisWeekDeadlines,
  unownedEpicsList,
} from "../lib/health";
import type { Epic, ScheduleStory } from "../lib/types";
import { baseSnapshot } from "./fixtures";

/**
 * Fixture stories trimmed from the real dashboard/data/latest.json (PXB1
 * beta1-21, generated 2026-07-14). `NOW_MS` is fixed at 16 Jul 2026 09:00 UTC,
 * inside release Week 3 (14-20 Jul, anchor 2026-06-30 -> index 2 — see
 * tests/week.test.ts). One row (PXB1-9999) is a synthetic addition: the real
 * snapshot currently has zero blank-assignee stories, so it is hand-built to
 * exercise the `unowned` branch. Every other field/story is copied verbatim.
 * Per-story `bugs` (RE-OPEN drill-down) are zeroed — irrelevant to lib/health.ts,
 * which only reads the top-level `s.bugs` block.
 */

const NOW_MS = Date.UTC(2026, 6, 16, 9, 0, 0); // 16 Jul 2026 09:00 UTC

const STORIES: ScheduleStory[] = [
  {
    storyId: "PXB1-7180",
    summary: "Impact of Product Settings in Purchase screens",
    state: "DONE",
    done: true,
    assignee: "Ajnas O",
    scope: "PHASE 1",
    created: 1781787737440,
    resolved: 1783929191509,
    devEst: 1440,
    uiEst: 0,
    qaEst: 480,
    spent: 140,
    ddTs: 1783944000000, // 13 Jul 2026
    qaTs: 1784548800000, // 20 Jul 2026 -> due this week, done
    sprint: "beta1-20",
    parentId: "PXB1-414",
    epicId: "PXB1-414",
    bugs: [],
  },
  {
    storyId: "PXB1-7206",
    summary: "Recieve Goods Report Screen UI Changes",
    state: "RE-OPEN",
    done: false,
    assignee: "Shafeek M",
    scope: "PHASE 1",
    created: 1781853616794,
    resolved: null,
    devEst: 0,
    uiEst: 300,
    qaEst: 480,
    spent: 420,
    ddTs: 1783944000000, // 13 Jul 2026
    qaTs: 1784116800000, // 15 Jul 2026 -> due this week, before NOW_MS: late + overdue
    sprint: "beta1-21",
    parentId: "PXB1-3496",
    epicId: "PXB1-3496",
    bugs: [],
  },
  {
    storyId: "PXB1-7560",
    summary: 'New design for "Save" button.',
    state: "RE-OPEN",
    done: false,
    assignee: "Shafeek M",
    scope: "PHASE 1",
    created: 1782665226107,
    resolved: null,
    devEst: 0,
    uiEst: 480,
    qaEst: 720,
    spent: 750,
    ddTs: 1783944000000, // 13 Jul 2026
    qaTs: 1784548800000, // 20 Jul 2026 -> due this week, still ahead of NOW_MS: not late
    sprint: "beta1-21",
    parentId: "PXB1-6909",
    epicId: "PXB1-6909",
    bugs: [],
  },
  {
    storyId: "PXB1-6848",
    summary: "Stock Valuation Report-Alpha Report",
    state: "RE-OPEN",
    done: false,
    assignee: "Sarika Agrawal",
    scope: "PHASE 1",
    created: 1781249419850,
    resolved: null,
    devEst: 0,
    uiEst: 0,
    qaEst: 0,
    spent: 1260,
    ddTs: 1783339200000, // 06 Jul 2026
    qaTs: 1783684800000, // 10 Jul 2026 -> NOT due this week (week 2), but globally overdue
    sprint: "beta1-21",
    parentId: null,
    epicId: null,
    bugs: [],
  },
  {
    storyId: "PXB1-1634",
    summary: "Display Dashboards, AI Insights, and Quick Links",
    state: "OPEN",
    done: false,
    assignee: "Pramod Saini",
    scope: "PHASE 1",
    created: 1769006750354,
    resolved: null,
    devEst: 0,
    uiEst: 1920,
    qaEst: 720,
    spent: 0,
    ddTs: 1783252800000, // 05 Jul 2026
    qaTs: 1783684800000, // 10 Jul 2026 -> NOT due this week, globally overdue
    sprint: "",
    parentId: "PXB1-52",
    epicId: "PXB1-52",
    bugs: [],
  },
  {
    // Synthetic: real snapshot has no blank-assignee stories today, so this row
    // is hand-built to exercise the `unowned` branch. Deadline is far in the
    // future -> not due this week, not overdue.
    storyId: "PXB1-9999",
    summary: "(fixture) unowned placeholder story",
    state: "OPEN",
    done: false,
    assignee: "",
    scope: "PHASE 1",
    created: Date.UTC(2026, 6, 1),
    resolved: null,
    devEst: 480,
    uiEst: 0,
    qaEst: 240,
    spent: 0,
    ddTs: Date.UTC(2026, 7, 1),
    qaTs: Date.UTC(2026, 7, 10), // 10 Aug 2026
    sprint: "beta1-21",
    parentId: null,
    epicId: null,
    bugs: [],
  },
];

function scheduleSnapshot() {
  const s = baseSnapshot();
  s.schedule = { epics: [], stories: STORIES, orphan_count: 0 };
  return s;
}

function epic(overrides: Partial<Epic>): Epic {
  return {
    id: "PXB1-0",
    summary: "(fixture) epic",
    created: NOW_MS,
    resolved: null,
    assignee: "Someone",
    epic_state: "OPEN",
    stories: [],
    rollup_all: { server: 0, ui: 0, testing: 0 },
    epic_est: { server: 0, ui: 0, testing: 0 },
    rollup: { server: 0, ui: 0, testing: 0 },
    category: "PENDING",
    missing_est: false,
    total: 0,
    spent: 100,
    overshoot: false,
    ...overrides,
  };
}

/** Mirrors STORIES's style: one epic per RED reason, one clean epic, and one
 *  (PXB1-202) flagged under TWO reasons — the case that makes redEpics()'s
 *  length differ from insights.red_counts.total_red (a sum, not a distinct
 *  count). stale_days: 30 matches scripts/snapshot.py's STALE_DAYS default. */
const EPICS: Epic[] = [
  epic({ id: "PXB1-100", assignee: "", needs_owner: true }), // Needs an owner
  epic({
    id: "PXB1-202",
    assignee: "Aruna Saini",
    missing_est: true,
    overshoot: true,
  }), // Missing estimate + Overshooting (2 reasons, 1 epic)
  epic({ id: "PXB1-300", assignee: "Shafeek M", epic_state: "BLOCKED" }), // Blocked/On hold
  epic({
    id: "PXB1-400",
    assignee: "Ajnas O",
    created: NOW_MS - 40 * 86_400_000, // 40 days before NOW_MS, > 30-day stale_days
    spent: 0,
  }), // Stale
  epic({ id: "PXB1-500", assignee: "Pramod Saini" }), // clean, not RED
];

function epicsSnapshot() {
  const s = baseSnapshot();
  s.effort.sections = { done: [], pending: EPICS, mixed: [], no_stories: [], p2_backlog: [] };
  s.insights.red_counts.stale_days = 30;
  return s;
}

describe("remainingEffort", () => {
  it("reads man-days straight from grand_total.total_md, and derives hours from total minutes", () => {
    const s = baseSnapshot();
    // Real grand_total from dashboard/data/latest.json (PXB1, 2026-07-14).
    s.effort.totals.grand_total = {
      server: 68700,
      ui: 35520,
      testing: 32400,
      total: 136620,
      spent: 165255,
      server_md: 143.1,
      ui_md: 74.0,
      testing_md: 67.5,
      total_md: 284.6,
      spent_md: 344.3,
    };
    expect(remainingEffort(s)).toEqual({ manDays: 284.6, hours: 2277 });
  });

  it("is all-zero on an empty snapshot", () => {
    expect(remainingEffort(baseSnapshot())).toEqual({ manDays: 0, hours: 0 });
  });
});

describe("bugPressure", () => {
  it("reads kpi counts and the hottest (first) module insight", () => {
    const s = baseSnapshot();
    s.bugs!.kpi = {
      new_high: 3,
      new_medium: 7,
      open_high: 4,
      open_medium: 12,
      open_low: 20,
      total_open: 36,
      modules_hit: 2,
    };
    s.bugs!.module_insights = [
      { module: "Product", count: 12, submodules: [{ submodule: "Product Catalog", count: 5 }] },
      { module: "Purchase", count: 8, submodules: [{ submodule: "Purchase Return", count: 3 }] },
    ];
    expect(bugPressure(s)).toEqual({
      openHigh: 4,
      newHigh: 3,
      newMedium: 7,
      totalOpen: 36,
      hottestModule: "Product",
    });
  });

  it("hottestModule is null when there are no module insights", () => {
    const s = baseSnapshot();
    s.bugs!.kpi = { ...s.bugs!.kpi, open_high: 1 };
    expect(bugPressure(s).hottestModule).toBeNull();
  });

  it("defaults to zero/null when the bugs block is absent (older snapshot)", () => {
    const s = baseSnapshot();
    delete s.bugs;
    expect(bugPressure(s)).toEqual({
      openHigh: 0,
      newHigh: 0,
      newMedium: 0,
      totalOpen: 0,
      hottestModule: null,
    });
  });
});

describe("thisWeekDeadlines", () => {
  it("counts due/done/late among stories whose QA deadline lands in the current release week", () => {
    // due: 7180, 7206, 7560 (qaTs in 14-20 Jul); done: 7180; late: 7206 (qaTs
    // 15 Jul already passed NOW_MS and not done). 6848/1634/9999 are excluded
    // (their QA deadlines aren't in this week).
    expect(thisWeekDeadlines(scheduleSnapshot(), NOW_MS)).toEqual({ due: 3, done: 1, late: 1 });
  });

  it("defaults to zero when the schedule block is absent (older snapshot)", () => {
    const s = baseSnapshot();
    delete s.schedule;
    expect(thisWeekDeadlines(s, NOW_MS)).toEqual({ due: 0, done: 0, late: 0 });
  });
});

describe("lateThisWeekStories", () => {
  it("returns exactly the story behind thisWeekDeadlines().late, not just the count", () => {
    const ids = lateThisWeekStories(scheduleSnapshot(), NOW_MS).map((s) => s.storyId);
    expect(ids).toEqual(["PXB1-7206"]);
    expect(ids.length).toBe(thisWeekDeadlines(scheduleSnapshot(), NOW_MS).late);
  });

  it("is empty when the schedule block is absent", () => {
    const s = baseSnapshot();
    delete s.schedule;
    expect(lateThisWeekStories(s, NOW_MS)).toEqual([]);
  });
});

describe("accountability", () => {
  it("computes unowned/overdue/reopened counts and ranks people by overdue count", () => {
    const result = accountability(scheduleSnapshot(), NOW_MS);
    // unowned: PXB1-9999 (blank assignee).
    // overdue (not done, qaTs < NOW_MS, any week): 7206, 6848, 1634.
    // reopened (state contains "re-open"): 7206, 7560, 6848.
    expect(result.unowned).toBe(1);
    expect(result.overdue).toBe(3);
    expect(result.reopened).toBe(3);
    expect(result.byPerson).toEqual([
      { name: "Shafeek M", overdue: 1, open: 2 }, // 7206 (overdue) + 7560 (not yet)
      { name: "Pramod Saini", overdue: 1, open: 1 }, // tie-break vs Sarika: name asc
      { name: "Sarika Agrawal", overdue: 1, open: 1 },
    ]);
  });

  it("excludes done stories and blank assignees from byPerson", () => {
    const result = accountability(scheduleSnapshot(), NOW_MS);
    expect(result.byPerson.find((p) => p.name === "Ajnas O")).toBeUndefined(); // only story is done
    expect(result.byPerson.some((p) => p.name === "")).toBe(false);
  });

  it("defaults to zero/empty when the schedule block is absent (older snapshot)", () => {
    const s = baseSnapshot();
    delete s.schedule;
    expect(accountability(s, NOW_MS)).toEqual({
      unowned: 0,
      overdue: 0,
      reopened: 0,
      byPerson: [],
    });
  });
});

describe("overdueStories", () => {
  it("returns exactly the stories behind accountability().overdue, not just the count", () => {
    const ids = overdueStories(scheduleSnapshot(), NOW_MS).map((s) => s.storyId);
    expect(ids.sort()).toEqual(["PXB1-1634", "PXB1-6848", "PXB1-7206"]);
    expect(ids.length).toBe(accountability(scheduleSnapshot(), NOW_MS).overdue);
  });

  it("is empty when the schedule block is absent", () => {
    const s = baseSnapshot();
    delete s.schedule;
    expect(overdueStories(s, NOW_MS)).toEqual([]);
  });
});

describe("reopenedStories", () => {
  it("returns exactly the stories behind accountability().reopened, not just the count", () => {
    const ids = reopenedStories(scheduleSnapshot()).map((s) => s.storyId);
    expect(ids.sort()).toEqual(["PXB1-6848", "PXB1-7206", "PXB1-7560"]);
    expect(ids.length).toBe(accountability(scheduleSnapshot(), NOW_MS).reopened);
  });
});

describe("unownedEpicsList", () => {
  it("returns open epics needing a real owner (blank assignee or role placeholder)", () => {
    const ids = unownedEpicsList(epicsSnapshot()).map((e) => e.id);
    expect(ids).toEqual(["PXB1-100"]);
  });

  it("is empty when the effort block has no sections", () => {
    expect(unownedEpicsList(baseSnapshot())).toEqual([]);
  });
});

describe("overshootingEpics", () => {
  it("returns open epics flagged overshoot", () => {
    const ids = overshootingEpics(epicsSnapshot()).map((e) => e.id);
    expect(ids).toEqual(["PXB1-202"]);
  });
});

describe("redEpics", () => {
  it("dedupes one row per epic even when it matches multiple RED reasons", () => {
    const result = redEpics(epicsSnapshot(), NOW_MS);
    const byId = Object.fromEntries(result.map((r) => [r.epic.id, r.reasons]));
    expect(byId).toEqual({
      "PXB1-100": ["Needs an owner"],
      "PXB1-202": ["Missing estimate", "Overshooting"],
      "PXB1-300": ["Blocked/On hold"],
      "PXB1-400": ["Stale"],
    });
    // PXB1-500 (clean) is absent — never flagged for any reason.
    expect(result.some((r) => r.epic.id === "PXB1-500")).toBe(false);
  });

  it("can list fewer distinct epics than total_red when an epic matches 2+ reasons", () => {
    // total_red would be 5 here (1 reason each for 100/300/400 + 2 for 202),
    // but only 4 DISTINCT epics are actually affected.
    const result = redEpics(epicsSnapshot(), NOW_MS);
    expect(result.length).toBe(4);
  });
});

describe("onTrackVerdict", () => {
  it("is behind when a this-week deadline is late AND there are open High bugs", () => {
    const s = scheduleSnapshot();
    s.bugs!.kpi = { ...s.bugs!.kpi, open_high: 4 };
    const verdict = onTrackVerdict(s, NOW_MS);
    expect(verdict.status).toBe("behind");
    expect(verdict.reasons).toEqual([
      "1 deadline late this week",
      "3 stories overdue past QA deadline",
      "4 open High-priority bugs",
    ]);
  });

  it("is behind when overdue stories pile up (>= 5) even with no late deadline this week or open High bugs", () => {
    const s = baseSnapshot();
    const overdueStories: ScheduleStory[] = Array.from({ length: 5 }, (_, i) => ({
      storyId: `PXB1-90${i}`,
      summary: "(fixture) overdue backlog story",
      state: "OPEN",
      done: false,
      assignee: "Overdue Person",
      scope: "PHASE 1",
      created: Date.UTC(2026, 5, 1),
      resolved: null,
      devEst: 240,
      uiEst: 0,
      qaEst: 0,
      spent: 0,
      ddTs: Date.UTC(2026, 6, 1),
      qaTs: Date.UTC(2026, 6, 1), // 01 Jul 2026 -> week index 0, not this week (index 2)
      sprint: "beta1-21",
      parentId: null,
      epicId: null,
      bugs: [],
    }));
    s.schedule = { epics: [], stories: overdueStories, orphan_count: 0 };
    const verdict = onTrackVerdict(s, NOW_MS);
    expect(verdict.status).toBe("behind");
    expect(verdict.reasons).toEqual(["5 stories overdue past QA deadline"]);
  });

  it("is at-risk when open High bugs exist but nothing is late/overdue", () => {
    const s = baseSnapshot();
    s.bugs!.kpi = { ...s.bugs!.kpi, open_high: 2 };
    const verdict = onTrackVerdict(s, NOW_MS);
    expect(verdict.status).toBe("at-risk");
    expect(verdict.reasons).toEqual(["2 open High-priority bugs"]);
  });

  it("is on-track when nothing is late, overdue, or an open High bug", () => {
    const verdict = onTrackVerdict(baseSnapshot(), NOW_MS);
    expect(verdict.status).toBe("on-track");
    expect(verdict.reasons).toEqual(["No late deadlines, overdue stories, or open High bugs"]);
  });
});
