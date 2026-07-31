/**
 * Tests for scripts/lib/distill-brief-input.mjs, covering two 2026-07-31
 * fixes:
 *  - effort_outlier evidence used to cite raw epic.spent (a whole-epic-
 *    LIFETIME work-item sweep) in raw minutes, which could wildly overstate
 *    a MIXED epic's actual overshoot (its done stories' historical spend
 *    included) and was never something a human would write ("spent 8600
 *    minutes"). Verified live against PXB1-6156/PXB1-2724.
 *  - module_hotspot evidence used to cite bugs.module_insights (a rolling
 *    7-day window with NO #Unresolved filter at all -- scripts/reports/
 *    bugs.py's build_bugs() query for it), so a hotspot's count and its
 *    sample issue citations could include bugs already closed by the time
 *    someone reads the briefing. Now prefers module_insights_open /
 *    open_bugs (both #Unresolved-filtered, current-state).
 *
 * Plus 2026-07-31 additions:
 *  - module_hotspot now prefers module_insights_high_urgent (ranked/counted
 *    by High+Urgent bugs only, not all priorities) and its sample bug pool
 *    is filtered to High/Urgent to match -- a module shouldn't look "hot"
 *    purely from low-stakes Medium/Low tickets.
 *  - new aging_bug / aging_bug_medium evidence kinds surface the oldest
 *    open High/Urgent and Medium bugs (from bugs.aging_high_urgent /
 *    bugs.aging_medium) for citation in "Top issues now" -- folded into the
 *    existing narrative rather than a separate deterministic section, per
 *    the PM's explicit instruction.
 *
 * Run: node scripts/lib/distill-brief-input.test.mjs
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { distillBriefInput, severityForEvidence } from "./distill-brief-input.mjs";

function baseSnapshot(overrides = {}) {
  return {
    meta: { generated_at_ms: 1, project: "PXB1", scope: "PHASE 1", sprint: "beta1-23" },
    bugs: { module_insights: [], new_in_window: {}, open_high_older: [], kpi: null },
    effort: { sections: { pending: [], mixed: [], no_stories: [] } },
    schedule: { stories: [] },
    insights: { red_delta: null, compared_to: null },
    ...overrides,
  };
}

function effortOutliers(snapshot) {
  const { distilled } = distillBriefInput(snapshot, {});
  return distilled.evidence.filter((e) => e.kind === "effort_outlier");
}

function moduleHotspots(snapshot) {
  const { distilled } = distillBriefInput(snapshot, {});
  return distilled.evidence.filter((e) => e.kind === "module_hotspot");
}

function citedBugs(snapshot) {
  const { distilled } = distillBriefInput(snapshot, {});
  return distilled.evidence.filter((e) => e.kind === "bug");
}

test("effort_outlier: uses overshoot_spent (hours), NOT the whole-epic-lifetime epic.spent", () => {
  // Real shape (PXB1-2724, MIXED, 1 done/1 pending): epic.spent is huge
  // (includes the done story's historical spend); overshoot_spent -- summed
  // from just the pending story's own field -- is the number that actually
  // decided overshoot, and is what a person would recognize as "the spend".
  const snapshot = baseSnapshot({
    effort: {
      sections: {
        pending: [],
        mixed: [{ id: "PXB1-2724", overshoot: true, missing_est: false, total: 1860, spent: 8600, overshoot_spent: 1902 }],
        no_stories: [],
      },
    },
  });
  const [outlier] = effortOutliers(snapshot);
  assert.equal(outlier.total_hours, 31); // 1860 / 60
  assert.equal(outlier.spent_hours, 31.7); // 1902 / 60, rounded to 1 decimal -- NOT 8600/60=143.3
});

test("effort_outlier: falls back to epic.spent (in hours) when overshoot_spent is absent (older snapshot)", () => {
  const snapshot = baseSnapshot({
    effort: {
      sections: {
        pending: [{ id: "PXB1-25", overshoot: true, missing_est: false, total: 480, spent: 900 }],
        mixed: [],
        no_stories: [],
      },
    },
  });
  const [outlier] = effortOutliers(snapshot);
  assert.equal(outlier.total_hours, 8);
  assert.equal(outlier.spent_hours, 15); // 900 / 60, from the epic.spent fallback
});

test("effort_outlier: ranks by overshoot_spent magnitude, not raw epic.spent", () => {
  // Epic A's epic.spent is bigger, but its overshoot_spent (the real signal)
  // is smaller than Epic B's -- B should rank first.
  const snapshot = baseSnapshot({
    effort: {
      sections: {
        pending: [],
        mixed: [
          { id: "A", overshoot: true, missing_est: false, total: 600, spent: 50_000, overshoot_spent: 660 }, // +60 over
          { id: "B", overshoot: true, missing_est: false, total: 600, spent: 700, overshoot_spent: 1200 }, // +600 over
        ],
        no_stories: [],
      },
    },
  });
  const outliers = effortOutliers(snapshot);
  assert.deepEqual(outliers.map((o) => o.epicId), ["B", "A"]);
});

test("severityForEvidence: effort_outlier 'high' threshold reads the hours fields, not minutes", () => {
  assert.equal(
    severityForEvidence({ kind: "effort_outlier", overshoot: true, total_hours: 10, spent_hours: 21 }),
    "high", // spent >= 2x total
  );
  assert.equal(
    severityForEvidence({ kind: "effort_outlier", overshoot: true, total_hours: 10, spent_hours: 15 }),
    "medium", // over, but under 2x
  );
});

test("module_hotspot: prefers module_insights_open (current state) over the 7-day module_insights", () => {
  const snapshot = baseSnapshot({
    bugs: {
      // 7-day window: no #Unresolved filter, so this stale count includes
      // bugs already closed by read time -- must be ignored when the
      // current-state field is present.
      module_insights: [{ module: "Sale", count: 90, submodules: [{ submodule: "POS", count: 40 }] }],
      module_insights_open: [{ module: "Sale", count: 51, submodules: [{ submodule: "POS", count: 22 }] }],
      new_in_window: {},
      open_high_older: [],
      open_bugs: [],
      kpi: null,
    },
  });
  const [hotspot] = moduleHotspots(snapshot);
  assert.equal(hotspot.count, 51); // NOT 90
  assert.equal(hotspot.top_submodule, "POS");
  assert.equal(hotspot.top_submodule_count, 22); // NOT 40
});

test("module_hotspot: falls back to module_insights when module_insights_open is absent (older snapshot)", () => {
  const snapshot = baseSnapshot({
    bugs: {
      module_insights: [{ module: "Purchase", count: 26, submodules: [] }],
      new_in_window: {},
      open_high_older: [],
      kpi: null,
    },
  });
  const [hotspot] = moduleHotspots(snapshot);
  assert.equal(hotspot.module, "Purchase");
  assert.equal(hotspot.count, 26);
});

test("cited sample bugs: prefer bugs.open_bugs over the old priority/recency-scoped pool", () => {
  const snapshot = baseSnapshot({
    bugs: {
      module_insights_open: [{ module: "Sale", count: 1, submodules: [] }],
      // A High-priority, >7-day-old open bug -- absent from the old
      // High/Medium-in-window pool, but present in open_bugs.
      open_bugs: [{ id: "PXB1-9001", priority: "High", state: "OPEN", module: "Sale" }],
      new_in_window: { High: [], Medium: [] },
      open_high_older: [],
      kpi: null,
    },
  });
  const bugs = citedBugs(snapshot);
  assert.deepEqual(bugs.map((b) => b.id), ["PXB1-9001"]);
});

test("cited sample bugs: bugs.open_bugs pool is filtered to High/Urgent only", () => {
  // 2026-07-31: module hotspot ranking switched to High/Urgent-only counts,
  // so its sample citations must match -- a Low-priority bug in the same
  // module should never be cited as "why this module is hot".
  const snapshot = baseSnapshot({
    bugs: {
      module_insights_high_urgent: [{ module: "Sale", count: 1, submodules: [] }],
      open_bugs: [
        { id: "PXB1-9002", priority: "Low", state: "OPEN", module: "Sale" },
        { id: "PXB1-9003", priority: "Urgent", state: "OPEN", module: "Sale" },
      ],
      new_in_window: { High: [], Medium: [] },
      open_high_older: [],
      kpi: null,
    },
  });
  const bugs = citedBugs(snapshot);
  assert.deepEqual(bugs.map((b) => b.id), ["PXB1-9003"]);
});

test("module_hotspot: prefers module_insights_high_urgent over module_insights_open and module_insights", () => {
  const snapshot = baseSnapshot({
    bugs: {
      module_insights: [{ module: "Sale", count: 90, submodules: [] }],
      module_insights_open: [{ module: "Sale", count: 51, submodules: [] }],
      module_insights_high_urgent: [{ module: "Sale", count: 3, submodules: [] }],
      new_in_window: {},
      open_high_older: [],
      open_bugs: [],
      kpi: null,
    },
  });
  const [hotspot] = moduleHotspots(snapshot);
  assert.equal(hotspot.count, 3); // NOT 51 or 90
});

test("module_hotspot: carries urgent_count so the Urgent sub-count is never blended into count silently", () => {
  const snapshot = baseSnapshot({
    bugs: {
      module_insights_high_urgent: [{ module: "Sale", count: 9, urgent_count: 1, submodules: [] }],
      new_in_window: {}, open_high_older: [], open_bugs: [], kpi: null,
    },
  });
  const [hotspot] = moduleHotspots(snapshot);
  assert.equal(hotspot.count, 9);
  assert.equal(hotspot.urgent_count, 1);
});

test("module_hotspot: urgent_count defaults to 0 when the module entry predates the field", () => {
  const snapshot = baseSnapshot({
    bugs: {
      module_insights_high_urgent: [{ module: "Sale", count: 9, submodules: [] }],
      new_in_window: {}, open_high_older: [], open_bugs: [], kpi: null,
    },
  });
  const [hotspot] = moduleHotspots(snapshot);
  assert.equal(hotspot.urgent_count, 0);
});

test("bug_kpi: carries open_urgent/new_urgent alongside open_high/new_high", () => {
  const snapshot = baseSnapshot({
    bugs: {
      module_insights: [], new_in_window: {}, open_high_older: [],
      kpi: { open_high: 22, open_urgent: 1, new_high: 4, new_urgent: 0, new_medium: 23, total_open: 216 },
    },
  });
  const { distilled } = distillBriefInput(snapshot, {});
  const [kpi] = distilled.evidence.filter((e) => e.kind === "bug_kpi");
  assert.equal(kpi.open_high, 22);
  assert.equal(kpi.open_urgent, 1);
  assert.equal(kpi.new_urgent, 0);
});

function agingEvidence(snapshot) {
  const { distilled } = distillBriefInput(snapshot, {});
  return distilled.evidence.filter((e) => e.kind === "aging_bug" || e.kind === "aging_bug_medium");
}

test("aging_bug evidence: flattens aging_high_urgent buckets, oldest first, capped at 3, skipping the 'none' bucket", () => {
  const snapshot = baseSnapshot({
    bugs: {
      module_insights: [],
      new_in_window: {},
      open_high_older: [],
      kpi: null,
      aging_high_urgent: [
        { range: "0-7", severity: "none", count: 1, bugs: [{ id: "FRESH", priority: "High", state: "OPEN", module: "Sale", age_days: 3 }] },
        { range: "8-14", severity: "low", count: 1, bugs: [{ id: "A", priority: "High", state: "OPEN", module: "Sale", age_days: 9 }] },
        { range: "15-21", severity: "medium", count: 1, bugs: [{ id: "B", priority: "Urgent", state: "OPEN", module: "Purchase", age_days: 21 }] },
        {
          range: "21+", severity: "high", count: 2,
          bugs: [
            { id: "C", priority: "High", state: "OPEN", module: "Sale", age_days: 90 },
            { id: "D", priority: "High", state: "OPEN", module: "Sale", age_days: 31 },
          ],
        },
      ],
    },
  });
  const evidence = agingEvidence(snapshot).filter((e) => e.kind === "aging_bug");
  // Oldest-first across the 3 non-"none" buckets, capped at 3 -- "FRESH"
  // (from the "none" bucket) and "A" (4th-oldest of the remaining) both
  // dropped: FRESH because it's too young to flag, A because only 3 fit.
  assert.deepEqual(evidence.map((e) => e.id), ["C", "D", "B"]);
  assert.equal(evidence[0].age_days, 90);
});

test("aging_bug_medium evidence: separate kind, own bounds via severityForEvidence", () => {
  const snapshot = baseSnapshot({
    bugs: {
      module_insights: [], new_in_window: {}, open_high_older: [], kpi: null,
      aging_medium: [
        { range: "0-15", severity: "none", count: 0, bugs: [] },
        { range: "16-30", severity: "low", count: 0, bugs: [] },
        { range: "31-60", severity: "medium", count: 1, bugs: [{ id: "M1", priority: "Medium", state: "OPEN", module: "Sale", age_days: 40 }] },
        { range: "60+", severity: "high", count: 0, bugs: [] },
      ],
    },
  });
  const [entry] = agingEvidence(snapshot);
  assert.equal(entry.kind, "aging_bug_medium");
  assert.equal(entry.id, "M1");
  // 40 days: past aging_bug_medium's 30d "medium" bar but well under its 60d
  // "high" bar -- must NOT be scored against the High/Urgent 7/14/21 bars
  // (which would wrongly call it "high").
  assert.equal(severityForEvidence(entry), "medium");
});

test("severityForEvidence: aging_bug and aging_bug_medium use different bounds for the same age", () => {
  // 20 days: past High/Urgent's 14d "low" bar but still under its 21d
  // "medium" bar (-> "medium"); for Medium, still under its own 30d "low"
  // bar (-> "low").
  assert.equal(severityForEvidence({ kind: "aging_bug", age_days: 20 }), "medium");
  assert.equal(severityForEvidence({ kind: "aging_bug_medium", age_days: 20 }), "low");
});

test("severityForEvidence: aging_bug age within the 'none' range (<=7d) still resolves to 'none'", () => {
  assert.equal(severityForEvidence({ kind: "aging_bug", age_days: 5 }), "none");
  assert.equal(severityForEvidence({ kind: "aging_bug_medium", age_days: 5 }), "none");
});

test("allGreen is false when there are aging bugs but nothing else is red", () => {
  const snapshot = baseSnapshot({
    bugs: {
      module_insights: [], new_in_window: {}, open_high_older: [], kpi: { open_high: 0, new_high: 0 },
      aging_high_urgent: [
        { range: "8-14", severity: "low", count: 1, bugs: [{ id: "A", priority: "High", state: "OPEN", module: "Sale", age_days: 9 }] },
      ],
    },
  });
  const { distilled } = distillBriefInput(snapshot, {});
  assert.equal(distilled.allGreen, false);
});

test("allGreen stays true when the only aging bugs are in the fresh 'none' bucket", () => {
  const snapshot = baseSnapshot({
    bugs: {
      module_insights: [], new_in_window: {}, open_high_older: [], kpi: { open_high: 0, new_high: 0 },
      aging_high_urgent: [
        { range: "0-7", severity: "none", count: 1, bugs: [{ id: "FRESH", priority: "High", state: "OPEN", module: "Sale", age_days: 3 }] },
      ],
    },
  });
  const { distilled } = distillBriefInput(snapshot, {});
  assert.equal(distilled.allGreen, true);
});
