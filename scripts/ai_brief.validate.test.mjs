/**
 * Tests for scripts/ai_brief.mjs: the structural/entity-existence validator
 * (validateBrief) in isolation, plus the fail-soft orchestrator (runAiBrief)
 * end to end against scratch snapshot files -- never against the real
 * web/data/latest.json.
 *
 * Run: node scripts/ai_brief.validate.test.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { runAiBrief, validateBrief } from "./ai_brief.mjs";

// ---- validateBrief -------------------------------------------------------

const DISTILLED = {
  meta: { generated_at_ms: 1, project: "PXB1", scope: "PHASE 1", sprint: "beta1-21" },
  allGreen: false,
  evidence: [
    { ref: "hotspot-1", kind: "module_hotspot", module: "Product", count: 32 },
    { ref: "bug-kpi-1", kind: "bug_kpi", open_high: 25 },
    { ref: "person-1", kind: "most_behind_person", person: "P1", overdue: 3, open: 6 },
    { ref: "person-2", kind: "most_behind_person", person: "P2", overdue: 1, open: 2 },
    { ref: "delta-1", kind: "red_delta", first_run: false, compared_to: "x", red_delta: { total_red: 0 } },
  ],
};

function goodBrief() {
  return {
    top_finding: "Product is hot and P1 is most behind.",
    empty: false,
    sections: [
      {
        title: "Top issues now",
        items: [{ text: "Product has 32 new bugs.", evidence_ref: "hotspot-1" }],
      },
      {
        title: "Since last snapshot",
        items: [{ text: "No change since last time.", evidence_ref: "delta-1" }],
      },
      {
        title: "Most behind",
        items: [{ text: "P1 has 3 overdue stories.", evidence_ref: "person-1" }],
      },
    ],
  };
}

test("validateBrief: accepts a well-formed brief with valid refs and known people", () => {
  const result = validateBrief(goodBrief(), DISTILLED);
  assert.deepEqual(result, { ok: true });
});

test("validateBrief: accepts a well-formed empty-state brief", () => {
  const brief = { top_finding: "Nothing notable this cycle.", empty: true, sections: [] };
  assert.deepEqual(validateBrief(brief, DISTILLED), { ok: true });
});

test("validateBrief: rejects wrong section count when not empty", () => {
  const brief = goodBrief();
  brief.sections.pop();
  const result = validateBrief(brief, DISTILLED);
  assert.equal(result.ok, false);
  assert.match(result.reason, /exactly 3 sections/);
});

test("validateBrief: rejects an evidence_ref that does not resolve", () => {
  const brief = goodBrief();
  brief.sections[0].items[0].evidence_ref = "hotspot-999";
  const result = validateBrief(brief, DISTILLED);
  assert.equal(result.ok, false);
  assert.match(result.reason, /does not resolve/);
});

test('validateBrief: rejects "right number, wrong person" -- a pseudonym never sent', () => {
  const brief = goodBrief();
  // Structurally fine (valid evidence_ref, same claimed numbers) but the text
  // names a person ("P9") who was never part of the distilled input at all --
  // the exact right-number/wrong-person failure mode the entity-existence
  // check exists to catch.
  brief.sections[2].items[0].text = "P9 has 3 overdue stories.";
  const result = validateBrief(brief, DISTILLED);
  assert.equal(result.ok, false);
  assert.match(result.reason, /unknown person "P9"/);
});

test("validateBrief: rejects an item citing a module hotspot but naming a different module", () => {
  const brief = goodBrief();
  // Cites hotspot-1 (module "Product") with a structurally-valid evidence_ref,
  // but the text names "Checkout" -- the module-level "right ref, wrong entity"
  // hallucination the module entity-existence check exists to catch.
  brief.sections[0].items[0].text = "The Checkout module is the hottest this week.";
  const result = validateBrief(brief, DISTILLED);
  assert.equal(result.ok, false);
  assert.match(result.reason, /module "Product" but does not name it/);
});

test("validateBrief: rejects missing/empty top_finding", () => {
  const brief = goodBrief();
  brief.top_finding = "";
  assert.equal(validateBrief(brief, DISTILLED).ok, false);
});

test("validateBrief: rejects a non-JSON-object response", () => {
  assert.equal(validateBrief(null, DISTILLED).ok, false);
  assert.equal(validateBrief("a string", DISTILLED).ok, false);
});

test("validateBrief: rejects an empty-state brief that still has sections", () => {
  const brief = { top_finding: "All clear.", empty: true, sections: [{ title: "x", items: [] }] };
  const result = validateBrief(brief, DISTILLED);
  assert.equal(result.ok, false);
  assert.match(result.reason, /zero sections/);
});

// ---- runAiBrief (fail-soft, end to end against scratch files) -----------

const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-brief-test-"));

function writeScratchSnapshot(name, data) {
  const p = path.join(scratchDir, name);
  fs.writeFileSync(p, JSON.stringify(data));
  return p;
}

const MINIMAL_SNAPSHOT = {
  meta: { generated_at_ms: Date.UTC(2026, 6, 16), project: "PXB1", scope: "PHASE 1", sprint: "beta1-21" },
  bugs: {
    module_insights: [{ module: "Product", count: 5, submodules: [{ submodule: "Catalog", count: 5 }] }],
    new_in_window: { High: [], Medium: [], Low: [] },
    open_high_older: [],
    kpi: { new_high: 0, new_medium: 0, open_high: 0, open_medium: 0, open_low: 0, total_open: 5, modules_hit: 1 },
  },
  effort: { sections: { pending: [], mixed: [], no_stories: [], done: [] } },
  schedule: { stories: [] },
  insights: { red_delta: null, compared_to: null },
};

test("runAiBrief: forced in-script throw (missing mock file) leaves the target snapshot byte-identical and reports ok:false", async () => {
  const inPath = writeScratchSnapshot("snap-throw.json", MINIMAL_SNAPSHOT);
  const before = fs.readFileSync(inPath, "utf-8");

  const result = await runAiBrief({
    argv: ["--in", inPath, "--mock", path.join(scratchDir, "does-not-exist.json")],
    env: {},
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /ENOENT|no such file/);
  assert.equal(fs.readFileSync(inPath, "utf-8"), before, "snapshot must be byte-identical after a failed run");
});

test("runAiBrief: malformed mock JSON leaves the target snapshot byte-identical and reports ok:false", async () => {
  const inPath = writeScratchSnapshot("snap-malformed.json", MINIMAL_SNAPSHOT);
  const before = fs.readFileSync(inPath, "utf-8");
  const mockPath = path.join(scratchDir, "malformed-mock.json");
  fs.writeFileSync(mockPath, "{ not valid json");

  const result = await runAiBrief({ argv: ["--in", inPath, "--mock", mockPath], env: {} });

  assert.equal(result.ok, false);
  assert.equal(fs.readFileSync(inPath, "utf-8"), before);
});

test("runAiBrief: a mock brief that fails validation (bad evidence_ref) leaves the snapshot untouched", async () => {
  const inPath = writeScratchSnapshot("snap-badref.json", MINIMAL_SNAPSHOT);
  const before = fs.readFileSync(inPath, "utf-8");
  const mockPath = path.join(scratchDir, "bad-evidence-ref-mock.json");
  fs.writeFileSync(
    mockPath,
    JSON.stringify({
      top_finding: "x",
      empty: false,
      sections: [
        { title: "a", items: [{ text: "x", evidence_ref: "does-not-exist" }] },
        { title: "b", items: [{ text: "x", evidence_ref: "does-not-exist" }] },
        { title: "c", items: [{ text: "x", evidence_ref: "does-not-exist" }] },
      ],
    }),
  );

  const result = await runAiBrief({ argv: ["--in", inPath, "--mock", mockPath], env: {} });

  assert.equal(result.ok, false);
  assert.match(result.reason, /does not resolve/);
  assert.equal(fs.readFileSync(inPath, "utf-8"), before);
});

test("runAiBrief: no AI_API_KEY and no mock skips gracefully without touching the snapshot", async () => {
  const inPath = writeScratchSnapshot("snap-nokey.json", MINIMAL_SNAPSHOT);
  const before = fs.readFileSync(inPath, "utf-8");

  const result = await runAiBrief({ argv: ["--in", inPath], env: {} });

  assert.equal(result.ok, false);
  assert.match(result.reason, /AI_API_KEY/);
  assert.equal(fs.readFileSync(inPath, "utf-8"), before);
});

test("runAiBrief: a valid mock brief is injected and written with data-derived severity + source", async () => {
  const inPath = writeScratchSnapshot("snap-good.json", MINIMAL_SNAPSHOT);
  const outPath = path.join(scratchDir, "snap-good-out.json");
  const mockPath = path.join(scratchDir, "good-mock.json");

  // Snapshot has exactly one bug module (Product -> hotspot-1) and no
  // schedule stories (no most_behind_person evidence), so the good mock here
  // only cites the hotspot + the always-present bug_kpi + delta refs.
  fs.writeFileSync(
    mockPath,
    JSON.stringify({
      top_finding: "Product is the only hotspot.",
      empty: false,
      sections: [
        { title: "Top issues now", items: [{ text: "Product has 5 new bugs.", evidence_ref: "hotspot-1" }] },
        { title: "Since last snapshot", items: [{ text: "First snapshot, no prior data.", evidence_ref: "delta-1" }] },
        { title: "Most behind", items: [{ text: "No one is overdue yet.", evidence_ref: "bug-kpi-1" }] },
      ],
    }),
  );

  const result = await runAiBrief({ argv: ["--in", inPath, "--mock", mockPath, "--out", outPath], env: {} });

  assert.equal(result.ok, true);
  assert.equal(result.modelId, "mock");

  const written = JSON.parse(fs.readFileSync(outPath, "utf-8"));
  assert.equal(written.ai_brief.status, "ok");
  assert.equal(written.ai_brief.model_id, "mock");
  assert.equal(written.ai_brief.empty, false);
  assert.equal(written.ai_brief.sections.length, 3);
  assert.equal(typeof written.ai_brief.generated_at, "number");
  // Data-derived severity + citation source are attached from the evidence:
  // hotspot-1 is module "Product" with count 5 -> "medium"; source links to /bugs.
  const firstItem = written.ai_brief.sections[0].items[0];
  assert.equal(firstItem.severity, "medium");
  assert.equal(firstItem.source.label, "Product module");
  assert.equal(firstItem.source.href, "/bugs");
  assert.equal(typeof written.ai_brief.top_severity, "string");
  // Original input untouched (we wrote to --out, not --in).
  assert.equal(fs.readFileSync(inPath, "utf-8"), JSON.stringify(MINIMAL_SNAPSHOT));
});
