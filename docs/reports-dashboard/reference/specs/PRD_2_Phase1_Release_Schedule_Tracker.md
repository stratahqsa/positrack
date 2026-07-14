# PRD — PXB1 Phase 1 Release Schedule Tracker (Meeting Tracking Report)

**Version:** 1.0 · **Date:** 2026-07-09 · **Owner:** Mohamed Suhail (suhail@posibolt.com)
**Report family:** PXB1 Phase 1 daily reports · **Current schedule:** Daily, 9:00 AM IST

---

## 1. Purpose

A dark-theme milestone/commitment tracker for **PXB1 Phase 1**. It groups all Phase 1 epics by release milestone (max of dev/QA deadlines), shows which epics and stories are DONE vs NOT DONE relative to the last release-schedule meeting, whether items were resolved early or late, and drills down from RE-OPEN stories to their open bugs. Used to run the recurring release-schedule meeting.

Output is a **fully self-contained HTML file** — no login required to open.

## 2. Key Constants

| Constant | Value |
|---|---|
| YouTrack base | `https://support.posibolt.com` (API at `/api`) |
| Project | `PXB1` |
| Phase 1 filter | `Scope: {PHASE 1}` |
| Excluded epic | `PXB1-3295` (POS Android) — always exclude |
| Meeting cutoff (MTG_CUTOFF) | `2026-07-03T10:30:00Z` = 3 Jul 2026 4:00 PM IST |
| Jun29 cutoff (JUN29_CUTOFF) | `2026-06-29T10:30:00Z` = 29 Jun 2026 4:00 PM IST (done-epic story visibility) |
| Milestone display cutoff | show only milestones from `2026-07-03` onward |
| 1 man-day | 480 minutes = 8 h |
| Done states | `done, fixed, verified, closed, won't fix, duplicate, obsolete` (case-insensitive substring match on State) |

## 3. Data Source & API Contract

- **Auth:** `Authorization: Bearer <token>`. (Current implementation reads the session JWT from localStorage; server implementation should use a permanent token.)
- **State field:** ALWAYS read from `customFields[name='State'].value.name` — the top-level `state` field is always null on this instance.
- **Assignee:** epic-level from top-level `assignee.name` with fallback to custom field `Assignee`; story-level from custom field `Assignee`.

### Fetch 1 — Epics (two queries, merged & de-duplicated, exclude PXB1-3295)

- `project: PXB1 TaskType: Epic #Unresolved Scope: {PHASE 1}` (`$top=500`)
- `project: PXB1 TaskType: Epic resolved date: 2026-06-01 .. Today Scope: {PHASE 1}` (`$top=200`)
- Fields: `id,idReadable,summary,created,resolved,assignee(name),customFields(name,value(name,text,minutes,id))`

### Fetch 2 — Stories (top-level, paginated 200/page)

- Query: `project: PXB1 TaskType: Story Scope: {PHASE 1}`
- Fields: `id,idReadable,summary,created,resolved,customFields(name,value(name,text,minutes,id)),links(direction,linkType(name),issues(id,idReadable))`
- **Must be fetched top-level** (not nested under epics) to get fully resolved customFields.
- Paginate with `$skip` in increments of 200 until a page returns < 200.

### Custom field mapping (stories)

| Field | Custom field name | Type |
|---|---|---|
| devEst | `Server Estimation` | period → minutes |
| uiEst | `UI Estimation` | period → minutes |
| qaEst | `Testing Estimation` | period → minutes |
| spent | `Spent time` | period → minutes |
| ddTs (dev deadline) | `Deadline Date` | DateIssueCustomField → epoch ms |
| qaTs (QA deadline) | `QA Deadline` | DateIssueCustomField → epoch ms |
| sprints | `Sprints` | MultiVersionIssueCustomField → array of names |
| state | `State` | enum |

Max sprint = sort sprint names by numeric suffix, take last.

## 4. Story→Epic Matching (two-pass)

Parent-child link type on this instance is named **`Subtask`** (NOT "parent-subtask"). `direction=INWARD` on a story = the linked issue is its **parent**.

1. **Pass 1 (direct):** story has a Subtask INWARD link pointing at an epic → assign to that epic.
2. **Pass 2 (transitive):** story's parent is another story; if the grandparent is an epic, or the parent story already maps to an epic, inherit that epic.

Stories that match no epic are counted as **orphans** (reported in diagnostics, not shown).

## 5. Business Rules

### Epic state badge

- Exactly 1 story → show that story's actual state text.
- All stories done → `✓ DONE` (green).
- Any pending → `✗ NOT DONE` (red).
- Epic with no stories → `NO STORIES`.
- An epic whose own `resolved` > MTG_CUTOFF is treated as DONE regardless.

### Story visibility under an epic's expand control

| Epic state | Stories shown |
|---|---|
| NOT DONE | Pending stories + stories resolved after MTG_CUTOFF (Jul 3 4PM IST) |
| DONE | Stories with `resolved` > JUN29_CUTOFF (Jun 29 4PM IST) |

### Estimate/Spent/Sprint rollup at epic level

- NOT DONE epics → sum over **pending stories only**.
- DONE epics → sum over visible stories (resolved after Jun 29).
- Epic sprint = max sprint across all its stories.

### Resolved date at epic level

- Shown only when epic state is DONE; value = max resolved date across stories.
- Green if resolved on/before its deadline, red if after.

### Milestone grouping

- Milestone (releaseTs) per epic = `max(Dev Deadline, QA Deadline)` across its stories (fallback: epic's own resolved date).
- Epics sorted by milestone ascending; grouped under milestone headers.
- Milestone header shows story counts — all-done: "N epics · M stories"; mixed: pending/done breakdown — plus a totals row (Dev Est, UI Est, QA Est, Spent).
- A milestone whose epics are all done turns **green** (`#166534`).
- `isNew` flag (NEW badge) for epics/stories created after MTG_CUTOFF.

### Bug drill-down (RE-OPEN stories)

Path: RE-OPEN story → its **OUTWARD `Subtask`** children (development tickets) → children's **`Bugs Reported` OUTWARD** links → bugs; keep only **open** bugs (state not in done list).

- Fetch per story: `id,idReadable,links(direction,linkType(name),issues(id,idReadable,summary,links(direction,linkType(name),issues(id,idReadable))))`
- Then fetch each unique bug: `id,idReadable,summary,resolved,customFields(name,value(name,text))`
- RE-OPEN story rows get a 🐛 toggle that expands third-level bug rows showing: Bug ID (link), summary, state badge, assignee, priority (color-coded pill), and the dev ticket link it came through.

## 6. Report Specification

**Filename:** `PXB1_ReleaseSchedule_MtgTracking_YYYY-MM-DD.html`

### Table columns

`Epic / Story | Summary | State | Assignee | Dev Est | UI Est | QA Est | Spent | Dev Deadline | QA Deadline | Resolved | Sprint`

Estimates displayed in hours and man-days (480 min = 1 md).

### Layout & styling (dark theme)

| Element | Value |
|---|---|
| Page background | `#f1f5f9` |
| Header/footer | `#0f172a` |
| Table headers | `#1e293b` |
| Done epic row | green left border `#22c55e`, bg `#f0fff4` |
| Pending epic row | red left border `#ef4444`, bg `#fff8f8` |
| Milestone urgency colors | ≤0 d `#7f1d1d` · ≤3 d `#b91c1c` · ≤7 d `#c2410c` · ≤14 d `#b45309` · >14 d `#15803d` |
| All-done milestone | `#166534` |
| Final banner | `linear-gradient(135deg,#1e3a8a,#4c1d95)` |
| Sprint badge | bg `#ede9fe`, text `#5b21b6` |
| NEW badge | bg `#7c3aed`, white text |

Grand totals (gDev/gUI/gQA/gSpent) computed from pending stories across all epics; final banner shows the latest release date across milestones.

## 7. Processing Pipeline (reference implementation)

1. **Bootstrap auth** → obtain Bearer token.
2. **Fetch epics** (2 queries, merge, de-dupe, exclude PXB1-3295).
3. **Fetch + process stories** (paginate, parse custom fields, two-pass epic matching, compute epic state/sprint/releaseTs/daysFromNow/isNew/pending/doneAfterMtg).
4. **Fetch bug drill-down** for all RE-OPEN stories.
5. **Build HTML** (milestone groups, expandable stories, bug sub-rows, totals) and emit the file.

## 8. Acceptance Criteria

1. PXB1-3295 never appears.
2. Every epic appears under exactly one milestone; milestones before 2026-07-03 are not shown.
3. Epic DONE/NOT DONE badges agree with the done-state list applied to their stories.
4. Rollups on NOT DONE epics count pending stories only.
5. Every RE-OPEN story shows a bug toggle; only open bugs listed, each traceable to a dev ticket.
6. Resolved dates color-coded correctly vs deadline (green early/on-time, red late).
7. File is self-contained and opens without authentication.

## 9. Maintenance Notes

- MTG_CUTOFF and JUN29_CUTOFF are meeting-specific constants — they must be updated (or made configurable) when the baseline meeting changes.
- The `Scope` field distinguishes PHASE 1 / PHASE 2; scope changes are tracked in the Effort Report (see PRD 3), not here.
