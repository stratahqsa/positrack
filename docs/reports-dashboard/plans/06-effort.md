# Reports Dashboard — Plan 6: Effort Report View

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Browser-verified by the controller (section counts reconcile, Grand Total = S1 + S2, sort/expand work).

**Goal:** The comprehensive effort tracker — the 6 sections (Completed / All-Pending / Mixed / No-Stories / P2-Backlog / Watch-List) + the **Grand Total of open work**, from the already-computed snapshot `effort` block. Route `/effort`. This is the 4th and final report view; the Health page's "View Effort" tile already links here.

**Architecture:** Mostly presentational — `effort` (counts, sections, totals, spend) is computed + live-verified (Plan 1). One small pure module derives the Watch-List (S5) and the info-bar counts client-side. The view renders KPI cards + 6 collapsible, column-sortable sections with expandable epic→story sub-rows + a Grand Total bar. Rollup/estimate/spent values are **minutes** → display with `fmtHours`/`fmtMd`.

**Tech stack:** Next.js 15 (`force-dynamic`), React 19 (sort/expand = client), Tailwind v4, Vitest.

**Reuse:** `lib/format.ts` (`fmtHours`/`fmtMd`/`fmtDate`), `components/weekly/badge-tone.ts`, `components/ui/{card,badge,issue-link}.tsx`, the collapsible-section pattern, and the **sort-the-data-not-the-DOM** architecture from `components/weekly/story-table.tsx` (render expandable story sub-rows in the same map iteration so they stay attached). No global story-filter bar (effort is epic/category-centric; out of scope for v1).

---

## Effort block shape (READ `dashboard/lib/types.ts` for exact fields)
`effort.counts` `{done, pending, mixed, no_stories, p2_backlog, epics_discovered}`; `effort.sections` `{done, pending, mixed, no_stories: Epic[], p2_backlog: P2Item[]}`; `effort.totals` (per-section `{server,ui,testing,total,spent}` + `grand_total` with `*_md` man-day mirrors); `effort.spend` `{total_minutes, unattributed_minutes, excluded}`. `Epic`: `id, summary, assignee, epic_state, created, resolved, rollup{server,ui,testing}, rollup_all, total, spent, overshoot, missing_est, has_p2, p2_stories, p1_pending, stories[]`.

## File Structure
| File | Responsibility |
|---|---|
| `dashboard/lib/effort.ts` | Pure: `watchList(effort)` (pending+mixed epics with `p2_stories>0` → `{epic, source:"S1"\|"S2", p1_pending, p2_stories, ready:boolean}`), `missingEstCount`, `hasP2Count`, `readyToMoveCount`. **Tested.** |
| `dashboard/components/effort/effort-kpi.tsx` | KPI cards (Done/Pending/Dev/UI/QA/Pending-Total/Mixed/No-Stories/P2-Backlog/Has-P2/Grand-Total). |
| `dashboard/components/effort/epic-effort-table.tsx` (client) | Sortable epic table (columns vary by section) + expandable story sub-rows. Reused by S0-S2. |
| `dashboard/components/effort/watch-list.tsx` | S5 table (Epic·Summary·Assignee·P1-Pending·P2-Stories·Action). |
| `dashboard/components/effort/section.tsx` (client) | Collapsible section shell (title, count, tone). |
| `dashboard/app/effort/page.tsx` | `force-dynamic`; compose + render + Grand Total bar + info bars. |
| `dashboard/components/shell/nav.tsx` (modify) | Effort → active `/effort` (drop "soon"). |
| `dashboard/tests/effort.test.ts` | Vitest for `lib/effort.ts`. |

---

## Task 1: `lib/effort.ts` — TDD
- [ ] Write failing tests first (from `Examples_3 §8` watch-list examples), then implement `watchList`/`missingEstCount`/`hasP2Count`/`readyToMoveCount`. Rules: watch-list = epics in `sections.pending ∪ sections.mixed` where `p2_stories > 0`; `ready = p1_pending === 0`; `source` = which section it came from. `missingEstCount` = pending epics with `missing_est`. `hasP2Count` = watch-list length.
- [ ] `npm test` green. Commit `feat(reports): effort watch-list + info-bar derivations`.

## Task 2: Effort view (`app/effort/page.tsx` + `components/effort/*`)
- [ ] `app/effort/page.tsx`: `force-dynamic`; `loadSnapshot()`; if `!effort` graceful note; else render:
  - Header: `PXB1 Phase 1 — Effort Report` + `{counts.epics_discovered} epics · Done since baseline · Man-day = 8h`.
  - Info bars: a violet bar when `hasP2Count>0` ("N Phase-1 epics contain Phase-2 stories · M ready to move"); an amber bar when `missingEstCount>0` ("N epics have incomplete estimates").
  - `<EffortKpi>` (values via `fmtHours`/`fmtMd` on minute fields; Pending Total red, P2 buckets purple, Grand Total prominent).
  - **S0** ✓ Completed since baseline (`sections.done`) — cols Epic·Summary(+resolved date)·Dev·UI·QA·Total·Spent; expandable stories.
  - **S1** 📋 All Pending (`sections.pending`) — **default sort by `total` desc**; missing-est ⚠ row flag; purple "P2" badge when `has_p2`; cols Epic·Summary·Assignee·Created·Dev·UI·QA·Total·Spent·Est(⚠/✓).
  - **S2** ⚡ Mixed (`sections.mixed`) — note "N done / M pending" (from `p1_pending` + story states); expandable pending sub-rows.
  - **S3** 🚫 No Stories (`sections.no_stories`) — Epic·Summary·Assignee·Created.
  - **S4** 📁 P2 Backlog (`sections.p2_backlog`) — "→ P2 on {date}" where present; expandable open story sub-rows.
  - **S5** 👀 Watch List (`watchList(effort)`) — Epic·Summary·Assignee·P1 Pending·P2 Stories·Action ("✓ Ready to move to P2" green when `ready`, else "N P1 remaining").
  - **Grand Total bar**: `Dev {h} · UI {h} · QA {h} · Total {h} / {md}md` from `effort.totals.grand_total`.
- [ ] `epic-effort-table.tsx` (`"use client"`): sortable (click header → re-sort the data array, sub-rows stay attached — mirror `story-table.tsx`); expandable epic → story sub-rows (story id·state·assignee·est). IDs link to the tracker.
- [ ] `section.tsx`, `effort-kpi.tsx`, `watch-list.tsx` per above; `nav.tsx` → Effort active `/effort`.
- [ ] Commit `feat(reports): Effort Report view (6 sections + Grand Total)`.

## Verification (implementer: `npx tsc --noEmit` + `npm test`; NO build/dev-server — controller's :3100 hot-reloads)

## Task 3: Browser verification (CONTROLLER)
- [ ] `/effort` renders; KPI matches `effort.counts`/`totals`. **S0+S1+S2+S3+S4 epic counts = `counts.epics_discovered`** (each epic in one section).
- [ ] **Grand Total = S1 total + S2 pending total** (the identity), shown in hours + md.
- [ ] S1 sorted by total desc; missing-est ⚠ present; sort a column → reorders, epic story sub-rows stay attached.
- [ ] S5 watch-list: "Ready to move" appears iff P1 pending = 0.
- [ ] Expand an epic → its stories; collapse sections. No console errors; mobile + light theme. Screenshot.

## Self-Review
- Spec coverage: Effort Report (spec §6.4) ✅; 6 sections + Grand Total from the verified `effort` block; watch-list derived. Reuse: format/badge-tone/sort-architecture.

## Next
- **Plan 7** — Harden (`CLAUDE.md`, "how to add a report" recipe, `dashboard/data/` refresh via the existing GitHub Action, a regression smoke test) + Vercel cutover (new project/preview URL) — the deploy step needs the owner's Vercel access.
