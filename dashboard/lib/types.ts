/**
 * Types for the Control Tower snapshot (web/data/latest.json).
 * Modeled from the real committed snapshot — do not widen speculatively.
 * All *_minutes fields are minutes; divide by MAN_DAY_MINUTES (480) for man-days.
 */

export const MAN_DAY_MINUTES = 480;

export interface SnapshotMeta {
  generated_at_iso: string;
  generated_at_ms: number;
  project: string;
  scope: string;
  sprint: string;
  as_of_hhmm: string;
  engine_version: string;
}

export interface Rollup {
  server: number;
  ui: number;
  testing: number;
}

export interface Story {
  id: string;
  summary: string;
  state: string;
  scope: string;
  assignee: string;
  created: number;
  est: Rollup;
  /**
   * Child issue type — "STORY" | "BUG" | "UI" | "DEVELOPMENT" | "QA & AUTOMATION".
   * Optional: absent on older snapshots. Used by the Type filter.
   */
  type?: string;
  /**
   * Story priority — "Urgent" | "High" | "Medium" | "Low" | "". Optional on
   * older snapshots.
   */
  priority?: string;
  /**
   * The story's own "Spent time" YouTrack field (minutes) — a direct field read,
   * not the epic-level work-item sweep `Epic.spent` is. Optional: absent on
   * older snapshots. Used to scope a MIXED epic's Spent column to just its
   * pending stories (epic-effort-table.tsx), matching how Dev/UI/QA/Total
   * already exclude done stories there.
   */
  spent?: number;
}

/** Section categories present in effort.sections. */
export type EpicCategory = "DONE" | "PENDING" | "MIXED" | "NO_STORIES";

export interface Epic {
  id: string;
  summary: string;
  created: number;
  resolved: number | null;
  assignee: string;
  epic_state: string;
  stories: Story[];
  rollup_all: Rollup;
  epic_est: Rollup;
  rollup: Rollup;
  category: EpicCategory;
  missing_est: boolean;
  total: number;
  spent: number;
  overshoot: boolean;
  changed_at?: number;
  /**
   * True when the epic has no *individual* owner: assignee is blank OR parked on
   * a role/system placeholder (e.g. "Dev Lead"). Optional — absent on older
   * snapshots, in which case the UI falls back to isUnowned(assignee).
   */
  needs_owner?: boolean;
  /**
   * True specifically when the assignee is a role/system placeholder (non-blank
   * but not a real person). A subset of needs_owner. Optional on older snapshots.
   */
  role_owner?: boolean;
  /**
   * Epic priority — "Urgent" | "High" | "Medium" | "Low" | "". Optional: absent
   * on older snapshots. Drives the Priority filter.
   */
  priority?: string;
  /** Owning module/component label. Optional on older snapshots. */
  module?: string;
  /** Stories deferred to a later phase — Phase 2 or Phase 3 — under this P1
   *  epic (scope-leakage). Field name predates the Phase-3 broadening
   *  (2026-07-18) and is kept for wire-format stability. Optional. */
  p2_stories?: number;
  /** Still-pending Phase-1 stories. Optional on older snapshots. */
  p1_pending?: number;
  /** True when p2_stories > 0 — the epic is being partially deferred. Optional. */
  has_p2?: boolean;
}

export interface P2Item {
  id: string;
  summary: string;
  assignee: string;
  created: number;
  /** When the epic arrived at its CURRENT phase specifically (not its first
   *  departure from Phase 1) — a PHASE 1 -> PHASE 2 -> PHASE 3 epic reports
   *  the 2->3 date. See core/ytcore.py's _scope_arrived_at_after_cutoff. */
  changed_at: number;
  /** The epic's current scope, e.g. "PHASE 2" or "PHASE 3". Optional: absent
   *  on snapshots that predate this field (2026-07-18). */
  phase?: string;
  /** The epic's PENDING stories only (done ones already excluded upstream —
   *  this section is about outstanding work). Optional: absent on snapshots
   *  that predate this field (2026-07-18). */
  stories?: Story[];
}

export interface EffortSections {
  done: Epic[];
  pending: Epic[];
  mixed: Epic[];
  no_stories: Epic[];
  p2_backlog: P2Item[];
}

export interface EffortCounts {
  done: number;
  pending: number;
  mixed: number;
  no_stories: number;
  p2_backlog: number;
  epics_discovered: number;
}

export interface SectionTotal {
  server: number;
  ui: number;
  testing: number;
  total: number;
  spent: number;
}

export interface GrandTotal extends SectionTotal {
  server_md: number;
  ui_md: number;
  testing_md: number;
  total_md: number;
  spent_md: number;
}

export interface EffortTotals {
  pending: SectionTotal;
  mixed: SectionTotal;
  no_stories: SectionTotal;
  done: SectionTotal;
  grand_total: GrandTotal;
}

export interface EffortSpend {
  scope_query: string;
  total_minutes: number;
  unattributed_minutes: number;
  excluded: { entries: number; minutes: number; total: string };
}

export interface Effort {
  counts: EffortCounts;
  sections: EffortSections;
  totals: EffortTotals;
  spend: EffortSpend;
}

export interface TimeGroup {
  key: string;
  minutes: number;
  presentation: string;
  entries: number;
  issues: number;
  bar: string;
}

export interface TimeSpent {
  group_by: string;
  count: number;
  total_minutes: number;
  total: string;
  groups: TimeGroup[];
  scope: string;
  excluded: { entries: number; minutes: number; total: string };
}

export interface HygieneSignals {
  stale_free: number;
  estimated: number;
  moving: number;
  on_time_logging: number;
}

export interface PersonScore {
  key: string;
  name: string;
  score: number;
  signals: HygieneSignals;
  counts: { open: number; stale: number; unestimated: number; moved: number };
  logged_recently: boolean;
  red_reduction: number;
  rank: number;
}

export interface TeamScore {
  key: string;
  score: number;
  signals: HygieneSignals;
  members: string[];
  members_scored: number;
  red_reduction: number;
  rank: number;
}

export interface EngagementPerson {
  key: string;
  name: string;
}

export interface OwnerGap {
  open_epics: number;
  unowned_epics: number;
  note: string;
}

export interface Gamification {
  signals_allowlist: string[];
  signal_labels: Record<keyof HygieneSignals, string>;
  ranking_basis: string;
  window_days: number;
  stale_days: number;
  people: PersonScore[];
  teams: TeamScore[];
  engagement: EngagementPerson[];
  owner_gap: OwnerGap;
}

export interface RedCounts {
  unowned: number;
  unestimated: number;
  stale: number;
  blocked: number;
  overshoot: number;
  total_red: number;
  stale_days: number;
  /**
   * How many open epics are parked on a role/system account (subset of
   * `unowned`). Optional — absent on older snapshots.
   */
  role_owned?: number;
  /**
   * Open P1 epics with stories deferred to a later phase — Phase 2 or Phase 3
   * (scope leakage / watch list). A watch signal, NOT summed into total_red.
   * Optional on older snapshots.
   */
  deferred?: number;
}

export interface RedDelta {
  unowned?: number;
  unestimated?: number;
  stale?: number;
  blocked?: number;
  overshoot?: number;
  total_red?: number;
}

export interface Insights {
  red_counts: RedCounts;
  red_delta: RedDelta | null;
  compared_to: string | null;
}

export interface Snapshot {
  meta: SnapshotMeta;
  effort: Effort;
  timespent: TimeSpent;
  hygiene?: unknown;
  gamification: Gamification;
  insights: Insights;
  /**
   * Sprints for which per-sprint time is available, oldest → newest
   * (e.g. ["beta1-17","beta1-18","beta1-19","beta1-20"]). Optional: absent on
   * older snapshots, in which case the sprint picker is hidden.
   */
  sprints_available?: string[];
  /**
   * Per-sprint logged-time breakdown, keyed by sprint name. Same shape as
   * `timespent`. Optional on older snapshots.
   */
  timespent_by_sprint?: Record<string, TimeSpent>;
  /** Re-baseline-able reports config (project/scope/baselines). Optional: absent on older snapshots. */
  config?: ReportsConfigBlock;
  /** Bug Analysis data block. Optional: absent on older snapshots. */
  bugs?: BugsBlock;
  /** Release Schedule / Weekly Deadline data block (epics+stories+drilldown). Optional: absent on older snapshots. */
  schedule?: ScheduleBlock;
  /**
   * AI-generated proactive briefing (top issues, since-yesterday deltas, most-
   * behind people), baked into the snapshot by the Snapshot GitHub Action.
   * Optional: absent on snapshots that predate the feature, AND fail-soft —
   * a bad/timed-out model call also leaves this absent rather than writing a
   * broken `ai_brief` (see `status`/`reason` on AiBrief for the case where a
   * value IS present but generation still didn't succeed). Read via
   * `lib/brief.ts`'s `getBrief()`/`isBriefOk()`, never accessed directly.
   */
  ai_brief?: AiBrief;
  /** Bug Blocker Dashboard data block (RE-OPEN dev tickets + linked bugs).
   *  Optional: absent on snapshots that predate the feature. */
  bug_blocker?: BugBlockerBlock;
}

/** A bug linked to a Bug Blocker ticket via an OUTWARD "Bugs Reported" link,
 *  already filtered to unresolved-only (scripts/reports/bug_blocker.py). */
export interface BlockerBug {
  id: string;
  summary: string;
  state: string;
  priority: string;
}

/** A RE-OPEN development ticket (TaskType: Story) with its linked bugs split
 *  into blocking (Urgent/High/Medium, unresolved) vs low-priority
 *  (unresolved but non-blocking) — `status` is "blocked" whenever
 *  `blockingBugs` is non-empty, "ready" otherwise. */
export interface BlockerTicket {
  id: string;
  summary: string;
  state: string;
  blockingBugs: BlockerBug[];
  lowPriorityBugs: BlockerBug[];
  status: "blocked" | "ready";
}

export interface BugBlockerBlock {
  tickets: BlockerTicket[];
  kpi: { total: number; blocked: number; ready: number };
}

/**
 * AI briefing shapes (scripts/ai_brief.mjs is the producer; this file is the
 * read-side contract only — see lib/brief.ts for the pure read helpers and
 * components/insights/ for rendering). `status` distinguishes two different
 * "nothing to show" cases that must render differently: "unavailable" (this
 * cycle's generation failed/was skipped — a fail-soft outcome, not an error)
 * vs. `empty: true` on an "ok" brief (generation succeeded but found nothing
 * notable — an all-green cycle).
 */
export type AiBriefStatus = "ok" | "unavailable";

/** Finding severity — drives the red/amber/green color + icon treatment in
 *  components/insights/severity.ts. "high" = needs attention now, "medium" =
 *  worth watching, "low" = informational/good news. */
export type Severity = "high" | "medium" | "low";

/**
 * Human-readable, clickable provenance for an `AiBriefItem`'s claim — shown
 * as a trust chip (components/insights/briefing.tsx's `SourceChip`) instead
 * of the raw `evidence_ref`. At most one of `issueId`/`href` is meaningful:
 * `issueId` wins (renders via `IssueLink` out to YouTrack) when both are
 * somehow present.
 */
export interface AiBriefSource {
  /** Human-readable chip text, e.g. "PXB1-7206" or "Product bugs". May itself
   *  contain a pseudonym token ("P1") for a person reference — see
   *  `lib/brief.ts`'s `rehydrateBrief`. */
  label: string;
  /** YouTrack issue id — chip links out via the shared IssueLink/issueUrl(). */
  issueId?: string;
  /** Internal route (e.g. "/bugs") — chip links via next/link. */
  href?: string;
}

/** One bullet in a briefing section. `evidence_ref` traces the claim back to
 *  a specific entry in the distilled input (an issue id, or a synthetic key
 *  like "insights.red_delta.total_red") so every figure is checkable — kept
 *  even now that `source` carries the human-facing citation, since
 *  `evidence_ref` is also the exact-match key the upstream validator checks.
 *  `severity`/`source` are optional-tolerant: a brief baked before this pass
 *  (or the "unavailable"/`reason`-only case) lacks them, and
 *  `components/insights/briefing.tsx` falls back to a neutral bullet /
 *  evidence_ref-based chip when either is absent, rather than breaking. */
export interface AiBriefItem {
  text: string;
  evidence_ref: string;
  severity?: Severity;
  source?: AiBriefSource;
}

export interface AiBriefSection {
  title: string;
  items: AiBriefItem[];
}

export interface AiBrief {
  status: AiBriefStatus;
  /** ms epoch when the brief was generated (upstream, at snapshot time). */
  generated_at: number;
  model_id: string;
  /**
   * One-line headline for the Health teaser AND the Insights page itself.
   * May contain pseudonym tokens ("P1", "P2", …) for PERSON references — the
   * published snapshot never carries real names for privacy. Render ONLY via
   * `lib/brief.ts`'s `rehydrateBrief(brief, snapshot)`, which maps `P{i+1}`
   * to the i-th name in `accountability(...).byPerson` (the same rank order
   * the upstream pseudonymizer used) — never read `top_finding` (or an
   * item's `text`/`source.label`) directly off a snapshot-sourced brief.
   */
  top_finding: string;
  /** Severity of `top_finding` — accents the Health teaser and the Insights
   *  page's headline. Optional-tolerant, same reasoning as `AiBriefItem.severity`. */
  top_severity?: Severity;
  /** true = all-green "nothing notable" cycle. */
  empty: boolean;
  sections: AiBriefSection[];
  /** Present when status is "unavailable" — why generation didn't succeed. */
  reason?: string;
}

/** Re-baseline-able config for the PXB1 reports (scripts/reports/config.py). */
export interface ReportsConfigBlock {
  project: string;
  scope: string;
  exclude_ids: string[];
  man_day_minutes: number;
  jun29_cutoff_iso: string;
  mtg_cutoff_iso: string;
  week1_anchor: string;
}

/** A single bug row (Bug Analysis source, scripts/reports/bugs.py::parse_bug). */
export interface Bug {
  id: string;
  summary: string;
  created: number;
  state: string;
  priority: string;
  module: string | null;
  submodule: string | null;
  assignee: string;
  reporter: string;
}

export interface StateBreakdownRow {
  state: string;
  count: number;
  bar: number;
  pct: number;
}

export interface ModuleInsight {
  module: string;
  count: number;
  submodules: { submodule: string; count: number }[];
}

export interface BugsBlock {
  window: { start_ms: number; end_ms: number; label: string };
  new_in_window: { High: Bug[]; Medium: Bug[]; Low: Bug[] };
  open_high_older: Bug[];
  medium_by_state: StateBreakdownRow[];
  low_by_state: StateBreakdownRow[];
  module_insights: ModuleInsight[];
  // Optional: absent on a snapshot published before these fields existed —
  // the live Blob snapshot is regenerated on its own schedule/on-demand, not
  // atomically with a dashboard deploy, so a stale snapshot must not crash
  // the page (2026-07-21).
  seven_day_bugs?: Bug[];
  open_bugs?: Bug[];
  kpi: {
    new_high: number;
    new_medium: number;
    open_high: number;
    open_medium: number;
    open_low: number;
    total_open: number;
    modules_hit: number;
    // Optional for the same deploy-order reason as seven_day_bugs/open_bugs
    // above: Urgent sub-counts within the combined "High" bucket.
    new_urgent?: number;
    open_urgent?: number;
  };
}

/** An open bug surfaced by the RE-OPEN story → dev ticket drill-down. */
export interface DrillBug {
  bugId: string;
  summary: string;
  state: string;
  assignee: string;
  priority: string;
  devTicketId: string;
}

/** A story row shared by Release Schedule + Weekly Deadline views (scripts/reports/schedule.py::parse_story). */
export interface ScheduleStory {
  storyId: string;
  summary: string;
  state: string;
  done: boolean;
  assignee: string;
  scope: string;
  created: number | null;
  resolved: number | null;
  devEst: number;
  uiEst: number;
  qaEst: number;
  spent: number;
  ddTs: number | null;
  qaTs: number | null;
  sprint: string;
  parentId: string | null;
  epicId: string | null;
  bugs: DrillBug[];
}

export interface ScheduleEpic {
  id: string;
  summary: string;
  resolved: number | null;
  created: number | null;
}

export interface ScheduleBlock {
  epics: ScheduleEpic[];
  stories: ScheduleStory[];
  orphan_count: number;
}

/** A dated trend point derived from snapshot-*.json files. */
export interface TrendPoint {
  date: string;
  total_red: number;
  unowned: number;
  unestimated: number;
  stale: number;
  overshoot: number;
  blocked: number;
}
