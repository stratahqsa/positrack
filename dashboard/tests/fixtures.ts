import type { Snapshot } from "../lib/types";

const EMPTY_SECTION_TOTAL = { server: 0, ui: 0, testing: 0, total: 0, spent: 0 };

/**
 * A minimal, fully-typed zero-value Snapshot. Tests override just the slices
 * they exercise (bugs / schedule / config / effort.totals.grand_total) so each
 * test file stays focused on the fields its computation actually reads, while
 * still type-checking against the real Snapshot shape (no `any`).
 */
export function baseSnapshot(): Snapshot {
  return {
    meta: {
      generated_at_iso: "2026-07-14T10:19:31.416636+00:00",
      generated_at_ms: 1784024371416,
      project: "PXB1",
      scope: "PHASE 1",
      sprint: "beta1-21",
      as_of_hhmm: "10:19",
      engine_version: "control-tower-b1",
    },
    effort: {
      counts: { done: 0, pending: 0, mixed: 0, no_stories: 0, p2_backlog: 0, epics_discovered: 0 },
      sections: { done: [], pending: [], mixed: [], no_stories: [], p2_backlog: [] },
      totals: {
        pending: { ...EMPTY_SECTION_TOTAL },
        mixed: { ...EMPTY_SECTION_TOTAL },
        no_stories: { ...EMPTY_SECTION_TOTAL },
        done: { ...EMPTY_SECTION_TOTAL },
        grand_total: {
          ...EMPTY_SECTION_TOTAL,
          server_md: 0,
          ui_md: 0,
          testing_md: 0,
          total_md: 0,
          spent_md: 0,
        },
      },
      spend: {
        scope_query: "",
        total_minutes: 0,
        unattributed_minutes: 0,
        excluded: { entries: 0, minutes: 0, total: "0m" },
      },
    },
    timespent: {
      group_by: "",
      count: 0,
      total_minutes: 0,
      total: "0m",
      groups: [],
      scope: "",
      excluded: { entries: 0, minutes: 0, total: "0m" },
    },
    gamification: {
      signals_allowlist: [],
      signal_labels: { stale_free: "", estimated: "", moving: "", on_time_logging: "" },
      ranking_basis: "",
      window_days: 0,
      stale_days: 0,
      people: [],
      teams: [],
      engagement: [],
      owner_gap: { open_epics: 0, unowned_epics: 0, note: "" },
    },
    insights: {
      red_counts: {
        unowned: 0,
        unestimated: 0,
        stale: 0,
        blocked: 0,
        overshoot: 0,
        total_red: 0,
        stale_days: 0,
      },
      red_delta: null,
      compared_to: null,
    },
    config: {
      project: "PXB1",
      scope: "PHASE 1",
      exclude_ids: [],
      man_day_minutes: 480,
      jun29_cutoff_iso: "2026-06-29T10:30:00Z",
      mtg_cutoff_iso: "2026-07-03T10:30:00Z",
      week1_anchor: "2026-06-30",
    },
    bugs: {
      window: { start_ms: 0, end_ms: 0, label: "" },
      new_in_window: { High: [], Medium: [], Low: [] },
      open_high_older: [],
      medium_by_state: [],
      low_by_state: [],
      module_insights: [],
      kpi: {
        new_high: 0,
        new_medium: 0,
        open_high: 0,
        open_medium: 0,
        open_low: 0,
        total_open: 0,
        modules_hit: 0,
      },
    },
    schedule: { epics: [], stories: [], orphan_count: 0 },
  };
}
