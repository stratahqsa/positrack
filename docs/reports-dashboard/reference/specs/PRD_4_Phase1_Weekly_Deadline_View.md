# PRD — PXB1 Phase 1 Weekly Deadline View

**Version:** 1.0 · **Date:** 2026-07-09 · **Owner:** Mohamed Suhail (suhail@posibolt.com)
**Report family:** PXB1 Phase 1 daily reports · **Current schedule:** Daily, 9:40 AM IST

---

## 1. Purpose

Shows PXB1 Phase 1 **stories grouped by dev deadline into release-week slots**, one collapsible section per week from Week 1 through the current week, so the team can see what was due each release week and its current status. RE-OPEN stories drill down to their open bugs.

Output is a **fully self-contained HTML file** with sortable columns.

## 2. Week-Slot Model

- Weeks run **Tuesday → Monday**, releases every Monday.
- **Anchor: Week 1 = 30 Jun – 6 Jul 2026** (`ANCHOR = 2026-06-30`).
- Week N: start = ANCHOR + (N−1)×7 days, end = start + 6 days.
- Sections rendered for Week 1 through the week containing today (`curIdx = floor((todayMidnight − ANCHOR)/7 days)`, clamped ≥ 0). E.g. run on 14 Jul → Week 1, Week 2, Week 3 (14–20 Jul).
- A story is bucketed into the first week whose end date ≥ its dev deadline date; **dev deadlines before 30 Jun fall into Week 1**.
- **Past weeks: red headers; current week: blue header.**
- `WEEK_END` = end date of the current week — stories with dev deadline after WEEK_END are excluded.

## 3. Data Source & API Contract

Same base pipeline as the Release Schedule Tracker (PRD 2, sections 3–4): Bearer-token auth; epics via `project: PXB1 TaskType: Epic ... Scope: {PHASE 1}` (excluding **PXB1-3295**); stories fetched top-level via `project: PXB1 TaskType: Story Scope: {PHASE 1}` paginated 200/page; two-pass Subtask-INWARD story→epic matching; State/Assignee always read from customFields.

### Custom field mapping

| Meaning | Custom field |
|---|---|
| devEst | `Server Estimation` (minutes) |
| uiEst | `UI Estimation` (minutes) |
| qaEst | `Testing Estimation` (minutes) |
| spent | `Spent time` (minutes) |
| ddTs — dev deadline | `Deadline Date` (epoch ms) |
| qaTs — QA deadline | `QA Deadline` (epoch ms) |
| state | `State` (top-level state is always null) |
| sprints | `Sprints` (array; display max by numeric suffix) |

### Constants

| Constant | Value |
|---|---|
| JUN29_CUTOFF | `2026-06-29T10:30:00Z` (29 Jun 4PM IST) |
| Excluded epic | `PXB1-3295` (POS Android) |
| 1 man-day | 480 min |
| Done states | `done, fixed, verified, closed, won't fix, duplicate, obsolete` |

## 4. Story Inclusion Filter

```javascript
var done          = isDone(s.state);
var includeAsDone = done && s.resolved > JUN29_CUTOFF;   // done, but only if resolved after Jun 29 4PM IST
var includePending= !done;
var hasBothDeadlines = !!s.ddTs && !!s.qaTs;             // dev AND QA deadline set
var hasEstimate   = s.devEst > 0 || s.uiEst > 0 || s.qaEst > 0;
var inWindow      = s.ddDate <= WEEK_END;                // dev deadline within shown weeks

include = (includePending || includeAsDone) && hasBothDeadlines && hasEstimate && inWindow;
```

Within each week, stories sort by QA deadline ascending (tie-break: story ID).

## 5. Bug Drill-Down (RE-OPEN stories)

Identical to PRD 2 §5: RE-OPEN story → OUTWARD `Subtask` children (dev tickets) → `Bugs Reported` OUTWARD links → open bugs only. Bug sub-rows toggle with a 🐛 button and show: Bug ID (link), summary, state badge, assignee, priority badge, dev ticket link. When sorting, a story row and its bug rows move as a unit.

## 6. Report Specification

**Filename:** `PXB1_WeeklyDeadlineView_YYYY-MM-DD.html`

### KPI cards (top)

`Stories · Pending · Done · Bugs · Dev Est · UI Est · QA Est · Total Est · Spent`

### Week sections

- One collapsible group per week: label `Week N (DD Mon – DD Mon)`, with pill badges for pending / done / bug counts.
- Past weeks red header, current week blue header.
- Per-group **totals row** (Dev/UI/QA/Spent sums) and a footer summary bar across all weeks.

### Story table — 13 sortable columns

`Story ID · Summary · State · Assignee · Sprint · Epic · Dev Est · UI Est · QA Est · Spent · Dev Deadline · QA Deadline · Resolved`

- Default sort: QA Deadline ascending.
- Estimates displayed as `X.Xh` (and man-days where totalized); `—` for zero.
- **Resolved cell:** date + badge vs QA deadline — `+Nd late` (red) or `Nd early` (green).
- Issue IDs link to `https://support.posibolt.com/issue/{id}`.

### Color coding

- Done rows: green tint; RE-OPEN rows: red tint.
- State badges: done `#dcfce7/#15803d` · RE-OPEN `#fee2e2/#b91c1c` · TESTING/QA `#e0f2fe/#0369a1` · READY `#e0e7ff/#4338ca` · OPEN `#fef9c3/#854d0e` · PROGRESS/DEVELOPMENT `#fef3c7/#92400e` · INTEGRATION `#e0f2fe/#0c4a6e` · BLOCKED `#fce7f3/#9d174d` · default `#f1f5f9/#475569`.
- Priority badges: Critical/Blocker `#991b1b` · Major/High `#c2410c` · Minor/Low `#15803d` · default `#64748b`.
- Table header `#1e3a5f` (Spent column header `#2d1b69`).

## 7. Processing Pipeline (reference implementation)

1. Bootstrap auth (Bearer token).
2. Fetch Phase 1 epics (exclude PXB1-3295).
3. Fetch + process stories (paginate, parse fields, epic matching).
4. Fetch bug drill-down for RE-OPEN stories.
5. Filter stories (§4), bucket into week slots (§2), build HTML, emit file.

## 8. Acceptance Criteria

1. Week boundaries: Week 1 = 30 Jun–6 Jul 2026; each subsequent week Tue→Mon; sections exist for every week up to today.
2. Every included story has both deadlines, ≥1 estimate, and is pending or done-after-Jun-29.
3. Stories with dev deadline < 30 Jun appear in Week 1; none appear beyond the current week.
4. Sorting any column keeps bug sub-rows attached to their parent story and totals row last.
5. KPI counts equal the sums across week groups.
6. File is self-contained and opens without authentication.

## 9. Maintenance Notes

- The Week 1 anchor (30 Jun 2026) and JUN29_CUTOFF are Phase-1-specific constants; parameterize for future phases.
- Weeks accumulate over time — one section per elapsed week — so the report grows through the phase.
