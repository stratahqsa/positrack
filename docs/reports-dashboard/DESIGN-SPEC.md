# PXB1 Reports Dashboard — Rebuild Design Spec

**Status:** Draft for review · **Date:** 2026-07-14 · **Owner:** Mohamed (groworx) · **PM / report author:** Suhail
**Supersedes:** the current `web/` POSX Control Tower (buggy filters, HTML-clone approach)
**Source of truth for report content:** `PM_repors/Suhail Reports and Specs/` (4× PRD + 4× plain-English requirements + 4× implementation guide + example HTML)

---

## 1. Problem & Goals

Every morning Suhail's Claude account generates **4 self-contained HTML reports** from YouTrack (`support.posibolt.com`, project **PXB1**, **Phase 1**) via scheduled tasks, and drops the files into the **PosiboltX Admin Team** WhatsApp group. This is painful:

- Multiple static files, every day, per person — no shared, current view.
- Regeneration is manual/scheduled; when someone updates a ticket, the report is stale until the next run.
- No interactivity: the team can't filter, drill in, or answer their own questions.

**The four jobs to be done (ranked by the owner):**

1. **★ Is the project on track?** — the single most important question, and the one no current report answers at a glance.
2. **Keep people accountable** — make ownership, overdue work, and re-opened items visible per person.
3. **Replace the daily WhatsApp file dumps** with **one live link** the whole team opens and filters freely.
4. **Regenerate on demand** when tickets change, without Suhail re-running anything by hand.

**Explicit future (not v1):** an AI assistant to ask natural-language questions over the same data.

### Why the last attempt felt buggy

The previous build tried to **clone the report HTML** (rows that wouldn't expand, filters that didn't work, wrong values, high token cost). The reports were never modeled as *data* — only as markup. This rebuild inverts that: **model the data and the jobs first; render faithfully second.**

---

## 2. Non-Goals (v1)

- **AI assistant / natural-language Q&A** — designed *around* (structured data + a clean read path make it easy later) but **not built** in v1.
- **Projects beyond PXB1 / phases beyond Phase 1** — the architecture is **config-driven** so Phase 2 or another project is a settings change, but v1 ships PXB1 Phase 1 only.
- **Per-user accounts / audit of who-viewed** — v1 uses a shared access code (§9).
- **Write-back to YouTrack** — the dashboard is read-only; ticket edits happen in YouTrack.
- **True instant/live recompute of the heavy Effort sweep** — see the freshness model (§7).

---

## 3. Locked Decisions (from the deep interview)

| # | Decision | Choice | Consequence |
|---|---|---|---|
| D1 | Data freshness | **On-demand + scheduled** | Precomputed snapshot for fast loads + a "Refresh now" button that regenerates with a progress indicator; plus a morning/midday schedule. |
| D2 | v1 scope | **All 4 reports on one shared Phase-1 data layer** | Build the data layer once; the views are incremental. Fully retires the WhatsApp dumps. |
| D3 | Faithfulness | **Faithful views + a new "Project Health" overview** | Keep each report recognizable; add a top-level view that answers "on track?" directly. |
| D4 | Configurability | **Baselines / project / scope / week-anchor in config** | Phase 2 & new meeting baselines = edit config, not code. Every PRD asks for this. |
| D5 | Access | **Shared access code** (reuse existing gate) | Link + code shared in WhatsApp; no per-user management. |
| D6 | Build/verify order | **Health → Weekly Deadline → Release Schedule → Bug Analysis → Effort** | All 4 ship in v1; this is the order we perfect & verify them. |
| D7 | "Accountability" means | **Per-person filter + unowned/overdue/re-opened surfacing** | Data already exists (assignee, deadlines, states); expose it, don't invent it. |
| D8 | On-demand infra | **Reuse GitHub Actions `workflow_dispatch`** | No new servers; the button triggers the existing regeneration path. |
| D9 | Deployment cutover | **New sibling folder → own Vercel preview → flip root directory** | Old dashboard stays live until the new one is verified. |

---

## 4. Architecture

```
                        YouTrack (support.posibolt.com, PXB1 / PHASE 1)
                                          │  read-only service token
                                          ▼
                    ┌─────────────────────────────────────────────┐
                    │  Shared Phase-1 Data Layer (build once)      │
                    │  core engine → one composed snapshot JSON    │
                    │  epics · stories · bugs · deadlines ·        │
                    │  estimates · states · assignees · drilldowns │
                    └─────────────────────────────────────────────┘
                        │ nightly + midday schedule │ "Refresh now" (workflow_dispatch)
                        ▼                            ▼
                    ┌─────────────────────────────────────────────┐
                    │  Snapshot store (GitHub Release asset)       │
                    │  latest.json + dated history + index.json    │
                    └─────────────────────────────────────────────┘
                                          │ server-side read (force-dynamic)
                                          ▼
                    ┌─────────────────────────────────────────────┐
                    │  Next.js app (new folder) · shared access    │
                    │  Global filter bar (client)                  │
                    │  ├─ Project Health (overview / "on track?")  │
                    │  ├─ Bug Analysis                             │
                    │  ├─ Release Schedule Tracker                 │
                    │  ├─ Effort Report v16                        │
                    │  └─ Weekly Deadline View                     │
                    │  "Refresh now" → triggers regeneration       │
                    └─────────────────────────────────────────────┘
```

**Principle:** the compute (slow, ~4–5 min for the full effort sweep) is decoupled from the request (must be instant). Views read a precomputed snapshot; the button re-runs the compute out of band. This reuses the exact pattern the repo already runs nightly — proven plumbing, extended to cover all 4 reports and a manual trigger.

### What we reuse vs. build

| Reuse (already in repo) | Build new |
|---|---|
| `core/ytcore.py` engine — incl. `effort_report` (the Effort report ≈ half-built) | **Bug data**: `TaskType: BUG` queries by priority/module + submodule extraction |
| `scripts/snapshot.py` compose+publish pattern | **Deadline capture**: `Deadline Date` + `QA Deadline` fields into the model |
| `.github/workflows/snapshot.yml` `workflow_dispatch` trigger | **Bug drill-down**: RE-OPEN story → dev ticket → `Bugs Reported` → open bugs |
| GitHub Release `snapshot-latest` as the store | **Project Health** overview (the "on track?" view) |
| `web/` auth: `ACCESS_CODE`, `middleware.ts`, `app/login`, `app/api/login` | **Global filter model** across all views |
| Read path: `web/lib/data.ts`, `force-dynamic` pages | **"Refresh now"** button → `workflow_dispatch` + progress state |
| YouTrack service-account token (`YT_TOKEN` secret) | **Config layer** for baselines/project/scope/week-anchor |

---

## 5. The Shared Data Model

All four reports draw from the same PXB1 Phase-1 fetch. Model it once, correctly, honoring the instance's quirks (§11).

**Core entities**

- **Epic** — id, summary, created, resolved, assignee (custom field), state (custom field), scope, per-component estimates (Server/UI/Testing) + own-estimate fallback, spent, derived category (done/pending/mixed/no-stories/p2-backlog), milestone (max dev/QA deadline across stories), `isNew` (created after meeting baseline).
- **Story** — id, summary, state (custom field), assignee (custom field), scope (P1 unless "PHASE 2"), Server/UI/Testing Estimation (min), Spent time (min), **Deadline Date** (dev deadline), **QA Deadline**, Sprints (max by numeric suffix), resolved, parent epic (via 2-pass `Subtask` INWARD matching), done? (state ∈ done-list).
- **Bug** — id, summary, created, state, **priority** (High/Med/Low), **module** + extracted **submodule**, assignee, reporter. Two roles: (a) standalone for Bug Analysis; (b) drill-down under RE-OPEN stories.
- **Person** — assignee/reporter identity for the per-person filter and accountability rollups.
- **Sprint / Module / Week-slot** — grouping dimensions.

**Derived structures (per report), all computed in the data layer, not the browser:**

- **Effort buckets** (S0 done / S1 pending / S2 mixed / S3 no-stories / S4 P2-backlog / S5 watch-list) + Grand Total = S1 + S2 pending-P1.
- **Milestone groups** (epics grouped by max deadline, ≥ meeting cutoff, urgency-colored).
- **Week slots** (Tue→Mon; Week 1 = 30 Jun–6 Jul; stories bucketed by dev deadline; ≤ current week).
- **Bug rollups** (new-in-window by priority; open High before window; Med/Low by state; module/submodule 7-day insights).
- **Health metrics** (see §6.1).

> **Key correctness invariants** (carried from the PRD acceptance criteria): every epic lands in exactly one effort section; open High bugs appear once across "new" + "older"; Grand Total = S1 + S2 pending only; state-breakdown percentages ≈ 100%; PXB1-3295 never appears; every RE-OPEN story expands to its open bugs.

---

## 6. The Five Views

Global filter bar on every view (§8). Each report stays faithful to its PRD's content, columns, colors, and interactions (collapsible sections, sortable columns, drill-downs).

### 6.1 Project Health (new — the "on track?" view) ★

The landing view. Answers the #1 question in one screen, from the shared data:

- **On-track verdict banner** — are milestones being hit? (on-time vs late milestones, nearest deadline, days of slippage).
- **Remaining effort** — Grand Total open work (hours / man-days) from the Effort model, trend vs. previous snapshot.
- **This week's deadlines** — count due this release week, pending vs done, late count (from the Weekly Deadline model).
- **Bug pressure** — open High bugs, new High/Med since yesterday, hottest module (from the Bug model).
- **Accountability strip (D7)** — per-person: owned open items, overdue, re-opened, unowned/needs-owner count. Clickable → filters the detailed views to that person.

Every tile links/drills into the report that backs it. No new data — pure composition of the shared model.

### 6.2 Bug Analysis — faithful (PRD 1)

KPI bar (new High/Med in window, open High/Med/Low, total open, modules hit 7d) → **§1** new bugs in window by priority → **§2** older open High → **§3** Med/Low by workflow state (two panels) → **§4** module/submodule insights (7d). Collapsible sections; state badges; IST timestamps; submodule dash-rule extraction. `TaskType: BUG` only; explicit 7-day date (no `-7d`).

### 6.3 Release Schedule Tracker — faithful (PRD 2)

Epics grouped by **release milestone** (max dev/QA deadline), only ≥ meeting cutoff; DONE/NOT-DONE badges vs baseline; early/late resolved dates (green/red); expandable stories (visibility rules per epic state); **RE-OPEN → open bugs** drill-down; urgency-colored milestone headers; NEW badges; remaining-effort totals from pending stories only.

### 6.4 Effort Report v16 — faithful (PRD 3, engine ≈ half-built)

Six collapsible, column-sortable sections: S0 completed-since-baseline · S1 all-pending (sorted desc, missing-estimate ⚠, P2-story badge) · S2 mixed (pending-P1 only) · S3 no-stories · S4 P2-backlog (verified via **activity history**, not current scope) · S5 watch-list (P1 epics with P2 stories, "ready to move" when P1-pending = 0). Ends in **Grand Total** (hours + man-days).

### 6.5 Weekly Deadline View — faithful (PRD 4)

Stories bucketed into **release weeks** (Tue→Mon, anchor Week 1 = 30 Jun–6 Jul), one section per week up to the current week; 4-test inclusion filter (P1 · both deadlines · ≥1 estimate · pending-or-done-after-Jun29); 13 sortable columns; resolved-vs-QA-deadline verdict badges (early/late); **RE-OPEN → open bugs** drill-down; sorting keeps bug rows attached to their story; per-week + footer totals.

---

## 7. Freshness & Refresh (D1, D8)

- **Fast reports** (bugs, deadlines, milestones — cheap YouTrack queries) refresh quickly.
- **Heavy report** (Effort's full per-epic sweep, ~4–5 min) runs out of band.
- **Snapshot store** serves instant page loads (`force-dynamic` read of the latest release asset — the pattern already in `web/lib/data.ts`).
- **Scheduled**: nightly (existing) + at least one mid-day run.
- **"Refresh now" button**: triggers the existing GitHub Actions `workflow_dispatch`; the UI shows a "generating… (~5 min for full effort)" state and swaps in the new snapshot when the release asset updates. Directly delivers "regenerate on request when tickets change" **without** new infrastructure.

---

## 8. Global Filter Model

One filter bar drives every view. Filter dimensions from the shared model: **assignee/person, module, priority, state, epic, sprint, release week**, plus quick toggles (pending-only, overdue-only, re-opened-only, has-P2-stories). Filtering is client-side over the precomputed snapshot (instant). Clicking any entity (a person on Health, a module on Bug Analysis) sets the corresponding filter across views. This is the "go crazy with filters" capability the static HTML never had.

---

## 9. Access (D5)

Reuse the existing gate: `ACCESS_CODE` env + `middleware.ts` + `app/login` + `app/api/login`. One shared code for the team; link + code live in the WhatsApp group. No per-user accounts in v1. (The route is preserved so per-user auth could be added later without re-architecting.)

---

## 10. Vibe-Code-ability (D2 owner requirement)

**The owner will not maintain this.** Suhail (repo access) must be able to prompt Claude Code to change or add views safely. The build must therefore optimize for AI-assisted change:

- **`CLAUDE.md` at the app root** covering: architecture & data flow (this spec in brief), the **YouTrack custom-field gotchas** (§11) called out loudly, the config layer, **"How to add a new report"** (a step-by-step recipe), **"How to change a baseline date,"** and the test/verify loop.
- **Legible, small, single-purpose files** — one file per view; the shared data model in a clearly-named module; no clever indirection an LLM (or human) has to reverse-engineer. When a file grows too large, split it.
- **A "report" template / scaffold** — adding the 5th report should mean copying a pattern, not discovering one.
- **Regression tests** on the data layer (the invariants in §5) and on each view's key logic, so a vibe-coded change that breaks another report fails loudly. This is what turns "prompt your way through" from risky into safe.
- **Config over constants** (§ D4) so the most common change (re-baseline for Phase 2 / a new meeting) needs no code reading at all.

---

## 11. Data Source & YouTrack Gotchas (must be honored)

These are the traps that silently corrupt reports. They belong in `CLAUDE.md` and in test fixtures.

- **`TaskType: BUG`, never `Type: Bug`** — PXB1 marks type in the custom `TaskType` field; the standard `Type` field undercounts silently.
- **State & Assignee live in custom fields** — the top-level `state`/`assignee` are null/unreliable on this instance. Always read `customFields[name='State'|'Assignee']`.
- **Estimates in custom fields (minutes)**: `Server Estimation` (dev), `UI Estimation`, `Testing Estimation` (QA); `Spent time`. Man-day = 480 min = 8 h.
- **Deadlines**: `Deadline Date` (dev), `QA Deadline` — epoch ms date custom fields.
- **Scope**: `Scope` = `{PHASE 1}` / `{PHASE 2}`; a story is P1 unless scope contains "PHASE 2".
- **Story→Epic matching (2-pass)**: link type is `Subtask` (INWARD = parent); pass 1 direct-to-epic, pass 2 transitive (story→story→epic). Unmatched = orphans (diagnostic only).
- **Bug drill-down path**: RE-OPEN story → `Subtask` OUTWARD dev tickets → `Bugs Reported` OUTWARD → keep only open bugs.
- **`-7d` returns HTTP 400** on this instance — compute the explicit `YYYY-MM-DD` date.
- **Token-expiry symptom**: fetches start returning internal IDs (`2-48123`) instead of readable (`PXB1-4567`) — refresh token, retry.
- **Timezone**: all display in **IST**; window math uses IST day boundaries.
- **Baseline constants** (currently hardcoded → move to config): `MTG_CUTOFF = 2026-07-03T10:30:00Z`, `JUN29_CUTOFF = 2026-06-29T10:30:00Z`, Week-1 anchor `2026-06-30`, excluded epic `PXB1-3295`, done-states = `done, fixed, verified, closed, won't fix, duplicate, obsolete`.

---

## 12. Testing & Verification

- **Data-layer unit tests** on the §5 invariants (sectioning, no double-count, Grand Total identity, PXB1-3295 exclusion, submodule dash-rule, week bucketing, drill-down).
- **Fixture-based tests** using captured YouTrack responses so tests run without the live instance and pin the custom-field gotchas.
- **Per-view logic tests** (sorting keeps drill-down rows attached; badges match state lists; percentages ≈ 100%).
- **Cross-check against the example HTML** (`PM_repors/`) and against a manual YouTrack search for the same window, per each PRD's acceptance criteria.
- **Browser verification** (the preview flow) that expand/collapse, sort, filter, and drill-down actually work — the exact things that were broken last time.

---

## 13. Cutover & Deployment (D9)

1. Build in a **new sibling folder** (e.g. `dashboard/`), leaving `web/` live and untouched.
2. Point a **second Vercel project** at the new folder → its own preview URL; carry over env vars (`ACCESS_CODE`, `YT_TOKEN`/`SNAPSHOT_DATA_URL`).
3. Verify all 5 views on the preview URL against the acceptance criteria.
4. **Flip**: either move the domain to the new project, or change the original project's **Root Directory** from `web` to the new folder and redeploy. Instant rollback = flip back.
5. Retire the old `web/` app once the new one is trusted.

---

## 14. Build & Verify Sequence (D6)

Shared data layer first, then light up and **verify each view before starting the next**:

0. **Data layer + snapshot + refresh trigger + config + auth + filter shell** (the foundation).
1. **Project Health** ★ — the on-track verdict.
2. **Weekly Deadline View**.
3. **Release Schedule Tracker**.
4. **Bug Analysis**.
5. **Effort Report v16** (adapt the existing engine).
6. **CLAUDE.md + tests + "add a report" recipe**, then cutover.

---

## 15. Open Items to Resolve During Planning

Not blockers for this spec — to nail down while writing the implementation plan:

- Read the 4 **Implementation Guides** (`Examples_*.md`) for exact query sequences & edge cases before coding the data layer.
- Open the **example HTML** in the browser to capture exact visual fidelity and the interaction model (and to see the "rows won't expand" failure first-hand).
- Confirm the **mid-day schedule time(s)** and whether the "Refresh now" button should be gated (anyone vs. code-holder).
- Decide the **stack** for the new folder (default: Next.js 15 / React 19 to match the existing app and reuse auth + read path) and whether the data layer stays **Python** (`snapshot.py` pattern) or moves to TypeScript.

---

## 16. Ontology (key entities)

| Entity | Type | Key fields | Relationships |
|---|---|---|---|
| Epic | core domain | id, state, assignee, estimates, milestone, category | has many Story; grouped into Milestone |
| Story | core domain | id, state, assignee, estimates, dev/QA deadline, sprint, resolved | belongs to Epic; bucketed into Week-slot; may have Bugs |
| Bug | core domain | id, priority, state, module, submodule, reporter | standalone (Bug Analysis) or under RE-OPEN Story |
| Milestone | derived | date, urgency, epics, done/pending | groups Epics (Release Schedule) |
| Week-slot | derived | index, start/end, stories | groups Stories (Weekly Deadline) |
| Person | supporting | name/login | assignee/reporter; accountability rollups |
| Snapshot | artifact | meta, effort, bugs, deadlines, health | the precomputed shared model |
| Health | derived | on-track verdict, effort, deadlines, bug pressure, accountability | composition of all of the above |

---

## Appendix — Interview summary

Deep interview, 4 rounds, final ambiguity ≈ 15% (below the 20% gate). Decisions D1–D9 (§3). Ground truth: 4× PRD + 4× plain-English requirements + 4× implementation guide + example HTML in `PM_repors/`. Brownfield context: existing `positrack` engine, snapshot pipeline, and `web/` Control Tower fully mapped.
