# Reports Dashboard — Plan 5: Bug Analysis View

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Browser-verified by the controller (collapsible sections + correct counts).

**Goal:** The daily QA-triage view — replicating Suhail's Bug Analysis report from the already-computed snapshot `bugs` block. Route `/bugs`.

**Architecture:** Almost entirely presentational — the `bugs` block (window, new-in-window by priority, older-open High, Med/Low state breakdowns, module insights, KPI) is already computed + live-verified (Plan 1). The view renders it: a KPI bar + 4 collapsible sections. Only one small pure helper is new (an IST date-time formatter). No global filter bar (bugs aren't the story dataset; the report is already segmented by priority/state/module — a bug-specific filter is a future enhancement, out of scope).

**Tech stack:** Next.js 15 (`force-dynamic`), React 19 (collapsible sections = client), Tailwind v4, Vitest.

**Reuse:** `lib/format.ts`, `components/weekly/badge-tone.ts` (`stateVariant`, `priorityVariant`), `components/ui/{card,badge,issue-link}.tsx`, and the collapsible pattern from `components/release/milestone-section.tsx`.

---

## File Structure
| File | Responsibility |
|---|---|
| `dashboard/lib/format.ts` (modify) | Add `fmtDateTimeIst(ms)` → `"08 Jul 2026, 4:15 PM"` (IST). **Tested.** |
| `dashboard/components/bugs/bug-kpi.tsx` | KPI bar: New High/Med (window), Open High/Med/Low, Total Open, Modules Hit (7d). |
| `dashboard/components/bugs/bug-table.tsx` (client) | Reusable bug table: ID · Summary · Created · State · Assignee · Module · Reporter (used by §1/§2). |
| `dashboard/components/bugs/section.tsx` (client) | Collapsible section shell (colored header, count). |
| `dashboard/components/bugs/state-breakdown.tsx` | §3 panel: state · count pill · proportional bar · %. |
| `dashboard/components/bugs/module-insights.tsx` | §4: module · count · top submodule badges. |
| `dashboard/app/bugs/page.tsx` | `force-dynamic`; render KPI + §1-4. |
| `dashboard/components/shell/nav.tsx` (modify) | Bug Analysis → active `/bugs`. |
| `dashboard/tests/format.test.ts` (modify) | Add `fmtDateTimeIst` cases. |

---

## Task 1: `fmtDateTimeIst` helper — TDD
- [ ] Add to `dashboard/lib/format.ts` + failing test first (`Examples_1 §4`): `fmtDateTimeIst(1751971500000)` → `"08 Jul 2026, 4:15 PM"` (IST = UTC+5:30; uses a fixed +5:30 offset, not the runner's TZ). Handle null → `"—"`.
- [ ] `npm test` green. Commit `feat(reports): IST date-time formatter for bug timestamps`.

## Task 2: Bug Analysis view (`app/bugs/page.tsx` + `components/bugs/*`)
- [ ] `app/bugs/page.tsx`: `force-dynamic`; `loadSnapshot()`; if `!snap.bugs` render a graceful "no bug data" note; else render:
  - Header: title + subtitle `Covers: {bugs.window.label} · open High/Med/Low · module insights (7d)`.
  - `<BugKpi kpi={bugs.kpi}/>`.
  - **§1 — QA Bugs Reported (window)** — dark-red header (`Examples_1 §8`), collapsible; three sub-groups High → Medium → Low (from `bugs.new_in_window`), each a `<BugTable>` sorted by `created` asc; empty priority → "No bugs.".
  - **§2 — Older Open High Priority Bugs** — red header, collapsible; `<BugTable rows={bugs.open_high_older}/>`.
  - **§3 — Medium & Low by State** — amber header; two side-by-side `<StateBreakdown>` panels (`bugs.medium_by_state`, `bugs.low_by_state`): each row = state badge · count pill · bar (width `row.bar*100%`) · `row.pct%`.
  - **§4 — Module Insights (7d)** — indigo header; `<ModuleInsights modules={bugs.module_insights}/>`: each module row = name · count pill · up to 8 purple `submodule · count` badges.
- [ ] `bug-table.tsx` (`"use client"` only if it needs interactivity; otherwise server): columns ID(link) · Summary · Created(`fmtDateTimeIst`, muted) · State(badge via `stateVariant`) · Assignee · Module · Reporter. Priority color where shown per `PRD_1 §6`.
- [ ] `section.tsx`: collapsible (header click toggles), colored left rail matching the section, count in header.
- [ ] `nav.tsx`: Bug Analysis → active `<Link href="/bugs">`.
- [ ] Commit `feat(reports): Bug Analysis view (window/older-high/state-breakdown/module-insights)`.

## Verification (implementer: `npx tsc --noEmit` + `npm test`; NO build/dev-server — controller's :3100 hot-reloads)

## Task 3: Browser verification (CONTROLLER)
- [ ] `/bugs` renders; KPI matches `bugs.kpi` (New High/Med, Open H/M/L, Total, Modules).
- [ ] §1 sub-groups by priority; §2 older-High count = Open High − new-High-in-window; **§1+§2 High counts reconcile** (no overlap).
- [ ] §3 panels: bars proportional, percentages sum ≈100% per panel.
- [ ] §4: modules by count desc, ≤8 submodule badges each.
- [ ] Sections collapse/expand. Created timestamps in IST format. No console errors; mobile (panels stack) + light theme. Screenshot.

## Self-Review
- Spec coverage: Bug Analysis (spec §6.2) ✅; window/section/breakdown/module all from the verified `bugs` block. No global filter (documented rationale).
- Reuse: format, badge-tone, issue-link, collapsible pattern.

## Next
- **Plan 6** — Effort Report view (the 6 sections + Grand Total) over the snapshot `effort` block (already computed). Then Plan 7 (harden + deploy).
