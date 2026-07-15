# dashboard/ — POSX Reports Dashboard

Read this before touching anything in `dashboard/`. It assumes zero prior context.

## What this is

The POSX reports dashboard: **one live link** that replaces the daily WhatsApp
HTML report dumps Suhail's account used to generate and post to the PosiboltX
Admin Team group. Same content, but shared, always current, filterable, and
drill-downable instead of 4 static files nobody could interact with.

Five surfaces, all reading the same underlying data:

| Route | Surface | What it answers |
|---|---|---|
| `/` | **Health** | "Is the project on track?" — the landing view. Verdict banner + effort/deadline/bug tiles + accountability strip. |
| `/weekly` | **Weekly Deadline View** | What's due this release week, by week, sortable, with RE-OPEN → bug drill-down. |
| `/schedule` | **Release Schedule Tracker** | Epics grouped by milestone, DONE vs NOT-DONE against the meeting baseline. |
| `/bugs` | **Bug Analysis** | New bugs in the reporting window, older open High, state breakdowns, module hotspots. |
| `/effort` | **Effort Report** | The 6-section epic effort tracker (done/pending/mixed/no-stories/P2-backlog/watch-list) + Grand Total. |

Project scope today: **PXB1, Phase 1** only. The architecture is config-driven
so Phase 2 (or another project) is a config edit, not a code change — see
"Re-baselining" below.

## Architecture / data flow

```
YouTrack (support.posibolt.com, PXB1 / PHASE 1)
        │  read-only service token ($YT_TOKEN)
        ▼
scripts/reports/*.py  +  scripts/snapshot.py     (Python, runs OUTSIDE the dashboard)
        │  composes ONE snapshot dict
        ▼
web/data/latest.json  +  web/data/snapshot-<date>.json
        │  published as assets on the GitHub Release "snapshot-latest"
        │  (.github/workflows/snapshot.yml — nightly cron + workflow_dispatch)
        ▼
dashboard/lib/data.ts :: loadSnapshot()          (Next.js, server-side only)
        │  dev: reads dashboard/data/latest.json from disk if present
        │  prod: fetches the GitHub Release asset (SNAPSHOT_DATA_URL override)
        ▼
app/*/page.tsx  →  lib/*.ts (pure derivations)  →  components/*  (render)
```

**The dashboard is READ-ONLY over the snapshot.** It never talks to YouTrack,
never computes effort/bug/schedule data from scratch, and ships no service
token to the browser (`lib/data.ts` is `import "server-only"`). Every number
you see was already computed by the Python layer at snapshot time. If a number
looks wrong, first ask "is this a display bug (dashboard) or a data bug
(Python)?" — see "Where to fix what" below.

Snapshot producer is `scripts/snapshot.py` — see its own module docstring for
why precompute (a full effort sweep is ~285s, too slow for a Vercel function).
It composes `effort`, `timespent`, `hygiene`, `gamification`, `insights`,
`config`, `bugs`, `schedule` into one dict and writes both a dated file
(history) and `latest.json` (what the dashboard reads).

## Where things live

```
dashboard/
├── app/                    Next.js App Router — one folder per route
│   ├── page.tsx                    /        Health
│   ├── weekly/page.tsx              /weekly  Weekly Deadline
│   ├── schedule/page.tsx            /schedule Release Schedule
│   ├── bugs/page.tsx                /bugs    Bug Analysis
│   ├── effort/page.tsx              /effort  Effort Report
│   ├── login/page.tsx, api/login/route.ts    access-code auth
│   └── layout.tsx                   theme-init script + globals.css import
├── lib/                     Pure logic. No React in here except auth's Web Crypto calls.
│   ├── data.ts              loadSnapshot() — the ONLY place snapshot I/O happens
│   ├── types.ts              Snapshot & every block's shape — SOURCE OF TRUTH, read first
│   ├── format.ts             fmtHours/fmtMd/fmtDate/fmtDateTimeIst/verdictVsQa
│   ├── week.ts                Tue→Mon release-week arithmetic (week1_anchor-relative)
│   ├── weekly.ts              Weekly Deadline inclusion filter + week bucketing
│   ├── filters.ts             URL-based global Filters: parse/serialize/apply/derive
│   ├── health.ts              Health tile math (onTrackVerdict, accountability, bugPressure…)
│   ├── release.ts             Release Schedule: epic badges, milestone grouping, rollups
│   ├── effort.ts              Effort watch-list (S5) + info-bar counts
│   ├── utils.ts               cn() — Tailwind className combiner
│   └── auth.ts                Signed session-cookie primitives (HMAC-SHA256, Web Crypto)
├── components/
│   ├── health/                Health tiles: stat-tile (shared chrome), effort/deadlines/
│   │                           bug-pressure tiles, on-track-banner, accountability-strip
│   ├── weekly/                story-table.tsx (the 13-col sortable table + bug drill-down),
│   │                           week-section.tsx, kpi-cards.tsx, badge-tone.ts (state/priority
│   │                           → Badge variant — reused by bugs/ and release/ too)
│   ├── release/                epic-row.tsx (3-level drill-down: epic→story→bug),
│   │                           milestone-section.tsx, release-kpi.tsx
│   ├── bugs/                   bug-kpi, bug-table, section, state-breakdown, module-insights
│   ├── effort/                 effort-kpi, epic-effort-table (sortable + expandable), watch-list, section
│   ├── filters/                filter-bar.tsx (writes the URL), filter-context.tsx
│   │                           (useFilters() reads the URL), multi-select.tsx
│   ├── shell/                  header.tsx, nav.tsx (the 5-surface nav — SURFACES array),
│   │                           dual-clock.tsx (SAST+IST), sign-out-button.tsx
│   ├── ui/                     card.tsx, badge.tsx, issue-link.tsx (links out to
│   │                           support.posibolt.com/issue/<id>)
│   └── theme-toggle.tsx, login-form.tsx
├── tests/                   Vitest. One *.test.ts per non-trivial lib/ module
│                             (effort/filters/format/health/release/week/weekly)
│                             + fixtures.ts (baseSnapshot()/baseStory() builders
│                             every test overrides from)
├── data/                    gitignored. Local dev copy of latest.json lands here
└── middleware.ts            Access gate — every route except /login and /api/login
                              needs a valid session cookie
```

**Where to fix what:** changing *what data exists* (a new field, a fixed
YouTrack query, a new exclusion) = edit `scripts/reports/` and re-run
`scripts/snapshot.py`. Changing *how it's displayed* (layout, colors, sorting,
a new tile) = edit `dashboard/`. If you're not sure which side a bug is on,
check `dashboard/data/latest.json` (or the live snapshot) for the raw value
first — if it's already wrong there, it's a Python problem.

### Design tokens

Tailwind v4, CSS-first theme in `app/globals.css`. Dark is the default
palette; `:root.light` re-binds the same `--color-*` custom properties for
light mode (toggled by `components/theme-toggle.tsx`, class on `<html>`).
Use the semantic classes, never raw hex: `bg-bg / bg-surface / bg-surface-2 /
bg-elevated` (layering), `text-fg / text-muted / text-faint` (text hierarchy),
`text-accent` (brand cyan), and the tone set `danger / danger-dim / warn /
good / info / violet` used consistently for state (danger=late/blocked,
warn=pending/attention, good=done, info=neutral-active, violet=P2/watch).

### Re-baselining (e.g. for Phase 2)

`web/config/reports.json` is the re-baseline-able config: `project`, `scope`,
`exclude_ids`, `man_day_minutes`, `jun29_cutoff_iso`, `mtg_cutoff_iso`,
`week1_anchor`. `scripts/reports/config.py::load_config()` reads it (falling
back to matching dataclass defaults if the file is missing/invalid — keep
those defaults in sync with the JSON or a missing file silently reverts to
old Phase-1 baselines). Edit the JSON, re-run `scripts/snapshot.py`, done —
no dashboard code changes needed. The new values flow through as
`snapshot.config` (`ReportsConfigBlock` in `lib/types.ts`), and every page
reads `config?.foo_iso ?? DEFAULT_FOO_ISO` so older snapshots (predating the
config block) still render with the old hardcoded defaults as a fallback.

One caveat: `lib/types.ts`'s `MAN_DAY_MINUTES` constant (480) is a **separate
hardcoded TS value**, not derived from `snapshot.config.man_day_minutes`. If
a re-baseline ever changes the man-day length, update `MAN_DAY_MINUTES` too —
`fmtMd()` in `lib/format.ts` won't pick up the config value automatically.

## The snapshot shape

Top-level blocks: `meta, config, effort, bugs, schedule, timespent,
gamification, insights` (plus `sprints_available` /
`timespent_by_sprint`, optional). **`dashboard/lib/types.ts` is the source of
truth** — every field is documented there with the Python module that
produces it. Don't guess a shape; read the interface. A few load-bearing ones:

- `effort` — `Effort` (counts/sections/totals/spend). Powers the Effort view
  and the Health "remaining effort" tile. Minutes throughout; `grand_total`
  carries `*_md` man-day mirrors.
- `bugs` — `BugsBlock`. Powers Bug Analysis and the Health "bug pressure" tile.
- `schedule` — `ScheduleBlock` (`epics[]`, `stories: ScheduleStory[]`,
  `orphan_count`). Powers both Weekly Deadline and Release Schedule (same
  story list, two different groupings) plus Health's deadline/accountability
  tiles. `ScheduleStory.bugs: DrillBug[]` is the RE-OPEN drill-down, always
  empty unless the story's state contains "re-open".
- `insights.red_counts` — the RED signal counts (unowned/unestimated/stale/
  blocked/overshoot). The Health "needs an owner" stat reads
  `red_counts.unowned` (open EPICS), which is a different number from
  `health.ts`'s own `accountability().unowned` (open STORIES) — don't
  conflate them, see the doc comment on `AccountabilityStrip`.
- `config` — `ReportsConfigBlock`, see "Re-baselining" above.

Optional fields (`bugs?`, `schedule?`, `config?`, `sprints_available?`) exist
because older snapshots predate them — every page that reads one guards with
`if (!block) { <graceful notice> }` (see `app/bugs/page.tsx`,
`app/effort/page.tsx`) rather than assuming presence.

## The YouTrack gotchas (they live in Python, not here)

These are instance-specific quirks baked into `scripts/reports/parse.py` and
documented in `docs/reports-dashboard/reference/specs/`. You will never hit
them from `dashboard/` — they're listed here so you don't "fix" a dashboard
symptom that's actually upstream, and don't re-break them if you ever touch
the Python layer:

- **`TaskType: BUG`, not `Type: Bug`** — the YouTrack field for issue kind on
  this instance is named `TaskType`. Every bug query in
  `scripts/reports/bugs.py` uses `TaskType: BUG`.
- **State/Assignee/Priority/Module are custom fields**, not top-level JSON —
  YouTrack issues carry them in a `customFields[]` array; `parse.cf_name()` /
  `parse._cf_value()` are the single accessor every module goes through.
  Never read `issue["state"]` directly.
- **Date custom fields are a bare number**, not `{timestamp: n}` — "Deadline
  Date" and "QA Deadline" return a raw epoch-ms number on this instance.
  `parse.cf_date_ms()` handles the bare-number case and tolerates the
  dict-with-timestamp shape defensively.
- **PXB1-3295 is excluded** (a POS Android epic out of this scope) via
  `exclude_ids` in `web/config/reports.json`. It's dropped both as an epic
  (`schedule.fetch_epic_ids`) and for any story whose direct parent is that
  epic (`schedule.build_schedule`) — so excluded work can't leak in through
  an orphaned story either.

## Run / test / regenerate data

```bash
cd dashboard
npm run dev          # next dev, defaults to :3000
                      # (this repo's .claude/launch.json runs it on :3100 for the
                      # in-editor preview pane — don't be surprised by two ports)
npm test              # vitest run — 140 tests across 7 files, covering
                      # lib/{effort,filters,format,health,release,week,weekly}.ts
                      # (auth.ts/data.ts/utils.ts have no dedicated test file)
npm run build          # next build — THIS IS THE VERCEL GATE. Must stay green.
npx tsc --noEmit       # strict type check
```

You'll hit `/login` locally unless `ACCESS_CODE` is set in `dashboard/.env.local`
(any value — it's a shared-code gate, see `lib/auth.ts` + `middleware.ts`).

Regenerating local data from live YouTrack (needs a token):

```bash
set -a; . ~/.positrack-yt.env; set +a     # or otherwise export YT_TOKEN
python3 scripts/snapshot.py --project PXB1 --scope "PHASE 1"
cp web/data/latest.json dashboard/data/latest.json
```

`dashboard/data/` is gitignored — that copy is dev-only. In production the
Next.js app fetches the same `latest.json` from the GitHub Release instead
(see `lib/data.ts`); nothing in `dashboard/data/` is ever deployed.

## Reusable interaction patterns

Copy these, don't reinvent them — they exist because earlier versions of this
UI broke in exactly the ways these patterns prevent.

1. **Sort by re-sorting the state array — never touch the DOM.** Every
   sortable table (`weekly/story-table.tsx`, `effort/epic-effort-table.tsx`)
   keeps `rows` in `useState`, and a header click calls
   `setRows(sortStories(prev, next, ...))`. A `useEffect` keyed on the
   incoming (filtered) props re-sorts with whatever sort is currently active,
   so a URL filter change (which re-renders the server page with a new
   `stories` prop) doesn't leave the table showing stale rows.
2. **Render drill-down sub-rows in the SAME `.map` iteration as their
   parent.** `story-table.tsx` renders a story's bug rows immediately after
   it via a keyed `React.Fragment` in the same loop — never a parallel
   "expanded rows" list. This is what keeps expandable rows structurally
   attached to their parent through re-sorts. `release/epic-row.tsx` does the
   same thing two levels deep (epic → story → bug).
3. **URL-search-param filters via the shared `FilterBar`.** `lib/filters.ts`
   is the pure parse/serialize/apply/derive layer (no I/O, no React).
   `components/filters/filter-context.tsx`'s `useFilters()` reads the URL
   client-side; `components/filters/filter-bar.tsx` writes it via
   `router.replace(pathname + "?" + toQueryString(next), { scroll: false })`.
   Server pages (`app/weekly`, `app/schedule`) call `parseFilters(searchParams)`
   + `applyFilters(...)` directly — the URL is the single source of truth,
   there's no separate client filter state to fall out of sync. Note only
   Weekly Deadline and Release Schedule use this bar; Bug Analysis and Effort
   deliberately don't (see the top-of-file comment in each `page.tsx`).
4. **Collapsible sections** — a local `open` boolean + chevron, one
   component per view family (`weekly/week-section.tsx`,
   `release/milestone-section.tsx`, `bugs/section.tsx`, `effort/section.tsx`)
   rather than one over-parameterized shared component. Each has its own
   tone palette; the shape is deliberately duplicated, not abstracted —
   match that if you add a 5th.

## How to add a new report view

Concrete recipe, using the Effort view (`docs/reports-dashboard/plans/06-effort.md`)
as the template:

1. **Pure logic + tests, if you need any derivation beyond the snapshot's
   shape.** Write `dashboard/lib/<name>.ts` — pure functions over a
   `Snapshot` (or a slice of it), no I/O, no React. Write
   `dashboard/tests/<name>.test.ts` first (TDD), using `tests/fixtures.ts`'s
   `baseSnapshot()` / `baseStory()` builders and overriding only the fields
   your logic reads. Skip this step entirely if the view is pure display of
   an already-shaped snapshot block — `app/bugs/page.tsx` has no `lib/bugs.ts`
   because `bugs` arrives pre-computed and pre-sorted.
2. **`dashboard/app/<route>/page.tsx`** — an async Server Component.
   `export const dynamic = "force-dynamic"` (every page does this; snapshot
   freshness beats caching). `const snap = await loadSnapshot()`. Guard any
   optional block: `if (!snap.foo) return <graceful notice>` (see
   `app/effort/page.tsx`). If the view should support the global filter bar,
   copy `app/schedule/page.tsx`'s shape: `searchParams` prop
   (`Promise<Record<string, string | string[] | undefined>>`),
   `parseFilters(sp)`, `applyFilters(...)`, `<FilterBar>` wrapped in
   `<Suspense>`.
3. **Components in `dashboard/components/<name>/`.** At minimum a KPI strip
   (plain server component, props → render — see `effort-kpi.tsx` /
   `release-kpi.tsx` / `bug-kpi.tsx`) plus whatever tables/sections the view
   needs. Anything sortable or expandable is `"use client"` and follows
   pattern #1/#2 above — copy `weekly/story-table.tsx`, don't design a new
   sort mechanism.
4. **Add the nav entry** in `dashboard/components/shell/nav.tsx`'s
   `SURFACES` array — give it a real `href` once the route works (a surface
   without a route renders as a disabled "soon" pill automatically, since
   `href` is optional on `Surface`).
5. **Reuse existing chrome, don't rebuild it**: `components/filters/filter-bar.tsx`
   + `lib/filters.ts` for filtering; `components/weekly/badge-tone.ts`'s
   `stateVariant()` / `priorityVariant()` for any state/priority `Badge`;
   `lib/format.ts` for every number/date you render; `components/ui/{card,badge,issue-link}.tsx`
   for chrome; `lib/utils.ts`'s `cn()` for conditional classNames.
6. **Verify before calling it done**: `npm test` (new tests green, all 140+
   still green), `npx tsc --noEmit` (clean), then a browser pass —
   `npm run dev`, click the new nav entry, exercise sort/expand/filter,
   toggle the theme (sun/moon icon) and check mobile width. Finish with
   `npm run build` — that's the actual Vercel gate, and the only one that
   catches some class of type/import errors the others don't.
