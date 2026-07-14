# PRD — PXB1 Phase 1 Effort Report (v16)

**Version:** 1.0 (documents report v16) · **Date:** 2026-07-09 · **Owner:** Mohamed Suhail (suhail@posibolt.com)
**Report family:** PXB1 Phase 1 daily reports · **Current schedule:** Daily, 9:20 AM IST

---

## 1. Purpose

The **comprehensive effort tracker** for PXB1 Phase 1: remaining Dev/UI/QA effort per epic, spent time, epics completed since the baseline, epics deferred to Phase 2 (P2 backlog), and a watch list of Phase 1 epics contaminated with Phase 2 stories. Ends with a **Grand Total of remaining open work**.

Distinct from: Epic Status Report (simpler), Release Schedule Tracker (milestones/deadlines), Weekly Deadline View (stories by week).

Output is a **fully self-contained HTML file**, sortable by any column.

## 2. Key Constants

| Constant | Value |
|---|---|
| API base | `https://support.posibolt.com/api/` |
| Baseline cutoff | `2026-06-29T10:30:00Z` = 29 Jun 2026 4:00 PM IST |
| Excluded epic | `PXB1-3295` (POS Android) — always skip |
| 1 man-day | 480 min = 8 h |
| Done states | `done, fixed, verified, closed, won't fix, duplicate, obsolete` (case-insensitive substring) |
| Phase 1 test | a story is P1 unless its `Scope` contains "PHASE 2" (`isP1(s) = !scope || !scope.includes('PHASE 2')`) |

## 3. Data Source & API Contract

Auth: `Authorization: Bearer <token>` + `Accept: application/json`. On this instance the top-level `assignee` and `state` are unreliable — **always read State and Assignee from customFields**.

### Fetch A — Discover epic IDs (two queries, merged, de-duplicated, exclude PXB1-3295)

- `project: PXB1 TaskType: EPIC Scope: {PHASE 1} #Unresolved`
- `project: PXB1 TaskType: EPIC Scope: {PHASE 1} resolved date: 2026-06-29 .. today`
- Fields: `id,idReadable,summary`, `$top=500`

### Fetch B — Full epic data (one request per epic, ~72 epics, 60–90 s)

`GET /issues/{internalId}?fields={epicFields}` where:

- storyFields = `id,idReadable,summary,state(name),resolved,created,customFields(name,value(name,minutes))`
- epicFields = same + `links(direction,linkType(name),issues({storyFields}))`

Stories are the epic's **`Subtask` OUTWARD** linked issues.

### Fetch C — P2 backlog detection

1. Candidates: `project: PXB1 TaskType: EPIC Scope: {PHASE 2} #Unresolved`
2. For each candidate, fetch activities: `GET /issues/{id}/activities?categories=CustomFieldCategory&fields=timestamp,added(name),removed(name),field(name)`
3. An epic is **P2 backlog** if it has a `Scope` change **after the cutoff** where removed contains "PHASE 1" and added contains "PHASE 2".
4. For each backlog epic, fetch full epic + stories (as Fetch B) for display.

### Custom field mapping

| Meaning | Custom field | Notes |
|---|---|---|
| Dev estimate | `Server Estimation` | minutes |
| UI estimate | `UI Estimation` | minutes |
| QA estimate | `Testing Estimation` | minutes |
| Spent | `Spent time` | minutes |
| State | `State` | enum |
| Assignee | `Assignee` | top-level is always null |
| Scope | `Scope` | PHASE 1 / PHASE 2 |

### Token-expiry symptom

If fetches start returning internal issue IDs like `2-XXXXX` instead of `PXB1-XXXX`, the token has expired — refresh the session/token and re-run the affected fetches.

## 4. Categorization Rules

Per epic (after excluding P2-backlog epics from S1–S3):

| Category | Rule |
|---|---|
| **DONE (S0)** | epic State is a done state (epics resolved after 29 Jun 4PM IST per Fetch A query 2) |
| **PENDING (S1)** | has stories, none done |
| **MIXED (S2)** | has stories, some done and some pending |
| **NO_STORIES (S3)** | zero stories |

### Effort rollups

- `rollupP1` (epic remaining effort) = sum of estimates over **pending Phase 1 stories**; if a component sums to 0, fall back to the epic's own estimate field for that component.
- `rollupAll` = sum over all stories (used for S0 display).
- Story spent time is captured per story (`Spent time`); epic spent from the epic's own `Spent time` field.
- **Missing-estimate flag (S1):** `(Dev==0 AND UI==0) OR QA==0` → row flagged orange with ⚠.

### Grand Total (open work)

- S1 totals: sum `rollupP1` over PENDING epics.
- S2 totals: sum estimates over pending **P1** stories of MIXED epics.
- `Grand Dev = S1.dev + S2.dev` (same for UI, QA); `Grand Total = Dev + UI + QA`, shown in hours and man-days.

### Watch List (S5)

Epics from S1/S2 that contain **any Phase 2 story**. For each: P1-pending count, P2 story count, source badge (S1/S2), and action status — **"✓ Ready to move to P2"** when P1 pending = 0, else "N P1 remaining".

## 5. Report Specification

**Filename:** `PXB1_Phase1_EffortReport_v16_YYYY-MM-DD.html`
**Header:** `PXB1 Phase 1 — Effort Report` + timestamp (IST) + `{total} epics | Done: resolved after 29 Jun 4PM IST | P2 Backlog: moved after 29 Jun 4PM IST | Man-day=8h`
**Info bars:** scope note; purple warning bar when P1 epics contain P2 stories (with ready-to-move count); orange bar with missing-estimate count.

### KPI cards

`Done (since Jun 29) · Pending · Dev · UI · QA · Pending Total (red) · Mixed (P1) · No Stories · P2 Backlog (purple) · Has P2 Stories (violet, conditional) · Grand Total`

### Sections (all collapsible; all tables column-sortable)

| # | Title | Rows | Columns |
|---|---|---|---|
| S0 | ✓ Completed since 29 Jun | DONE epics; expandable story sub-rows | Epic, Summary (+resolved date), Dev, UI, QA, Total, Spent |
| S1 | 📋 Has Stories · All Pending | PENDING epics, sorted by total estimate **desc**; expandable P1 story sub-rows; P2-story badge; missing-estimate highlight | Epic, Summary, Assignee, Created, Dev, UI, QA, Total, Spent, Est. status (⚠/✓) |
| S2 | ⚡ Mixed (Some Done) | MIXED epics ("N done / M pending" note); expandable pending-P1 sub-rows | Epic, Summary, Assignee, Created, Dev, UI, QA, Total, Spent |
| S3 | 🚫 No Stories | NO_STORIES epics | Epic, Summary, Assignee, Created |
| S4 | 📁 P2 Backlog (moved after Jun 29) | Backlog epics with "→ P2 on {date}" note; expandable **open** story sub-rows only | Epic, Summary, Assignee, Created |
| S5 | 👀 Watch List: P1 Epics with P2 Stories | Watch-list epics; expandable P1-pending and P2-story sub-rows | Epic, Summary, Assignee, P1 Pending, P2 Stories, Action |

Every section ends with a TOTAL row. Report ends with the **Grand Total bar**: `Grand Total (open work) — Dev: Xh | UI: Xh | QA: Xh | Total: Xh / X.Xmd`.

### Styling

Light theme: page `#f5f6fa`, header `#1a3a5c`, table headers `#2c5282`, Total column highlighted `#d6eaf8`, Spent column `#fce4d6`; section headers `#1a3a5c` (S4 purple `#5b4a8a`, S5 violet `#6a1b9a`); done rows `#f0fff4`; grand bar `#154360`. Estimates shown as `X.Xh` with `X.Xd` (man-days) sub-label; all issue IDs link to `https://support.posibolt.com/issue/{id}`.

## 6. Acceptance Criteria

1. Epic count = S0+S1+S2+S3+S4 (each epic in exactly one section; P2-backlog epics excluded from S1–S3).
2. Grand Total equals S1 total + S2 pending-P1 total, in both hours and man-days.
3. P2 backlog contains only epics whose Scope changed P1→P2 **after** 29 Jun 4PM IST (verified via activity log, not current value alone).
4. Watch List "Ready to move" appears iff P1 pending = 0.
5. Missing-estimate flags follow `(Dev==0 AND UI==0) OR QA==0` on rollupP1.
6. All columns sortable; expand/collapse works; file self-contained.

## 7. Maintenance Notes

- The 29 Jun baseline cutoff is a constant; make configurable for future baselines.
- Fetch B is N+1 (one call per epic) — a server implementation may parallelize but should respect YouTrack rate limits (current run time 60–90 s for ~72 epics).
- P2 detection requires the **activities API**; a permanent token needs read access to issue history.
