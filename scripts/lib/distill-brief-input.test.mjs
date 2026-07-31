/**
 * Tests for scripts/lib/distill-brief-input.mjs, focused on the
 * effort_outlier evidence bug fixed 2026-07-31: it used to cite raw
 * epic.spent (a whole-epic-LIFETIME work-item sweep) in raw minutes, which
 * could wildly overstate a MIXED epic's actual overshoot (its done stories'
 * historical spend included) and was never something a human would write
 * ("spent 8600 minutes"). Verified live against PXB1-6156/PXB1-2724.
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
