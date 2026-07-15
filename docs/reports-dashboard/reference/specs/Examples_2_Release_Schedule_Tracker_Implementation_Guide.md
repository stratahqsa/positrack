# PXB1 Release Schedule Tracker — Example-Driven Implementation Guide

**Companion to:** PRD_2_Phase1_Release_Schedule_Tracker.md and Requirements_2 (plain English) · **Date:** 2026-07-09

Concrete requests, production-shaped sample JSON, worked rule evaluations, milestone math, acceptance tests, edge cases.

---

## 1. Pipeline at a Glance

```
[1] Auth → [2] Fetch epics (2 queries, merge) → [3] Fetch stories (paginated) + parse + 2-pass match
        → [3.5] Bug drill-down (RE-OPEN)      → [4] Milestone grouping + HTML build
```

Constants used throughout the examples:

```
MTG_CUTOFF   = 2026-07-03T10:30:00Z  (Jul 3, 4:00 PM IST — "the meeting")
JUN29_CUTOFF = 2026-06-29T10:30:00Z  (Jun 29, 4:00 PM IST)
EXCLUDE      = PXB1-3295 · MAN-DAY = 480 min
DONE_STATES  = done, fixed, verified, closed, won't fix, duplicate, obsolete (substring, case-insensitive)
```

Auth, story fetching/parsing, and the two-pass story→epic matching are identical to the Weekly Deadline View guide §§2–5 (same scripts). Below focuses on what is unique to this report.

---

## 2. Epic Fetch — Merge & De-duplicate Example

Two queries:

```
Q-A  project: PXB1 TaskType: Epic #Unresolved Scope: {PHASE 1}                       ($top=500)
Q-B  project: PXB1 TaskType: Epic resolved date: 2026-06-01 .. Today Scope: {PHASE 1} ($top=200)
```

**Example:** Q-A returns 52 epics; Q-B returns 9 (resolved since 1 Jun). One epic `PXB1-3120` was resolved *today* and — due to indexing timing — appears in both. Merge keyed by internal `id`:

```
merged = 52 + 9 − 1 duplicate − PXB1-3295(if present) = 59 epics
```

---

## 3. Epic State Badge — All Four Cases Worked

| Epic | Stories & states | Badge shown |
|---|---|---|
| PXB1-3101 | 4 stories: 2 Fixed, 2 OPEN | ✗ **NOT DONE** (red) — any pending |
| PXB1-3120 | 3 stories: all Verified | ✓ **DONE** (green) |
| PXB1-3140 | exactly 1 story, state TESTING | **TESTING** — single-story epics show the story's real state (more informative than NOT DONE) |
| PXB1-3155 | 0 stories | **NO STORIES** |
| PXB1-3160 | 2 OPEN stories, but epic itself resolved 5 Jul (> MTG_CUTOFF) | ✓ **DONE** — epic's own resolution overrides |

---

## 4. Story Visibility — Worked Example

Epic PXB1-3101 (NOT DONE) has:

| Story | State | Resolved | Visible under expand? |
|---|---|---|---|
| PXB1-3412 | RE-OPEN | — | ✅ pending |
| PXB1-3415 | OPEN | — | ✅ pending |
| PXB1-3390 | Fixed | 5 Jul (> Jul 3 mtg) | ✅ done since meeting — shows progress |
| PXB1-3388 | Fixed | 1 Jul (< Jul 3) | ❌ hidden (done before meeting) |

Epic PXB1-3120 (DONE) has stories resolved 30 Jun, 2 Jul, 27 Jun → visible: 30 Jun and 2 Jul (> Jun 29 cutoff); the 27 Jun one is hidden.

**Rollup rule illustrated:** PXB1-3101's Dev/UI/QA/Spent totals = sum over its **pending** stories (3412 + 3415 only). PXB1-3120's totals = sum over its **visible** stories. This is why a NOT DONE epic's totals answer "what's left", not "how big".

---

## 5. Milestone Grouping — Worked Math

Milestone per epic = `max(dev deadline, QA deadline)` across ALL its stories; fallback = epic's own resolved date.

### Example (run date Thu 9 Jul 2026)

| Epic | Story deadlines (dd, qa) | releaseTs | daysFromNow | Milestone group |
|---|---|---|---|---|
| PXB1-3101 | (08 Jul, 14 Jul), (10 Jul, 13 Jul) | 14 Jul | +5 | **14 Jul** — header `#c2410c` (≤7d) |
| PXB1-3140 | (06 Jul, 07 Jul) | 07 Jul | −2 | **07 Jul** — header `#7f1d1d` (overdue) |
| PXB1-3120 | all done, max deadline 06 Jul | 06 Jul | −3 | **06 Jul** — but all-done → header turns green `#166534` |
| PXB1-3155 | no stories, not resolved | 0 → no date | — | sorted to the end |

Urgency palette: `≤0d #7f1d1d · ≤3d #b91c1c · ≤7d #c2410c · ≤14d #b45309 · >14d #15803d · all-done #166534`.

**Milestone display cutoff:** only milestones **from 2026-07-03 onward** are rendered (earlier ones existed before the meeting baseline).

**Milestone header content example:**

```
📅 14 Jul 2026 · in 5 days     2 epics · 5 stories (3 pending / 2 done)
totals row: Dev 40.0h · UI 8.0h · QA 16.0h · Spent 31.5h
```

All-done milestone: `📅 06 Jul 2026 ✓ 1 epic · 3 stories` (green).

---

## 6. Epic-Level Resolved Date — Early/Late Examples

Shown only when badge = DONE; value = max resolved across stories; compared against the epic's milestone:

| Epic | Max story resolved | Milestone | Render |
|---|---|---|---|
| PXB1-3120 | 02 Jul | 06 Jul | **02 Jul** green (early) |
| PXB1-3122 | 08 Jul | 06 Jul | **08 Jul** red (late) |

---

## 7. NEW Badges — Example

`isNew = created > MTG_CUTOFF`. Epic created 5 Jul → purple **NEW** badge on the epic row; story created 4 Jul under an old epic → NEW badge on the story row only. The meeting reads these as "added since we last met".

---

## 8. Bug Drill-Down

Identical mechanics and JSON shapes to Weekly Deadline View guide §8 (story → OUTWARD Subtask dev tickets → "Bugs Reported" OUTWARD → open bugs; de-dupe bug IDs; drop done bugs). In this report the 🐛 expansion renders as **third-level rows** under the story (epic → story → bug), showing state, assignee, priority pill, and dev ticket link.

Sanity example: 7 RE-OPEN stories → 7 story fetches → 11 unique bug IDs → 11 bug fetches → 6 open bugs kept, mapped to 4 stories; the other 3 RE-OPEN stories show an empty drill-down (bugs already fixed — legitimate).

---

## 9. Grand Totals & Final Banner — Worked Numbers

`gDev/gUI/gQA/gSpent` = sums over **pending stories of all epics**. Example: 41 pending stories → Dev 296h, UI 88h, QA 124h, Spent 208.5h → banner shows hours + man-days (`296h / 37.0md`). `finalTs` = latest releaseTs across epics → "Final release: 28 Jul 2026" on the gradient banner (`linear-gradient(135deg,#1e3a8a,#4c1d95)`).

---

## 10. Report Table — Column Example Row

```
Epic / Story | Summary | State | Assignee | Dev Est | UI Est | QA Est | Spent | Dev Deadline | QA Deadline | Resolved | Sprint

PXB1-3101 ▸ [NEW] | Sales Returns & Refunds | ✗ NOT DONE | Anjali R | 16.0h | 8.0h | 4.0h | 18.5h | — | — | — | Sprint 15
  └ PXB1-3412 🐛 | Return to original tender | RE-OPEN | Fahad K | 16.0h | 8.0h | 4.0h | 18.5h | 08 Jul | 14 Jul | — | Sprint 15
      └ PXB1-3901 | Return - amount rounds wrong | OPEN | Fahad K | (priority pill: High) → dev ticket PXB1-3488
```

Row styling: done epic rows green left border `#22c55e` bg `#f0fff4`; pending epic rows red border `#ef4444` bg `#fff8f8`; sprint badge `#ede9fe/#5b21b6`; page `#f1f5f9`, header/footer `#0f172a`, table heads `#1e293b` (dark theme).

---

## 11. Acceptance Test Cases (Given / When / Then)

| # | Given | When | Then |
|---|---|---|---|
| T1 | Epic in both epic queries | Merge | Appears once (de-dupe by internal id) |
| T2 | PXB1-3295 unresolved Phase 1 | Fetch | Never appears anywhere |
| T3 | Epic, 1 story in TESTING | Badge | Shows "TESTING", not NOT DONE |
| T4 | Epic all stories Fixed | Badge | ✓ DONE green |
| T5 | Epic resolved 5 Jul, has OPEN stories | Badge | ✓ DONE (own resolution overrides) |
| T6 | NOT DONE epic, story done 1 Jul | Expand | Story hidden (done before meeting) |
| T7 | NOT DONE epic, story done 5 Jul | Expand | Story visible |
| T8 | DONE epic, story resolved 27 Jun | Expand | Hidden (≤ Jun 29 cutoff) |
| T9 | Epic milestones (14 Jul, 07 Jul) | Grouping | Sorted ascending; 07 Jul group renders first |
| T10 | Milestone 02 Jul (before display cutoff 03 Jul) | Rendering | Milestone not rendered |
| T11 | Milestone group with all epics done | Header | Green `#166534` regardless of date |
| T12 | Run 9 Jul; milestone 10 Jul | Header color | `#b91c1c` (≤3d) |
| T13 | DONE epic resolved 08 Jul vs milestone 06 Jul | Resolved cell | Red (late) |
| T14 | Story created 4 Jul | Row | Purple NEW badge |
| T15 | RE-OPEN story, all linked bugs fixed | 🐛 expand | Empty drill-down, no error |
| T16 | Pending stories 296h dev total | Banner | `296.0h / 37.0md` grand dev |
| T17 | Story with no epic match | Rendering | Not rendered; orphan count in diagnostics |
| T18 | Epic without story deadlines but resolved | Milestone | Falls back to epic resolved date |
| T19 | Open from disk offline | Rendering | All 3 levels expand/collapse; no network |

---

## 12. Edge Cases & Defensive Rules

- **Baseline drift:** MTG_CUTOFF / JUN29_CUTOFF are meeting-cycle constants — parameterize; a stale cutoff silently mislabels "since meeting" items.
- **Epic assignee fallback:** top-level `assignee.name` first, then custom field `Assignee`, then `—` (stories: custom field only).
- **Epic with stories that all lack deadlines:** releaseTs = 0 → renders in a trailing "no date" group, never crashes daysFromNow (guard null).
- **Same-day early/late:** `resolved > deadline` = late (strict), equal = on-time/green.
- **Sprint rollup:** epic sprint = max across story sprints by numeric suffix (`Sprint 9` < `Sprint 14`); no sprints → `—`.
- **Substring state traps:** "RE-OPEN" contains "open"; test done → re-open → … in that order. "READY FOR DEPLOYEMENT" (sic) is a real pending state.
- **HTML-escape all tracker text**; issue links to `https://support.posibolt.com/issue/{id}`.

---

## 13. Suggested Server Test Fixtures

Fixture one epic set covering T3–T8 (single-story epic, all-done epic, override epic, mixed epic with pre/post-meeting resolutions) plus the §8 bug-trail JSON from the Weekly guide. Assert badge outcomes, visibility lists, rollups, milestone grouping order, and header colors for a frozen "today".
