# Refresh reliability, YouTrack load, admin panel & per-browser timezone — design

**Date:** 2026-07-23 · **Branch:** `feat/reports-dashboard` · **Status:** approved (Mohamed, via chat)

## Problem

1. **Unreliable refresh.** The snapshot workflow's GitHub `schedule:` trigger fires 1–3.5 h
   late on every tick (verified against the last 10 runs). Suhail manually triggers runs and
   front-shifted a 5am IST slot to compensate. Every `workflow_dispatch` run in history
   started within seconds — the compute is fine; only the *trigger* is unreliable.
2. **YouTrack slowdown during refresh.** One snapshot run issues ~300–450 sequential API
   requests over ~285 s (72 per-epic GETs, 116 polled count queries for gamification,
   5 separate full work-item sweeps, per-story drill-down GETs, per-epic activity queries).
   support.posibolt.com becomes visibly slow for the team while it runs. Confirmed by
   Mohamed: the slow server is YouTrack, not the dashboard.
3. **Schedule changes need code.** Any change to refresh times/days requires editing
   workflow cron + redeploy. Wanted: front-end management ("no refreshes on Sunday").
4. **Timezone.** All absolute timestamps render IST-fixed. Team spans SA/India/GCC; the
   access PIN is shared, so the preference must be per-browser, not global.

Context change: the Vercel team (`groworx-ais-projects`) is now on **Pro** — Vercel Cron
is available at real frequencies with to-the-minute accuracy.

## Decisions (with Mohamed)

- Slow server = **YouTrack** → optimization targets request volume, not the dashboard.
- Schedule = **meeting-aligned 5 slots**: 08:00, 09:45, 12:00, 16:00, 19:00 IST
  (09:45 lands fresh data before the 10:30 dev meeting). Editable in the admin panel.
- Timezone = **auto-detect + toggle** (Auto / IST / SAST), cookie-persisted per browser.
- Admin panel = **yes**, gated by a **separate ADMIN_CODE** (viewer PIN stays view-only).
- Refresh types = **one (full) for now**; quick-vs-full deferred until post-optimization
  measurements justify it. Architecture keeps the seam (per-block builders in snapshot.py;
  workflow already takes dispatch inputs).

## A — Punctual trigger: Vercel Cron tick → config gate → `workflow_dispatch`

- `dashboard/vercel.json`: one cron `*/15 * * * *` → `GET /api/cron/refresh`.
- `dashboard/app/api/cron/refresh/route.ts`:
  1. Auth: `Authorization: Bearer ${CRON_SECRET}` (Vercel injects it automatically for
     cron invocations when the env var exists).
  2. Load `schedule.json` (see B). If disabled / paused / day off → 200 no-op.
  3. If a configured IST slot falls in `[tick, tick+15 min)` → POST GitHub
     `/repos/stratahqsa/positrack/actions/workflows/snapshot.yml/dispatches` (`ref: master`)
     with `GH_DISPATCH_TOKEN`. Return what happened (dispatched / not-due / gated).
- `.github/workflows/snapshot.yml`: `schedule:` trimmed to one overnight **fallback**
  `30 23 * * *` (5am IST) so data never goes >24 h stale even if Vercel cron dies. A small
  gate step runs ONLY for `schedule` events: fetch `schedule.json` from Blob; exit 0 early
  if disabled/paused/day-off. `workflow_dispatch` runs (manual + Vercel-dispatched) skip
  the gate — the route already gated, and explicit human intent always wins.
- **Staleness chip** (header, all pages): snapshot age > 3.5 h → amber "last refresh Xh ago".

Env (Vercel production): `GH_DISPATCH_TOKEN` ✓ (added 2026-07-23, fine-grained PAT,
Actions r/w on stratahqsa/positrack only, validated), `CRON_SECRET` ✓ (added).

## B — Admin panel (`/admin`)

- **Auth:** `ADMIN_CODE` env; same signed-cookie mechanism as the viewer gate
  (`lib/auth.ts` primitives) under a separate cookie name. Middleware: `/admin*` requires
  the admin cookie (viewer cookie insufficient); admin login form mirrors `/login`.
- **Schedule config** — single JSON at `<SNAPSHOT_SECRET>/schedule.json` in the existing
  Blob store (unguessable path, same posture as the snapshot):
  ```json
  {
    "enabled": true,
    "days": {"mon":true,"tue":true,"wed":true,"thu":true,"fri":true,"sat":true,"sun":true},
    "slots_ist": ["08:00","09:45","12:00","16:00","19:00"],
    "paused_until": null,
    "updated_at": "...", "updated_by": "admin"
  }
  ```
  `dashboard/lib/schedule-config.ts`: read (fetch from Blob; dev fallback file
  `dashboard/data/schedule.json`; missing → seed defaults above) + write (`@vercel/blob`
  `put`, needs `BLOB_READ_WRITE_TOKEN`) + pure validation/`isRefreshDue(cfg, nowUtcMs)`
  helpers (IST day-of-week + slot-window math; unit-tested).
- **Panel UI:** enabled toggle · weekday toggles · slot editor (HH:MM IST add/remove) ·
  pause-until date · save (PUT `/api/admin/schedule`).
- **Refresh Now:** POST `/api/admin/refresh` → GH API check of the latest snapshot.yml run;
  if `in_progress`/`queued` or completed <15 min ago → report that instead of dispatching;
  else dispatch. Removes Mohamed from the "please trigger it" loop.
- **Run history:** GET `/api/admin/runs` → last 10 runs (event, status, started, duration)
  via GH API, rendered in the viewer's timezone.

## C — YouTrack load: ~300–450 requests → ~50–65, ~285 s → ~60–120 s

All behaviour-preserving; snapshot JSON shape unchanged. `core/ytcore.py` is shared with
CLI/MCP — public signatures stay; new pure helpers over changed behaviour.

| # | Today | Change |
|---|---|---|
| C1 | 29 people × 4 polled `count()` queries (gamification signals) | One enriched unresolved sweep (`idReadable, updated, customFields(Assignee login/name, Estimate minutes)` — extends the sweep `_assignee_logins` already does); derive open/stale/unestimated/moved per login locally |
| C2 | 4 polled counts (`report("hygiene")`) | Same sweep → local hygiene block, identical `blocks` shape |
| C3 | 72 per-epic GETs | Chunked bulk `issue ID:` queries (~30/chunk, heavy nested fieldset), results reordered to today's `epic_ids` order |
| C4 | 5 full work-item sweeps (effort + 4 sprint pickers + 7-day worklog window) | **One** project-wide sweep with items retained; per-sprint regroup via cheap id-only sprint-membership queries + existing pure `aggregate_work()`/`_split_by_type()`; worklog window filtered locally on item date |
| C5 | 16 re-open story GETs + ~20–60 bug GETs (drill-down) | 2 chunked bulk queries feeding the existing pure resolvers |
| C6 | 16 P2-candidate meta GETs | Widen the candidates query fields; drop the second GET |
| C7 | — | `YT_THROTTLE_MS` (env, default 0; workflow sets 150) — small pause in `_req` between calls so the remaining ~50 never burst |

**Semantic nuance (accepted + documented):** YouTrack `{minus 30d}`/`{minus 7d}` date math
is day-granular in server TZ; local ms comparisons may differ by ±1 on boundary items for
the hygiene/gamification *signals* only. No effort/bug/schedule/timespent number changes.

**Verification:** run old vs new pipeline back-to-back against live YouTrack; diff the two
snapshots — identical modulo `meta.generated_at*`, `as_of_hhmm`, and the documented signal
nuance. Request counts logged before/after. Existing `tests/test_snapshot.py`,
`test_ytcore_unit.py`, `test_cli_parity.py` stay green; new unit tests for the local
derivations (signal math, bulk chunking, sprint regroup).

## D — Per-browser timezone (auto-detect + toggle)

- Cookies: `posx_tz` = `auto | Asia/Kolkata | Africa/Johannesburg` (default `auto`);
  `posx_tz_detected` = browser's IANA zone, written by a tiny client init on mount
  (one `router.refresh()` when it changes the resolution — pages are force-dynamic, so
  cookie-driven SSR means no hydration mismatch and no client-side reformatting).
- `dashboard/lib/tz.ts`: `resolveTz(cookies)` → IANA string (auto→detected→IST fallback);
  pure + unit-tested.
- `lib/format.ts`: `fmtDateTime(ms, tz)` via `Intl.DateTimeFormat` (full ICU on Vercel);
  `fmtDateTimeIst` becomes the `tz="Asia/Kolkata"` special case; call sites threaded the
  resolved tz from server pages. Date-only deadline fields stay calendar dates (no tz).
- Header: compact switcher **Auto (detected) / IST / SAST** → sets cookie +
  `router.refresh()`. The SAST·IST dual clock stays as the shared team anchor.
- Staleness chip + admin run history render in the resolved tz.

## E — Dashboard snappiness (minor)

`loadSnapshot()` gains a module-level ~60 s in-memory cache (Pro fluid instances are warm)
— replaces a 380 KB `no-store` fetch+parse on every page view. Data at most 60 s staler
than Blob; Blob changes ≤5×/day.

## F — Docs & go-live handoff

- Update `dashboard/CLAUDE.md` (data flow: tick → gate → dispatch; admin; tz),
  `snapshot.yml` header comments, `.env.example`.
- **Mohamed at go-live (2 clicks + 1 value):**
  1. Vercel → Storage → Blob store → **Connect Project** → `positrack-reports`
     (injects `BLOB_READ_WRITE_TOKEN` for schedule writes).
  2. Add `ADMIN_CODE` env (or tell me the value to add via CLI).
  3. Nothing else — `GH_DISPATCH_TOKEN` + `CRON_SECRET` already set; cron entries deploy
     with the branch.

## Out of scope (explicitly deferred)

- Quick-vs-full refresh modes — revisit with post-optimization measurements.
- Per-phase report dashboards (Mohamed mentioned Phase-1-specific report requests) —
  separate initiative; config-driven re-baselining already documented in CLAUDE.md.
- Private Blob store migration (existing follow-up note in snapshot.yml) — unchanged.

## Success criteria

1. Runs start within ≤15 min of every configured IST slot (vs 1–3.5 h drift today).
2. A full snapshot issues ≤70 YouTrack requests (logged), down from ~300–450; wall-clock
   ≤2.5 min; team reports no YouTrack slowdown during refresh.
3. Old-vs-new snapshot diff clean (modulo documented exceptions); all existing tests green.
4. Schedule/pause/Sunday-off changes done entirely from `/admin` by a non-developer.
5. Timestamps follow the per-browser tz preference; no hydration warnings; viewer PIN
   cannot reach `/admin`.
