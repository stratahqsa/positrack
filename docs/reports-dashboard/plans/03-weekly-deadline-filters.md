# Reports Dashboard — Plan 3: Weekly Deadline View + Global Filter Bar

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Frontend acceptance is **browser-verified** by the controller — filters must filter, columns must sort, rows must expand, drill-downs must stay attached. These are the exact interactions that were broken in the old dashboard.

**Goal:** The first filterable report view — PXB1 Phase-1 stories grouped by release week — plus the **global filter bar** (URL-based) that all four report views will reuse. Establishes the filter pattern once.

**Architecture:** Filter state lives in the **URL search params** (shareable + persistent across views + server-readable). A pure `applyFilters(stories, filters)` does the filtering. The Weekly Deadline view is a client component that: applies the 4-test inclusion filter → buckets by release week (`lib/week.ts`) → applies the active filters → renders collapsible week sections with a sortable 13-column table and RE-OPEN → bug drill-down. All data is already in the snapshot (`schedule.stories` carry deadlines, `done`, `epicId`, and their `bugs[]`); nothing new is fetched.

**Tech stack:** Next.js 15 (App Router, `force-dynamic`), React 19 client components for interactivity, Tailwind v4, Vitest for pure logic.

**Non-scope:** the other 3 report views (Plans 4-6); "Refresh now" wiring; deploy (Plan 7). The filter bar is built to be reused by those, but only wired to Weekly Deadline here.

---

## File Structure

| File | Responsibility |
|---|---|
| `dashboard/lib/filters.ts` | Filter state type; `parseFilters(searchParams)`, `toQueryString(filters)`; pure `applyFilters(stories, filters, nowMs)`; `deriveFilterOptions(stories)`. **Tested.** |
| `dashboard/lib/weekly.ts` | `weeklyInclude(story, cfg, nowMs)` (the 4-test filter); `bucketByWeek(stories, cfg, nowMs)` → ordered week groups. **Tested.** |
| `dashboard/components/filters/filter-bar.tsx` | Client. Multi-select chips/dropdowns per dimension + quick toggles + clear-all; writes to the URL via `useRouter`/`useSearchParams`. |
| `dashboard/components/filters/filter-context.tsx` | Optional small client hook wrapping `useSearchParams` → `Filters`. |
| `dashboard/components/weekly/week-section.tsx` | Collapsible week group (past=red / current=blue header, count badges, totals row). |
| `dashboard/components/weekly/story-table.tsx` | Client. The 13-column sortable table; done/RE-OPEN row styling; 🐛 toggle → bug sub-rows; sorting keeps bug rows with their story and the totals row last. |
| `dashboard/components/weekly/kpi-cards.tsx` | Top KPI cards (Stories/Pending/Done/Bugs/Dev/UI/QA/Total/Spent). |
| `dashboard/app/weekly/page.tsx` | `force-dynamic`; loads snapshot; renders `<FilterBar>` + KPI + week sections. |
| `dashboard/components/shell/nav.tsx` (modify) | Weekly Deadline → active link to `/weekly` (drop "soon"). |
| `dashboard/lib/format.ts` | Shared display helpers: `fmtHours(min)`, `fmtMd(min)`, `fmtDate(ms)`, `verdictVsQa(resolved, qaTs)` (early/late badge). **Tested.** |
| `dashboard/tests/*.test.ts` | Vitest for `filters`, `weekly`, `format`. |

---

## Task 1: Format helpers (`lib/format.ts`) — TDD

**Files:** `dashboard/lib/format.ts`, `dashboard/tests/format.test.ts`.

- [ ] Write failing tests, then implement:
```typescript
export function fmtHours(min: number): string;   // 1440 -> "24.0h"; 0 -> "—"
export function fmtMd(min: number): string;       // 1440 -> "3.0md" (480=1md)
export function fmtDate(ms: number | null): string; // epoch -> "08 Jul"; null -> "—"
export function verdictVsQa(resolvedMs: number | null, qaTs: number | null):
  { label: string; late: boolean } | null;         // resolved>qa -> "+Nd late"(late); else "Nd early"; null if unresolved
```
Tests from `Examples_4 §9`: resolved 08 Jul vs qa 06 Jul → `+2d late`; resolved 04 Jul vs qa 06 Jul → `2d early`; equal → not late (`+0d`); null resolved → null.
- [ ] `npm test` green. Commit `feat(reports): dashboard display/format helpers (hours, man-days, deadline verdict)`.

## Task 2: Weekly inclusion + bucketing (`lib/weekly.ts`) — TDD

**Files:** `dashboard/lib/weekly.ts`, `dashboard/tests/weekly.test.ts`. Reuses `lib/week.ts`.

- [ ] Write failing tests first (the `Examples_4 §6` truth table + §7 bucketing), then implement:
```typescript
import type { ScheduleStory, Snapshot } from "./types";
// The 4 inclusion tests (Examples_4 §4): P1 (already true for schedule.stories),
// both deadlines, >=1 estimate, (pending OR done-after-jun29), dd within shown weeks.
export function weeklyInclude(s: ScheduleStory, jun29Ms: number, weekEndMs: number): boolean;
export interface WeekGroup { index: number; label: string; startMs: number; endMs: number; isCurrent: boolean; stories: ScheduleStory[]; }
// Bucket included stories into Week 1..current by dev deadline (ddTs); dd before anchor -> Week 1;
// within a week sort by qaTs asc, tie-break storyId. Returns groups ordered earliest->latest.
export function bucketByWeek(stories: ScheduleStory[], anchorMs: number, jun29Ms: number, nowMs: number): WeekGroup[];
```
Cover: RE-OPEN with both deadlines+est → included; done resolved 25 Jun (≤ jun29) → excluded; done resolved 5 Jul → included; missing QA deadline → excluded; zero estimates → excluded; dd 21 Jul when current week ends 13 Jul → excluded; dd 12 Jun → Week 1.
- [ ] `npm test` green. Commit `feat(reports): weekly inclusion filter + week bucketing`.

## Task 3: Filter model (`lib/filters.ts`) — TDD

**Files:** `dashboard/lib/filters.ts`, `dashboard/tests/filters.test.ts`.

- [ ] Write failing tests first, then implement:
```typescript
import type { ScheduleStory } from "./types";
export interface Filters {
  assignee: string[]; sprint: string[]; state: string[]; epic: string[]; week: number[];
  pendingOnly: boolean; overdueOnly: boolean; reopenedOnly: boolean;
}
export const EMPTY_FILTERS: Filters;
export function parseFilters(sp: URLSearchParams | Record<string,string|string[]|undefined>): Filters; // URL <-> Filters
export function toQueryString(f: Filters): string;                                   // omit empty keys
export function applyFilters(stories: ScheduleStory[], f: Filters, nowMs: number): ScheduleStory[]; // AND across dims; OR within a dim
export function deriveFilterOptions(stories: ScheduleStory[]): { assignee: string[]; sprint: string[]; state: string[]; epic: string[] }; // sorted, deduped, non-empty
export function activeFilterCount(f: Filters): number;
```
Rules: a story matches if for each non-empty dimension its value is in the selected set (assignee/sprint/state/epicId), AND every active toggle holds (pendingOnly→!done; overdueOnly→!done && qaTs<now; reopenedOnly→state contains "re-open"). `parseFilters(toQueryString(f))` round-trips. Cover: multi-select OR within a dimension; AND across dimensions; each toggle; empty filters returns all.
- [ ] `npm test` green. Commit `feat(reports): URL-based global filter model (parse/serialize/apply)`.

## Task 4: Filter bar UI (`components/filters/*`)

**Files:** `dashboard/components/filters/filter-bar.tsx`, `filter-context.tsx`.

- [ ] `"use client"`. Reads current `Filters` from `useSearchParams()` via `parseFilters`; renders a compact multi-select (chips or dropdown) per dimension (Assignee, Sprint, State, Epic, Week) from `deriveFilterOptions` + a Week list, plus toggle buttons (Pending, Overdue, Re-opened) and a **Clear all** (shown when `activeFilterCount>0`). On change, push the new query string with `router.replace(pathname + "?" + toQueryString(next), {scroll:false})` so filtering is instant and the URL stays shareable.
- [ ] Style to match the app (dark, card-ring, radar accent); wrap/scroll gracefully on mobile.
- [ ] Commit `feat(reports): global filter bar (URL-driven, shareable)`.

## Task 5: Weekly Deadline view (`app/weekly/page.tsx` + `components/weekly/*`)

**Files:** the `components/weekly/*` + `app/weekly/page.tsx`; modify `components/shell/nav.tsx`.

- [ ] `app/weekly/page.tsx`: `export const dynamic = "force-dynamic"`; `loadSnapshot()`; read `Filters` from `searchParams` (server) for the initial render; compute `weekEndMs`/`anchorMs`/`jun29Ms` from `snap.config`; build the epicId→epic-summary map from `snap.schedule.epics`; `included = schedule.stories.filter(weeklyInclude)`; `filtered = applyFilters(included, filters, now)`; `groups = bucketByWeek(filtered, …)`. Render `<FilterBar>` + `<KpiCards>` + a `<WeekSection>` per group.
- [ ] `week-section.tsx`: collapsible (click header toggles); past weeks red header, current week blue; count badges (pending/done/bugs); a totals row (Dev/UI/QA/Spent sums). Empty weeks still render their header.
- [ ] `story-table.tsx` (`"use client"`): 13 columns `Story · Summary · State · Assignee · Sprint · Epic · Dev · UI · QA · Spent · Dev DL · QA DL · Resolved`; default sort QA deadline asc; **clicking a header sorts, and a story's 🐛 bug sub-rows move WITH it, totals row stays last** (this is the interaction that broke before — get it right). Done rows green tint; RE-OPEN rows red tint with a 🐛 toggle that expands `story.bugs` (Bug ID · summary · state · assignee · priority · dev ticket). State + priority badges color-coded per `PRD_4 §6`. IDs link to `https://support.posibolt.com/issue/{id}`.
- [ ] `kpi-cards.tsx`: Stories / Pending / Done / Bugs / Dev / UI / QA / Total / Spent over the *filtered* set.
- [ ] `nav.tsx`: Weekly Deadline becomes an active `<Link href="/weekly">` (remove the "soon" pill for it only).
- [ ] Commit `feat(reports): Weekly Deadline View (weeks, sortable table, RE-OPEN bug drill-down)`.

## Verification (Tasks 1-3 by implementer: `npx tsc --noEmit` + `npm test`; do NOT `npm run build` or start a dev server — the controller's server on :3100 hot-reloads)

## Task 6: Browser verification + polish (CONTROLLER — the "no comebacks" gate)
- [ ] Navigate `/weekly` (logged in). Week sections render (correct count + colors); KPI cards match the visible rows.
- [ ] **Sort**: click several column headers — order changes, and each RE-OPEN story's bug rows stay directly beneath it; totals row stays last.
- [ ] **Drill-down**: expand a RE-OPEN story's 🐛 — its open bugs show; collapse works.
- [ ] **Collapse**: week section headers toggle.
- [ ] **Filter**: pick an assignee → table + KPI update instantly; the URL gains `?assignee=…`; copy the URL to a fresh load → same filtered view (shareable). Toggle Overdue / Re-opened. Clear all resets.
- [ ] `read_console_messages` + `read_network_requests`: zero errors. Mobile (375) + light theme hold.
- [ ] Screenshot. Fix any issue (edit source, re-verify) before done.

## Self-Review
- Spec coverage: Weekly Deadline (spec §6.5) ✅; global filter bar (§8) ✅ — URL-based so filtered views are shareable (a bonus toward the "send a link" goal); RE-OPEN drill-down ✅.
- No placeholders: every task has files, signatures/logic, and a verify gate. The fragile interactions (sort-keeps-drilldown, expand, filter) have explicit browser checks.
- Type consistency: `Filters`, `WeekGroup`, and the `lib/*` signatures are the names the components consume.

## Next
- **Plan 4** — Release Schedule Tracker (epics→milestones, DONE/NOT-DONE vs baseline, epic→story→bug 3-level drill-down), reusing the filter bar + story/bug row components.
