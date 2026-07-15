# PXB1 Reports Dashboard — Deployment & Next-Steps Handoff

> **Purpose:** everything a fresh session (or a new person) needs to deploy the rebuilt reports dashboard and continue the work, with **zero prior conversation context**. Read this top-to-bottom, then start at [§5 Deploy](#5-deploy-the-remaining-task).

---

## 0. Initial prompt (paste this into a fresh session)

```
I'm deploying the PXB1 reports dashboard we just rebuilt. Read
docs/reports-dashboard/HANDOFF.md for full context, then dashboard/CLAUDE.md
for the app internals.

State: a COMPLETE, browser-verified Next.js app lives in dashboard/ on branch
feat/reports-dashboard (all 5 views done, 140 tests passing, build passes). It
is NOT yet deployed. The old web/ dashboard is untouched and still live.

Help me ship it:
1. Confirm the branch state (git status; we should be on feat/reports-dashboard).
2. Walk me through the deploy in HANDOFF.md §5 — Step 1 is the snapshot refresh
   (gh workflow run "Snapshot" --ref feat/reports-dashboard; gh is authed as
   stratahqsa). Step 2 is the Vercel project (I'll do the clicks; the Vercel CLI
   is NOT logged in here). Verify each step before moving on.
3. Once I paste you the live URL, run a FULL browser verification against the
   real deployment (HANDOFF.md §6) so I can share it with the team with zero doubt.

Start by reading the handoff + confirming git state, then give me the exact
Step 1 command and what "done" looks like.
```

---

## 1. TL;DR — current state (2026-07-15)

- A **from-scratch rebuild** of the PXB1 reports dashboard is **COMPLETE and browser-verified**, on branch **`feat/reports-dashboard`** (~36 commits; HEAD = the `chore(reports): wire Health tile links + CLAUDE.md` commit).
- It is a **new Next.js app in `dashboard/`** (sibling to the old `web/` app), with **5 surfaces**: Project **Health** + faithful **Weekly Deadline**, **Release Schedule**, **Bug Analysis**, **Effort** reports.
- **Not yet deployed.** Remaining work = the Vercel deploy (owner's step) + live verification.
- The **old `web/` dashboard (`positrack-flame.vercel.app`) is untouched and still live** — the plan is preview-first, flip later.
- `gh` CLI is authenticated (as `stratahqsa`). **Vercel CLI is NOT logged in** on this machine → the Vercel project creation is a manual/owner step.

## 2. Why this exists

Suhail (PM) generated 4 HTML reports daily from YouTrack and dumped the files into the **PosiboltX Admin** WhatsApp group. This replaces that with **one live, access-gated, filterable link** the whole team opens — plus a **Project Health "is it on track?"** overview none of the original reports gave. A previous attempt failed by trying to *clone the report HTML* (broken filters, rows wouldn't expand); this rebuild models the **data + jobs** first and renders faithfully second.

## 3. Architecture (data flow)

```
YouTrack (support.posibolt.com, PXB1 / PHASE 1)
    │  read-only service token (YT_TOKEN, a GitHub Actions secret)
    ▼
Python data layer — scripts/reports/*.py + scripts/snapshot.py
    │  (nightly GitHub Action "Snapshot", 02:00 UTC, + manual dispatch)
    ▼
One snapshot JSON  →  published to GitHub Release  snapshot-latest / latest.json
    │  (public asset; no token needed to read)
    ▼
dashboard/lib/data.ts  reads it server-side (force-dynamic, per request)
    ▼
The 5 views render it.  ── THE DASHBOARD IS READ-ONLY OVER THE SNAPSHOT ──
```

The vendored engine `core/ytcore.py` was **never touched** (it's 3-way sync-gated). All new report-data code is in `scripts/reports/` (Python) and `dashboard/` (Next.js).

## 4. Where things live

| Path | What |
|---|---|
| `dashboard/` | The new Next.js 15 app. Routes: `app/page.tsx` (Health), `app/{weekly,schedule,bugs,effort}/page.tsx`. Logic: `dashboard/lib/*` (`data, types, format, week, weekly, filters, health, release, effort`). Components: `dashboard/components/*` (per-view + shared `filters/`, `ui/`, `shell/`, `weekly/badge-tone`). |
| `dashboard/CLAUDE.md` | **The internals guide + "how to add a report" recipe.** Read this to change/extend the app. |
| `scripts/reports/{config,parse,bugs,schedule,drilldown}.py` | The Python data layer (fetch + parse + shape). `scripts/snapshot.py` composes the snapshot. |
| `web/config/reports.json` | Re-baseline-able config (project, scope, baseline dates). Phase 2 = edit this, no code. |
| `docs/reports-dashboard/DESIGN-SPEC.md` | The approved spec (decisions, architecture). |
| `docs/reports-dashboard/plans/01-06*.md` | The implementation plans (each built + verified). |
| `docs/reports-dashboard/reference/specs/` | Suhail's original PRDs / requirements / implementation guides — the ground truth for each report. |

## 5. DEPLOY (the remaining task)

**Do Step 1 before Step 2** — the deployed app reads its data from the Release, so the Release must carry the new-format snapshot first.

### Step 1 — refresh the live data (GitHub Action, ~5–8 min)
```bash
gh workflow run "Snapshot" --ref feat/reports-dashboard
# watch it:
gh run list --workflow="Snapshot" --limit 1
# after it's green, confirm the Release now has the new blocks:
curl -sL https://github.com/stratahqsa/positrack/releases/download/snapshot-latest/latest.json \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('bugs:', 'bugs' in d, '| schedule:', 'schedule' in d, '| config:', 'config' in d)"
# expect: bugs: True | schedule: True | config: True
```
This is the **existing read-only YouTrack job** run on the new code. The new blocks are **additive**, so the old `web/` dashboard keeps working unchanged.

### Step 2 — create the Vercel project (owner, ~2 min; CLI not authed here)
Vercel → **Add New… → Project → import `stratahqsa/positrack`**, then:

| Setting | Value |
|---|---|
| **Root Directory** | `dashboard` |
| **Framework** | Next.js (auto-detected) |
| **Env var** | `ACCESS_CODE` = *a team code you choose* |
| **Production Branch** (Settings → Git) | `feat/reports-dashboard` |

Redeploy after setting the production branch. **No `YT_TOKEN`/`SNAPSHOT_DATA_URL` needed** — the app reads the public Release. This is a **separate** Vercel project, so the old one is untouched.

### Step 3 — verify & share
Open the URL → log in with `ACCESS_CODE` → run [§6](#6-verify-the-live-deployment). Then share the **link + access code** in WhatsApp.

## 6. Verify the live deployment

A fresh agent can drive a browser (`mcp__Claude_Browser__navigate` to the live URL). Checklist:
- [ ] `/login` gate blocks; `ACCESS_CODE` logs in.
- [ ] **Health** shows a verdict (On-track/At-risk/Behind) + real numbers; the "View →" tiles link to the reports.
- [ ] **Weekly Deadline**: week sections render; click a column header → rows re-sort; expand a RE-OPEN story's 🐛 → bugs show and stay attached through a re-sort; pick an Assignee filter → table + KPI update and the URL gains `?assignee=…` (shareable).
- [ ] **Release Schedule**: milestones in date order; expand epic → stories → a RE-OPEN story → bugs (3 levels).
- [ ] **Bug Analysis**: KPI reconciles (§1-new-High + §2-older-High = Open High); state-breakdown bars; module insights.
- [ ] **Effort**: section counts sum to `epics_discovered` (S0+S1+S2+S3); Grand Total = pending+mixed; sort works.
- [ ] Zero console errors; check mobile (375px) + light theme.

## 7. What's already been verified (so you can trust it)
- All 5 views **browser-verified locally** (desktop + mobile), including the interactions that broke last time (sort, drill-down, filter).
- **Data layer live-verified vs YouTrack** — bug counts tracked the real morning report; §1+§2 High reconcile; schedule fixed an excluded-epic (PXB1-3295) leak.
- **140 vitest tests pass**, `npm run build` succeeds, `npx tsc --noEmit` clean.
- Every build step went through an independent implementer + reviewer pass.

## 8. Gotchas / things to know
- **YouTrack landmines live in the Python layer** (`scripts/reports/parse.py`), not the dashboard: `TaskType: BUG` (never `Type`), State/Assignee from custom fields, bare-number date fields, the `PXB1-3295` exclusion, the `-7d` query quirk. Documented in `dashboard/CLAUDE.md` + `docs/reports-dashboard/reference/specs/`.
- The app reads the **public Release** — no YouTrack token in the browser or on Vercel. `ACCESS_CODE` is the only gate.
- `dashboard/data/latest.json` is **gitignored** (local dev only); production reads the Release. That's why Step 1 must run before the site is useful.
- The branch is **not merged to master** (intentional, preview-first). Merge at final cutover.
- Minor known items (non-blocking): `Examples_1`'s date fixture is stamped 2025 (stale doc; code uses correct IST math); `MAN_DAY_MINUTES` is a hardcoded constant in `lib/types.ts` rather than read from `config.man_day_minutes`.

## 9. Next steps / future enhancements (priority order)
1. **Deploy + verify** (§5–6) — the immediate task.
2. **"Refresh now" button** — on-demand snapshot regen from the app (a serverless route that triggers the `Snapshot` workflow via the GitHub API, plus a "generating…" state). This is the spec's D1 decision and the highest-value follow-up; today data refreshes nightly + on manual `gh` dispatch.
3. **Final cutover** — once trusted, move a custom domain to the new project (or flip the old project's Root Directory to `dashboard`), then merge `feat/reports-dashboard` → `master`.
4. **Bug-specific filters** on Bug Analysis (the global filter bar is story-centric, so that view intentionally has none yet).
5. **AI assistant over the data** — the "later" goal; the structured snapshot makes NL Q&A feasible.
6. **Midday snapshot schedule** if nightly isn't fresh enough (add a second cron to `.github/workflows/snapshot.yml`).

## 10. Key commands
```bash
# dev server (from repo root)
cd dashboard && npm install && npm run dev        # http://localhost:3000, ACCESS_CODE=admin locally

# tests / typecheck / build
cd dashboard && npm test && npx tsc --noEmit && npm run build

# regenerate local snapshot data (needs $YT_TOKEN)
set -a; . ~/.positrack-yt.env; set +a
python3 scripts/snapshot.py --project PXB1 --scope "PHASE 1"
cp web/data/latest.json dashboard/data/latest.json   # feed the dev app
```
