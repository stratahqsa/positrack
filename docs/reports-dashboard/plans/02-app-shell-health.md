# Reports Dashboard — Plan 2: App Shell + Project Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Frontend acceptance is **browser-verified** (render + interactions + no console errors), not only unit tests — the controller runs the dev server and verifies.

**Goal:** A new Next.js app in `dashboard/` that reads the verified snapshot, is gated by the shared access code, and presents the **Project Health "is it on track?"** landing view — the first browser-visible surface, deployable to its own Vercel preview.

**Architecture:** New sibling folder `dashboard/` (parallel to `web/`), reusing `web/`'s *proven* scaffolding (the `ACCESS_CODE` auth gate, Tailwind styling, Next config) but built clean. Reads the snapshot server-side (a local `dashboard/data/latest.json` in dev; the GitHub Release in prod). The Health view **composes** tiles from the snapshot's `bugs` / `effort` / `insights` / `schedule` blocks — all client-computable, no new backend. The old `web/` app stays live and untouched.

**Tech stack:** Next.js 15, React 19, Tailwind v4, TypeScript. Vitest for the pure `lib/` logic. Snapshot JSON as the only data source.

**Non-scope (later plans):** the global filter bar + the 4 report views (Plans 3-6); the "Refresh now" button wiring (Plan later); Vercel cutover (Plan 7). Health links to the 4 views as disabled/stub nav for now.

---

## File Structure (`dashboard/`)

| File | Responsibility |
|---|---|
| `package.json`, `next.config.mjs`, `tsconfig.json`, `postcss.config.mjs` | Adapted from `web/` (rename to `posx-reports`). |
| `.claude/launch.json` | Dev-server launch config (name `dashboard`, its own port e.g. 3100). |
| `.gitignore` | Ignore `.next/`, `node_modules/`, `data/`. |
| `middleware.ts`, `app/login/page.tsx`, `app/api/login/route.ts` | Access-code gate — copied/adapted from `web/` verbatim. |
| `app/globals.css` | Copied from `web/` (the design tokens/theme). |
| `app/layout.tsx` | Root layout. |
| `lib/types.ts` | Copied from `web/lib/types.ts` (already has the extended `bugs`/`schedule`/`config` blocks). |
| `lib/data.ts` | Snapshot loader: local `dashboard/data/latest.json` in dev, Release URL in prod. |
| `lib/week.ts` | Pure release-week helpers (Tue→Mon, anchor from `config.week1_anchor`) + tests. |
| `lib/health.ts` | Pure Health-tile computations from a `Snapshot` + tests. |
| `components/health/*` | Health tiles (on-track banner, effort, deadlines, bugs, accountability). |
| `components/shell/*` | Header + nav shell. |
| `app/page.tsx` | The Project Health landing view. |
| `tests/*.test.ts` | Vitest unit tests for `lib/week.ts` + `lib/health.ts`. |

---

## Task 1: Scaffold `dashboard/` from `web/`

**Files:** all the config/auth/styling files above.

- [ ] **Step 1: Copy the scaffolding.** From the repo root, create `dashboard/` and copy+adapt from `web/`: `package.json` (rename `name` to `posx-reports`; keep the same deps + add `vitest` to devDeps + a `"test": "vitest run"` script), `next.config.mjs`, `tsconfig.json`, `postcss.config.mjs`, `app/globals.css`, `middleware.ts`, `app/login/page.tsx`, `app/api/login/route.ts`. Read each `web/` source to adapt accurately — do NOT modify anything under `web/`.
- [ ] **Step 2: Minimal layout + placeholder page.** `app/layout.tsx` (import globals.css) and a temporary `app/page.tsx` rendering `<main>Reports dashboard — scaffolding OK</main>`.
- [ ] **Step 3: Launch config.** `dashboard/.claude/launch.json` with a config named `dashboard`, `runtimeExecutable: "npm"`, `runtimeArgs: ["run","dev","--","--port","3100"]`, `port: 3100`.
- [ ] **Step 4: Install + build check.** `cd dashboard && npm install` then `npm run build`. Expected: build succeeds. Report the output.
- [ ] **Step 5: Commit.**
```bash
git add dashboard && git commit -m "feat(reports): scaffold dashboard/ app (auth + styling reused from web/)"
```
- [ ] **CONTROLLER browser-verify:** `preview_start {name:"dashboard"}` → the login gate shows; entering `ACCESS_CODE` (locally `admin`) reveals the placeholder; `read_console_messages` shows no errors. Screenshot.

---

## Task 2: Snapshot data layer

**Files:** `dashboard/lib/types.ts`, `dashboard/lib/data.ts`, `dashboard/.gitignore` (add `data/`).

- [ ] **Step 1: Types.** Copy `web/lib/types.ts` → `dashboard/lib/types.ts` verbatim (it already includes `ReportsConfigBlock`, `BugsBlock`, `ScheduleBlock`, and the extended `Snapshot`).
- [ ] **Step 2: Loader.** `dashboard/lib/data.ts`:
```typescript
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Snapshot } from "./types";

const RELEASE = process.env.SNAPSHOT_DATA_URL ??
  "https://github.com/stratahqsa/positrack/releases/download/snapshot-latest";

/** Dev reads a local snapshot (dashboard/data/latest.json); prod fetches the Release.
 *  force-dynamic pages call this per request so a refreshed snapshot shows with no redeploy. */
export async function loadSnapshot(): Promise<Snapshot> {
  const local = path.join(process.cwd(), "data", "latest.json");
  if (fs.existsSync(local)) {
    return JSON.parse(fs.readFileSync(local, "utf-8")) as Snapshot;
  }
  const res = await fetch(`${RELEASE}/latest.json`, { cache: "no-store" });
  if (!res.ok) throw new Error(`snapshot fetch failed (${res.status})`);
  return (await res.json()) as Snapshot;
}
```
- [ ] **Step 3: Seed dev data.** `mkdir -p dashboard/data && cp web/data/latest.json dashboard/data/latest.json` (gitignored). Wire `app/page.tsx` to `loadSnapshot()` and render `meta.project / meta.scope / meta.as_of_hhmm` to prove it loads.
- [ ] **Step 4: Commit.** `git add dashboard && git commit -m "feat(reports): snapshot data layer for dashboard (local dev + Release prod)"`
- [ ] **CONTROLLER browser-verify:** reload preview → the page shows `PXB1 · PHASE 1 · as of HH:MM`. No console/network errors.

---

## Task 3: Pure Health logic (TDD with Vitest)

**Files:** `dashboard/lib/week.ts`, `dashboard/lib/health.ts`, `dashboard/tests/week.test.ts`, `dashboard/tests/health.test.ts`.

These are the numbers on the Health view; they must be right, so they are unit-tested against a real snapshot fixture.

- [ ] **Step 1: `lib/week.ts` (failing test first).** Port the Python week model so dev/QA weeks match the reports:
```typescript
// Anchor Tue→Mon; week 1 start = config.week1_anchor. Mirrors scripts/reports/parse + the guides.
export function weekIndexOf(ddDateMs: number, anchorMs: number): number { /* floor((ddMidnight-anchor)/7d), min 0 */ }
export function currentWeek(nowMs: number, anchorMs: number): { index: number; startMs: number; endMs: number };
export function isThisWeek(ddMs: number, nowMs: number, anchorMs: number): boolean;
```
Tests (from `Examples_4 §7`): anchor 2026-06-30; a dd of 2026-07-08 with today 2026-07-14 → current week is Week 3 (14–20 Jul), and 2026-07-08 is NOT this week; a dd of 2026-07-15 IS this week. Deadlines before the anchor fold into week 1.
- [ ] **Step 2: `lib/health.ts` (failing tests first).** Pure functions over a `Snapshot`:
```typescript
export function bugPressure(s: Snapshot): { openHigh: number; newHigh: number; newMedium: number; totalOpen: number; hottestModule: string | null };
export function remainingEffort(s: Snapshot): { manDays: number; hours: number };   // effort.totals.grand_total
export function thisWeekDeadlines(s: Snapshot, nowMs: number): { due: number; done: number; late: number };
export function accountability(s: Snapshot, nowMs: number): { unowned: number; overdue: number; reopened: number; byPerson: {name:string; overdue:number; open:number}[] };
export function onTrackVerdict(s: Snapshot, nowMs: number): { status: "on-track" | "at-risk" | "behind"; reasons: string[] };
```
Derive from real blocks: `bugPressure` from `s.bugs.kpi` + `s.bugs.module_insights[0]`; `remainingEffort` from `s.effort.totals.grand_total.total_md`; `thisWeekDeadlines`/`accountability` from `s.schedule.stories` (a story is done via its `done` flag; overdue = not done AND `qaTs` < now; reopened = state contains "re-open"; unowned = blank assignee); `onTrackVerdict` = a documented rule combining late-count, overdue-count, and open-High (e.g. behind if any milestone/week is late AND open-High > 0). Write the fixture from the real `dashboard/data/latest.json` (trim to a handful of stories/bugs covering each case).
- [ ] **Step 3: Run** `cd dashboard && npm test` → all green.
- [ ] **Step 4: Commit.** `git add dashboard && git commit -m "feat(reports): pure Health/week computations with vitest coverage"`

---

## Task 4: App shell (header + nav)

**Files:** `dashboard/components/shell/*`, `dashboard/app/layout.tsx`.

- [ ] **Step 1:** Header showing project · scope · "as of HH:MM" (+ generated-at); a nav listing the 5 surfaces — **Health** active, the 4 reports as disabled "soon" items. Reuse the `web/` header/dual-clock treatment if useful. Keep components small and single-purpose.
- [ ] **Step 2: Commit.** `git add dashboard && git commit -m "feat(reports): app shell — header + nav"`
- [ ] **CONTROLLER browser-verify:** header + nav render; no console errors.

---

## Task 5: Project Health view

**Files:** `dashboard/components/health/*`, `dashboard/app/page.tsx`.

The landing view — tiles composed from Task 3's functions. Each tile is a small component; `page.tsx` is `force-dynamic`, calls `loadSnapshot()`, computes with `lib/health.ts`, and lays out:

- [ ] **On-track banner** — `onTrackVerdict()` status + reasons, color-coded (green/amber/red).
- [ ] **Remaining effort** — man-days open (from `remainingEffort()`), with the RED-count context from `insights`.
- [ ] **This week's deadlines** — due / done / late (from `thisWeekDeadlines()`).
- [ ] **Bug pressure** — open High, new High/Med today, hottest module (from `bugPressure()`).
- [ ] **Accountability strip** — unowned / overdue / re-opened counts + top people by overdue (from `accountability()`).
- [ ] Each tile links toward its report route (stub `#` for now). Numbers must be REAL from the snapshot.
- [ ] **Commit.** `git add dashboard && git commit -m "feat(reports): Project Health view (on-track, effort, deadlines, bugs, accountability)"`

---

## Task 6: Full browser verification + polish (CONTROLLER)

The acceptance gate for "no comebacks":
- [ ] `preview_start {name:"dashboard"}`; log in with the access code.
- [ ] `read_page` — every tile shows real numbers matching the snapshot (cross-check `bugs.kpi`, `effort.totals.grand_total.total_md`).
- [ ] `read_console_messages` + `read_network_requests` — zero errors.
- [ ] `resize_window` mobile + `colorScheme: dark` — layout holds, theme correct.
- [ ] Screenshot for the user.
- [ ] Fix any issue found (edit source, re-verify) before declaring done.

---

## Self-Review

- Spec coverage: Health view (spec §6.1) ✅; auth reuse (§9) ✅; snapshot read path ✅; config-driven week anchor ✅. Filter bar + report views deferred to Plans 3-6 (documented in Non-scope).
- No placeholders: every task has concrete files, code/signatures, and a browser-verify gate.
- Type consistency: `lib/health.ts`/`lib/week.ts` signatures are the names `app/page.tsx` and the tiles consume.

## Next

- **Plan 3** — Weekly Deadline View + the global filter bar (the first filterable table; establishes the filter-context pattern all report views reuse).
- Then Release Schedule, Bug Analysis, Effort (Plans 4-6), then harden + Vercel cutover (Plan 7).
