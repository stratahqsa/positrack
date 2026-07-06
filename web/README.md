# POSX Control Tower (`web/`)

Dark, sticky Next.js 15.5 (App Router, React 19, TypeScript) dashboard for the
PXB1 Beta Phase 1 "control tower": faithful Effort Report, RED accountability
flags, true logged-time by person, board hygiene, and hygiene gamification —
all behind a shared-code access gate.

## Stack

- **Next.js 15.5** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (CSS-first `@theme` in `app/globals.css`)
- **shadcn-style primitives** built inline in `components/ui/*` (Radix under the hood)
- **recharts** for the time bars and the RED-count trend chart
- **lucide-react** icons

## Data flow (server-side only)

The dashboard reads the snapshot **on the server** at request time (`lib/data.ts`,
marked `server-only`) from the machine-managed **GitHub Release `snapshot-latest`**,
whose assets the nightly [`Snapshot` workflow](../.github/workflows/snapshot.yml)
updates. Pages are `force-dynamic`, so each request sees the latest release data
**without a redeploy**. The snapshot is **not** committed to git (it used to live in
`web/data/*.json`); it is published to the release instead, so the nightly bot needs
only its built-in token — no push to protected master, no PAT, no external store.
Override the source with `SNAPSHOT_DATA_URL` if the repo/tag changes.

- `snapshot-latest/latest.json` — current snapshot (top-level: `meta`, `effort`,
  `timespent`, `gamification`, `insights`).
- `snapshot-latest/snapshot-YYYY-MM-DD.json` — dated history, indexed by
  `snapshot-latest/index.json`. The Trends tab charts RED-count over time once
  **≥2 distinct dates** exist; otherwise it shows "collecting data". (Same-date
  entries are de-duplicated so a mirror of `latest` does not fake a second point.)

> Because the repo is public, the release assets (which include per-person effort
> data) are publicly readable. To make them private, take the repo private and
> point `SNAPSHOT_DATA_URL`/`lib/data.ts` at an authenticated source.

All `*_minutes` fields ÷ 480 = man-days.

## Access gate (server-side)

`middleware.ts` requires a valid **signed session cookie** on every route except
`/login`, `/api/login`, and static assets. The cookie is an HMAC-SHA256 token
(Web Crypto, so the same code runs on the Edge middleware and in Node handlers),
keyed off `ACCESS_CODE` itself — so rotating the code invalidates all sessions.

- `POST /api/login { code }` compares `code` to `process.env.ACCESS_CODE`
  **server-side** and, on success, sets an `httpOnly`, `sameSite=lax`, signed
  cookie (`secure` in production).
- `DELETE /api/login` clears the session (the header "Sign out" button).
- If `ACCESS_CODE` is **unset**, the app does not crash: `/` renders an
  "ACCESS_CODE not configured" notice and `/login` shows a disabled form.

The access code is never stored client-side; only the signed token cookie is.

## Local development

```bash
cd web
npm install
ACCESS_CODE=admin npm run dev     # http://localhost:3000
```

Or copy `.env.example` → `.env.local` (already contains `ACCESS_CODE=admin`) and
run `npm run dev`. Log in with `admin`.

## Build

```bash
cd web
ACCESS_CODE=admin npm run build
```

`npm run build` must pass with no type errors. `ACCESS_CODE` is read from the env
at build/runtime; the build succeeds without it too (pages fall back to the
"not configured" notice).

## Screens

- **Header + KPI strip** (always visible): project · scope · sprint, "as of
  HH:MM", and six KPI cards — Open epics, Pending man-days, Overshoot, Stale,
  **Unowned (loud red)**, Total RED — with day-over-day deltas when a prior
  snapshot exists ("collecting data" otherwise).
- **Effort** (primary): pinned "Needs owner / estimate / status" worklist sorted
  by severity, then the five sections (Pending / Mixed / No-stories / Done /
  P2-backlog) as tables with RED treatment (overshoot ⚠, unowned highlight,
  missing-estimate). Epic rows expand to reveal their stories.
- **Time by Person**: `timespent` ledger + recharts relative bars, with a
  prominent "directional, not a scorecard" caveat and the excluded-propagated
  disclosure.
- **Teams & Hygiene**: team hygiene score(s) + per-person signals, with the
  `owner_gap` surfaced honestly.
- **Leaderboard**: per-person hygiene ranking with the four signal sub-bars,
  streak/badge treatment, the `ranking_basis` text (rewards hygiene, **not**
  hours), and the active-loggers list.
- **Trends**: RED-count over time (recharts) once ≥2 snapshots exist.

Issues link to `https://support.posibolt.com/issue/<id>`.
