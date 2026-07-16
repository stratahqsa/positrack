/**
 * Builds the compact, bounded, privacy-filtered JSON that actually gets sent
 * to the LLM (see scripts/ai_brief.mjs), from a full Snapshot
 * (web/data/latest.json shape -- dashboard/lib/types.ts is the source of
 * truth for field names).
 *
 * Every fact worth citing is emitted as one entry in a flat `evidence[]`
 * array, each with a stable, unique `ref`. The prompt requires the model to
 * attach a real `evidence_ref` to every claim, and ai_brief.mjs's
 * validateBrief() checks every ref actually resolves -- so `evidence` IS the
 * complete, closed set of facts+entities the model is allowed to talk about.
 *
 * PRIVACY (fail-closed default):
 *  - Person names (from mostBehind's accountability ranking) are replaced
 *    with stable per-run pseudonyms ("P1", "P2", ...) ranked in the same
 *    order accountability() ranks them, UNLESS AI_SEND_REAL_NAMES is set.
 *  - Bug `summary` free-text is never sent UNLESS AI_SEND_SUMMARIES is set.
 *  - Bug/epic assignee and reporter names are never sent to the model at all
 *    (v1 scope: only the "most behind" ranking's names go through the
 *    pseudonym system; individual bug/epic owner names add attack surface
 *    for little analytical value in a module/effort-outlier hotspot list).
 *
 * Returns { distilled, pseudonymMap } -- `distilled` is what gets sent to the
 * model (JSON.stringify'd verbatim into the prompt); `pseudonymMap` is
 * { [pseudonym]: realName } and NEVER leaves this process -- ai_brief.mjs
 * uses it to rehydrate real names into the model's output text before
 * injecting ai_brief into the snapshot (see rehydrate() there). When
 * AI_SEND_REAL_NAMES is set, pseudonymMap is empty (labels are already real
 * names, nothing to rehydrate).
 */
import { mostBehind } from "./overdue.mjs";

const TOP_MODULES_N = 3;
const BUGS_PER_MODULE_N = 2;
const TOP_PEOPLE_N = 3;
const TOP_EPIC_OUTLIERS_N = 3;

function isTruthy(v) {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s !== "" && s !== "0" && s !== "false";
}

/** Sum a red_delta value across whatever shape insights.red_delta takes (null,
 *  a number, or an object of per-category numeric deltas). >0 means worsened. */
function redDeltaTotal(rd) {
  if (rd == null) return 0;
  if (typeof rd === "number") return rd;
  if (typeof rd === "object") {
    if (typeof rd.total_red === "number") return rd.total_red;
    if (typeof rd.total === "number") return rd.total;
    return Object.values(rd).reduce((sum, v) => sum + (typeof v === "number" ? v : 0), 0);
  }
  return 0;
}

/**
 * Data-derived severity ("high"|"medium"|"low") for one evidence entry. The
 * MODEL never sets severity -- it only explains the finding in plain words;
 * the numbers decide the tier, which drives the dashboard's color + icon. So a
 * severity can never be hallucinated. Thresholds are intentionally simple and
 * tunable here in one place.
 */
export function severityForEvidence(e) {
  switch (e?.kind) {
    case "most_behind_person":
      return e.overdue >= 3 ? "high" : e.overdue >= 1 ? "medium" : "low";
    case "module_hotspot":
      return e.count >= 15 ? "high" : e.count >= 5 ? "medium" : "low";
    case "bug_kpi":
      return e.open_high >= 20 || e.new_high >= 10 ? "high" : e.open_high >= 10 ? "medium" : "low";
    case "bug":
      return e.priority === "High" ? "high" : e.priority === "Medium" ? "medium" : "low";
    case "effort_outlier":
      if (e.overshoot && e.total_minutes > 0 && e.spent_minutes >= 2 * e.total_minutes) return "high";
      return e.overshoot || e.missing_est ? "medium" : "low";
    case "red_delta":
      return redDeltaTotal(e.red_delta) > 0 ? "high" : "low";
    default:
      return "low";
  }
}

/**
 * Human-readable, clickable provenance for one evidence entry -- the "source"
 * shown as a citation chip in the dashboard (the shapeof.ai Citations /
 * Footprints trust pattern). `issueId` links to the YouTrack ticket; `href`
 * links to an internal dashboard view. For people the label is the pseudonym
 * token ("P1"), re-hydrated to a real name only in the passcode-gated app
 * (dashboard/lib/brief.ts::rehydrateBrief) -- never in the public snapshot.
 */
export function sourceForEvidence(e) {
  switch (e?.kind) {
    case "module_hotspot":
      return { label: `${e.module} module`, href: "/bugs" };
    case "bug":
      return { label: e.id, issueId: e.id };
    case "bug_kpi":
      return { label: "High-priority bugs", href: "/bugs" };
    case "most_behind_person":
      return { label: e.person, href: "/weekly" };
    case "effort_outlier":
      return e.epicSummary
        ? { label: `${e.epicId} · ${e.epicSummary}`, issueId: e.epicId }
        : { label: e.epicId, issueId: e.epicId };
    case "red_delta":
      return { label: "vs last snapshot" };
    default:
      return { label: e?.ref ?? "source" };
  }
}

/**
 * Module bug hotspots (bugs.module_insights, already pre-sorted desc by
 * count -- see health.ts's own comment on the same field) joined against the
 * individual bug lists (new_in_window.*, open_high_older) to surface a few
 * concrete, citable issue IDs per hot module. Only
 * {id, priority, state, module} per bug (+ summary iff sendSummaries) --
 * never assignee/reporter (see file header).
 */
function buildBugEvidence(snapshot, sendSummaries) {
  const moduleInsights = snapshot.bugs?.module_insights ?? [];
  const topModules = moduleInsights.slice(0, TOP_MODULES_N);

  const bugPool = [
    ...(snapshot.bugs?.new_in_window?.High ?? []),
    ...(snapshot.bugs?.open_high_older ?? []),
    ...(snapshot.bugs?.new_in_window?.Medium ?? []),
  ];

  const evidence = [];
  let bugRefCounter = 0;

  for (const [i, m] of topModules.entries()) {
    const hotspotRef = `hotspot-${i + 1}`;
    const matchingBugs = bugPool.filter((b) => b.module === m.module).slice(0, BUGS_PER_MODULE_N);
    const sampleIssueRefs = [];
    for (const b of matchingBugs) {
      bugRefCounter += 1;
      const bugRef = `bug-${bugRefCounter}`;
      const bugEntry = {
        ref: bugRef,
        kind: "bug",
        id: b.id,
        priority: b.priority,
        state: b.state,
        module: b.module,
      };
      if (sendSummaries && b.summary) bugEntry.summary = b.summary;
      evidence.push(bugEntry);
      sampleIssueRefs.push(bugRef);
    }
    evidence.push({
      ref: hotspotRef,
      kind: "module_hotspot",
      module: m.module,
      count: m.count,
      top_submodule: m.submodules?.[0]?.submodule ?? null,
      top_submodule_count: m.submodules?.[0]?.count ?? null,
      sample_issue_refs: sampleIssueRefs,
    });
  }

  const kpi = snapshot.bugs?.kpi;
  if (kpi) {
    evidence.push({
      ref: "bug-kpi-1",
      kind: "bug_kpi",
      open_high: kpi.open_high ?? 0,
      new_high: kpi.new_high ?? 0,
      new_medium: kpi.new_medium ?? 0,
      total_open: kpi.total_open ?? 0,
    });
  }

  return evidence;
}

/** Top-N most-behind people (overdue.mjs::mostBehind, i.e. health.ts's own
 *  accountability ranking), pseudonymized unless sendRealNames is set. */
function buildPeopleEvidence(snapshot, sendRealNames) {
  const ranked = mostBehind(snapshot).slice(0, TOP_PEOPLE_N);
  const pseudonymMap = {};
  const evidence = ranked.map((p, i) => {
    const label = sendRealNames ? p.name : `P${i + 1}`;
    if (!sendRealNames) pseudonymMap[label] = p.name;
    return {
      ref: `person-${i + 1}`,
      kind: "most_behind_person",
      person: label,
      overdue: p.overdue,
      open: p.open,
    };
  });
  return { evidence, pseudonymMap };
}

/**
 * Epics with overshoot=true or missing_est=true, drawn from the still-active
 * sections (pending/mixed/no_stories -- NOT `done`, since a finished epic's
 * overshoot is a historical fact, not something to act on this cycle), sorted
 * by overshoot magnitude (spent - total) descending.
 */
function buildEffortOutlierEvidence(snapshot, sendSummaries) {
  const sections = snapshot.effort?.sections;
  if (!sections) return [];
  const pool = [...(sections.pending ?? []), ...(sections.mixed ?? []), ...(sections.no_stories ?? [])];
  const outliers = pool
    .filter((e) => e.overshoot || e.missing_est)
    .sort((a, b) => b.spent - b.total - (a.spent - a.total));

  return outliers.slice(0, TOP_EPIC_OUTLIERS_N).map((e, i) => {
    const entry = {
      ref: `epic-${i + 1}`,
      kind: "effort_outlier",
      epicId: e.id,
      overshoot: Boolean(e.overshoot),
      missing_est: Boolean(e.missing_est),
      total_minutes: e.total,
      spent_minutes: e.spent,
    };
    // Epic summaries are free-text; gate their egress to the LLM behind
    // AI_SEND_SUMMARIES, same as bug summaries (privacy consistency). The
    // citation source still links by epic id when the summary is withheld.
    if (sendSummaries && e.summary) entry.epicSummary = e.summary;
    return entry;
  });
}

/**
 * Pass-through of the already-computed red-counts delta (insights.red_delta +
 * insights.compared_to) -- deliberately NOT re-diffed here. red_delta is null
 * on the first-ever snapshot (nothing to compare to yet); first_run makes
 * that explicit for the prompt instead of it having to infer null-ness.
 */
function buildDeltaEvidence(snapshot) {
  const redDelta = snapshot.insights?.red_delta ?? null;
  const comparedTo = snapshot.insights?.compared_to ?? null;
  return {
    ref: "delta-1",
    kind: "red_delta",
    first_run: redDelta === null,
    compared_to: comparedTo,
    red_delta: redDelta,
  };
}

/**
 * "Nothing notable this cycle": no one meaningfully overdue among the
 * most-behind ranking, no effort outliers, no open/new High bug pressure, and
 * the RED delta (if any) didn't worsen in any category. Used so the prompt
 * renders an honest empty-state brief instead of inventing issues.
 */
function computeAllGreen({ snapshot, peopleEvidence, effortEvidence, deltaEvidence }) {
  const anyOverdue = peopleEvidence.some((p) => p.overdue > 0);
  const anyEffortOutliers = effortEvidence.length > 0;
  const openHigh = snapshot.bugs?.kpi?.open_high ?? 0;
  const newHigh = snapshot.bugs?.kpi?.new_high ?? 0;
  const anyHighBugs = openHigh > 0 || newHigh > 0;
  const delta = deltaEvidence.red_delta;
  const deltaWorsened = delta != null && Object.values(delta).some((v) => (v ?? 0) > 0);
  return !anyOverdue && !anyEffortOutliers && !anyHighBugs && !deltaWorsened;
}

/**
 * @param {import("../../dashboard/lib/types.ts").Snapshot} snapshot
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{distilled: object, pseudonymMap: Record<string,string>}}
 */
export function distillBriefInput(snapshot, env = process.env) {
  const sendRealNames = isTruthy(env.AI_SEND_REAL_NAMES);
  const sendSummaries = isTruthy(env.AI_SEND_SUMMARIES);

  const bugEvidence = buildBugEvidence(snapshot, sendSummaries);
  const { evidence: peopleEvidence, pseudonymMap } = buildPeopleEvidence(snapshot, sendRealNames);
  const effortEvidence = buildEffortOutlierEvidence(snapshot, sendSummaries);
  const deltaEvidence = buildDeltaEvidence(snapshot);

  const allGreen = computeAllGreen({ snapshot, peopleEvidence, effortEvidence, deltaEvidence });

  const distilled = {
    meta: {
      generated_at_ms: snapshot.meta?.generated_at_ms ?? null,
      project: snapshot.meta?.project ?? null,
      scope: snapshot.meta?.scope ?? null,
      sprint: snapshot.meta?.sprint ?? null,
    },
    allGreen,
    evidence: [...bugEvidence, ...peopleEvidence, ...effortEvidence, deltaEvidence],
  };

  return { distilled, pseudonymMap };
}
