/**
 * Drift guard: these fixtures are copied verbatim from
 * dashboard/tests/health.test.ts's STORIES + NOW_MS (PXB1 beta1-21 stories,
 * trimmed from the real 2026-07-14 snapshot; PXB1-9999 is the same synthetic
 * blank-assignee addition that file documents). Same input, same expected
 * output as the TS accountability() test -- if scripts/lib/overdue.mjs ever
 * silently drifts from dashboard/lib/health.ts, this test fails.
 *
 * Run: node scripts/lib/overdue.test.mjs
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { accountability, isOverdue, mostBehind } from "./overdue.mjs";

const NOW_MS = Date.UTC(2026, 6, 16, 9, 0, 0); // 16 Jul 2026 09:00 UTC -- identical to health.test.ts

const STORIES = [
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
    ddTs: 1783944000000,
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
    ddTs: 1783944000000,
    qaTs: 1784116800000, // 15 Jul 2026 -> before NOW_MS: late + overdue
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
    ddTs: 1783944000000,
    qaTs: 1784548800000, // 20 Jul 2026 -> still ahead of NOW_MS: not late
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
    ddTs: 1783339200000,
    qaTs: 1783684800000, // 10 Jul 2026 -> not due this week, globally overdue
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
    ddTs: 1783252800000,
    qaTs: 1783684800000, // 10 Jul 2026 -> not due this week, globally overdue
    sprint: "",
    parentId: "PXB1-52",
    epicId: "PXB1-52",
    bugs: [],
  },
  {
    // Synthetic (same as health.test.ts): exercises the `unowned` branch.
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
    qaTs: Date.UTC(2026, 7, 10),
    sprint: "beta1-21",
    parentId: null,
    epicId: null,
    bugs: [],
  },
];

function scheduleSnapshot(generatedAtMs = NOW_MS) {
  return {
    meta: { generated_at_ms: generatedAtMs },
    schedule: { epics: [], stories: STORIES, orphan_count: 0 },
  };
}

test("isOverdue: not done AND qaTs before nowMs", () => {
  assert.equal(isOverdue({ done: false, qaTs: NOW_MS - 1 }, NOW_MS), true);
  assert.equal(isOverdue({ done: true, qaTs: NOW_MS - 1 }, NOW_MS), false);
  assert.equal(isOverdue({ done: false, qaTs: null }, NOW_MS), false);
  assert.equal(isOverdue({ done: false, qaTs: NOW_MS + 1 }, NOW_MS), false);
});

test("accountability: matches dashboard/tests/health.test.ts exactly on the same fixtures + NOW_MS", () => {
  const result = accountability(scheduleSnapshot(), NOW_MS);
  // unowned: PXB1-9999 (blank assignee).
  // overdue (not done, qaTs < NOW_MS, any week): 7206, 6848, 1634.
  // reopened (state contains "re-open"): 7206, 7560, 6848.
  assert.equal(result.unowned, 1);
  assert.equal(result.overdue, 3);
  assert.equal(result.reopened, 3);
  assert.deepEqual(result.byPerson, [
    { name: "Shafeek M", overdue: 1, open: 2 }, // 7206 (overdue) + 7560 (not yet)
    { name: "Pramod Saini", overdue: 1, open: 1 }, // tie-break vs Sarika: name asc
    { name: "Sarika Agrawal", overdue: 1, open: 1 },
  ]);
});

test("accountability: excludes done stories and blank assignees from byPerson", () => {
  const result = accountability(scheduleSnapshot(), NOW_MS);
  assert.equal(
    result.byPerson.some((p) => p.name === "Ajnas O"),
    false,
  );
  assert.equal(
    result.byPerson.some((p) => p.name === ""),
    false,
  );
});

test("accountability: defaults to zero/empty when the schedule block is absent", () => {
  const result = accountability({ meta: { generated_at_ms: NOW_MS } }, NOW_MS);
  assert.deepEqual(result, { unowned: 0, overdue: 0, reopened: 0, byPerson: [] });
});

test("mostBehind: anchors to snapshot.meta.generated_at_ms, not a passed-in nowMs (and NOT Date.now())", () => {
  const ranked = mostBehind(scheduleSnapshot(NOW_MS));
  assert.deepEqual(ranked, [
    { name: "Shafeek M", overdue: 1, open: 2 },
    { name: "Pramod Saini", overdue: 1, open: 1 },
    { name: "Sarika Agrawal", overdue: 1, open: 1 },
  ]);
});

test("mostBehind: a different generated_at_ms produces a different ranking (proves it's snapshot-anchored)", () => {
  // Far in the past: nothing is overdue yet relative to this earlier anchor,
  // so every person's overdue count collapses to 0 and the tie-break falls
  // through to open-desc/name-asc instead.
  const earlyMs = Date.UTC(2026, 6, 1); // 01 Jul 2026, before every qaTs above except 6848/1634
  const ranked = mostBehind(scheduleSnapshot(earlyMs));
  assert.ok(ranked.every((p) => p.overdue === 0));
});
