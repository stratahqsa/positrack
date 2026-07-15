# Reports Dashboard — Plan 4: Release Schedule Tracker

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Frontend acceptance is browser-verified by the controller — the 3-level drill-down (milestone → epic → story → bug) and milestone grouping are the risk areas.

**Goal:** The meeting view — every PXB1 Phase-1 epic grouped by release **milestone**, showing DONE / NOT-DONE vs the meeting baseline, early/late delivery, and a 3-level drill-down (epic → its stories → a RE-OPEN story's open bugs). Route `/schedule`.

**Architecture:** Pure logic in `lib/release.ts` composes over the snapshot's `schedule` (epics + stories with deadlines + `bugs[]`) and `effort` (for per-epic assignee/state — `schedule.epics` don't carry those) blocks. The view reuses Plan 3's filter bar, `lib/format`, `badge-tone`, `IssueLink`, and row styling. Milestone grouping + badges follow `PRD_2` / `Examples_2` exactly.

**Tech stack:** Next.js 15 (`force-dynamic`), React 19 client components for the nested expand/collapse, Tailwind v4, Vitest.

**Non-scope:** Bug Analysis + Effort views (Plans 5-6); deploy (Plan 7). Reuses the filter bar as-is (no new filter dimensions).

---

## Reuse (do NOT rebuild)
- `dashboard/lib/format.ts` (`fmtHours`/`fmtMd`/`fmtDate`/`verdictVsQa`), `dashboard/lib/filters.ts` (`applyFilters`/`parseFilters`/`deriveFilterOptions`), `dashboard/components/filters/*`, `dashboard/components/weekly/badge-tone.ts`, `dashboard/components/ui/{card,badge,issue-link}.tsx`, `dashboard/lib/types.ts`.

## File Structure
| File | Responsibility |
|---|---|
| `dashboard/lib/release.ts` | Pure: epic assignee/state map from `effort`; per-epic badge, milestone, visible-stories, rollup; milestone grouping + urgency. **Tested.** |
| `dashboard/components/release/milestone-section.tsx` | Collapsible milestone group (urgency-colored header, summary + totals). |
| `dashboard/components/release/epic-row.tsx` (client) | Epic row (badge, NEW, assignee, rollup, resolved verdict) + expand → stories; RE-OPEN story → bug sub-rows (3rd level). |
| `dashboard/components/release/release-kpi.tsx` | Top summary (epics, done/pending, grand Dev/UI/QA/Spent, final release date). |
| `dashboard/app/schedule/page.tsx` | `force-dynamic`; compose + render. |
| `dashboard/components/shell/nav.tsx` (modify) | Release Schedule → active `/schedule`. |
| `dashboard/tests/release.test.ts` | Vitest. |

---

## Task 1: Release logic (`lib/release.ts`) — TDD

**Constants from `snap.config`:** `mtgCutoffMs = iso→ms(mtg_cutoff_iso)` (3 Jul 4PM IST), `jun29Ms`, display cutoff = `2026-07-03` (mtg date). Excludes already applied upstream.

- [ ] Write failing tests first (from `Examples_2 §3-9`), then implement:
```typescript
import type { Snapshot, ScheduleStory, ScheduleEpic } from "./types";
export type EpicBadge = "DONE" | "NOT_DONE" | "NO_STORIES" | string; // string = the single story's state
export interface EpicView {
  id: string; summary: string; assignee: string; isNew: boolean;
  badge: EpicBadge; done: boolean;
  stories: ScheduleStory[];          // ALL stories (for badge/milestone math)
  visibleStories: ScheduleStory[];   // per visibility rule (Examples_2 §4)
  rollup: { dev: number; ui: number; qa: number; spent: number };
  milestoneMs: number | null;
  resolvedMs: number | null; resolvedVerdict: { label: string; late: boolean } | null;
}
export interface MilestoneGroup {
  ms: number; label: string; daysFromNow: number; urgency: "overdue"|"d3"|"d7"|"d14"|"far"|"alldone";
  epics: EpicView[]; counts: { epics: number; stories: number; pending: number; done: number };
  totals: { dev: number; ui: number; qa: number; spent: number };
}
export function assigneeByEpic(snap: Snapshot): Record<string, string>; // from effort.sections epics
export function epicBadge(stories: ScheduleStory[], epicResolvedMs: number|null, mtgCutoffMs: number): EpicBadge;
export function buildEpicView(epic: ScheduleEpic, stories: ScheduleStory[], assignee: string, mtgCutoffMs: number, jun29Ms: number, nowMs: number): EpicView;
export function groupByMilestone(views: EpicView[], displayCutoffMs: number, nowMs: number): MilestoneGroup[];
export function grandTotals(groups: MilestoneGroup[]): { dev: number; ui: number; qa: number; spent: number; finalMs: number|null };
```
Rules (test each, cite `Examples_2`):
- **Badge (§3):** epic `resolved > mtg` → DONE; else all stories done → DONE; exactly 1 story → that story's state; any pending → NOT_DONE; 0 stories → NO_STORIES.
- **Milestone (§5):** `max(ddTs, qaTs)` across all stories; fallback epic.resolved; null → trailing "no date" group.
- **Visible stories (§4):** NOT_DONE → pending ∪ (done & resolved>mtg); DONE → resolved>jun29.
- **Rollup (§4):** NOT_DONE → sum over pending stories; DONE → sum over visible.
- **Urgency (§5):** ≤0d overdue, ≤3d, ≤7d, ≤14d, >14d; all-epics-done group → "alldone" (green) regardless of date.
- **Display cutoff:** only milestones with `ms >= 2026-07-03` (or the no-date group) render.
- **isNew (§7):** `created > mtg`.
- **resolvedVerdict:** DONE epics only; `verdictVsQa(resolvedMs, milestoneMs)`.
- [ ] `npm test` green. Commit `feat(reports): release-schedule milestone/badge/rollup logic`.

## Task 2: Release Schedule view (`app/schedule/page.tsx` + `components/release/*`)

- [ ] `app/schedule/page.tsx`: `force-dynamic`; `loadSnapshot()`; `nowMs = meta.generated_at_ms`; parse `Filters` from searchParams; **apply the filter bar to STORIES first** (`applyFilters(schedule.stories, filters, now)`), then group each epic's *filtered* stories; build `EpicView`s (epics with no surviving stories after filtering are dropped unless NO_STORIES and no filter active); `groups = groupByMilestone(...)`. Render `<FilterBar>` (reuse; options from `deriveFilterOptions(schedule.stories)` + epicNames) + `<ReleaseKpi>` + `<MilestoneSection>` per group + a final-release banner.
- [ ] `milestone-section.tsx`: collapsible; urgency-colored header (palette: overdue `#7f1d1d`→ danger, d3, d7, d14, far → green, alldone → green), summary "N epics · M stories (P pending / D done)" + a totals row.
- [ ] `epic-row.tsx` (`"use client"`) — **the 3-level drill-down; manage two expand Sets (`expandedEpics`, `expandedStories`) OR one component per epic with local state.** Recommended: one `<EpicRow>` client component per epic holding its own `expanded` (stories) + a `Set` of expanded story IDs. Render: the epic row (chevron toggle, ID link, summary, badge via `badge-tone` or DONE/NOT-DONE styling, NEW badge, assignee, rollup Dev/UI/QA/Spent, resolved date + verdict badge). When expanded, render its `visibleStories` as sub-rows (indented) reusing the weekly story-row column style (state, assignee, sprint, ests, deadlines, resolved). A RE-OPEN story with `bugs.length` gets its own 🐛 toggle → its bug rows (3rd level, deeper indent). Done epic rows green-tinted, NOT-DONE red-tinted. Sorting is NOT required here (milestone/meeting view is grouped, not sorted) — keep it simple; nested expand/collapse is the interaction.
- [ ] `release-kpi.tsx`: epics · pending · done · grand Dev/UI/QA/Spent (hours + md) · final release date.
- [ ] `nav.tsx`: Release Schedule → active `<Link href="/schedule">`.
- [ ] Commit `feat(reports): Release Schedule Tracker (milestones, DONE/NOT-DONE, 3-level drill-down)`.

## Verification (implementer: `npx tsc --noEmit` + `npm test`; NO build/dev-server — controller's :3100 hot-reloads)

## Task 3: Browser verification (CONTROLLER)
- [ ] `/schedule` renders; milestone groups in ascending date order, urgency colors correct, only ≥ 3 Jul shown.
- [ ] Epic badges: find a DONE epic (green ✓), a NOT-DONE (red ✗), a single-story epic (shows the story's state), NO_STORIES.
- [ ] **3-level drill-down**: expand an epic → its stories appear; expand a RE-OPEN story → its open bugs appear; collapse both. Confirm nesting/indent is clear and rows don't detach.
- [ ] Resolved verdict badges (early green / late red) on DONE epics.
- [ ] Filter (e.g. an assignee) narrows epics/stories + KPI; URL updates; Clear all resets.
- [ ] No console errors; mobile + light theme hold; screenshot.

## Self-Review
- Spec coverage: Release Schedule (spec §6.3) ✅; 3-level drill-down ✅; baseline-driven badges via config ✅. Grand totals over pending ✅.
- Reuse: filter bar, format, badge-tone, issue-link — no duplication.
- Type consistency: `EpicView`/`MilestoneGroup` are what the components consume.

## Next
- **Plan 5** — Bug Analysis view (bug-centric: KPI bar, new-in-window by priority, older-open High, Med/Low by state, module insights) over the snapshot `bugs` block.
