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
  /** Stories deferred to Phase 2 under this P1 epic (scope-leakage). Optional. */
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
  changed_at: number;
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
   * Open P1 epics with stories deferred to Phase 2 (scope leakage / watch list).
   * A watch signal, NOT summed into total_red. Optional on older snapshots.
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
  kpi: {
    new_high: number;
    new_medium: number;
    open_high: number;
    open_medium: number;
    open_low: number;
    total_open: number;
    modules_hit: number;
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
