# PRD — PXB1 Bug Analysis Report

**Version:** 1.1 · **Date:** 2026-07-09 · **Owner:** Mohamed Suhail (suhail@posibolt.com)
**Report family:** PXB1 Phase 1 daily reports · **Current schedule:** Daily, 10:00 AM IST

---

## 1. Purpose

A daily QA/triage report for the **PXB1** project on the Posibolt YouTrack instance (`https://support.posibolt.com`). It answers four questions:

1. What bugs did QA report since the start of yesterday (by priority)?
2. What High-priority bugs remain open from before that window?
3. Where do the open Medium/Low bugs sit in the workflow (state breakdown)?
4. Which modules/submodules generated the most bugs in the last 7 days?

Output is a **fully self-contained HTML file** (inline CSS/JS, no external assets, no login needed to view) so it can be emailed, archived, or served statically.

## 2. Data Source & API Contract

- **Base URL:** `https://support.posibolt.com/api`
- **Endpoint:** `GET /issues?query={q}&fields={f}&$top=500&$skip={n}`
- **Auth:** `Authorization: Bearer <token>` header. (Current implementation reads a short-lived JWT from the YouTrack web session's localStorage; a server implementation should use a YouTrack **permanent token** with read access to PXB1. On HTTP 401, refresh the token and retry.)
- **Fields parameter:** `id,idReadable,summary,created,resolved,reporter(fullName,login),customFields(name,value(name,text))`
- **Pagination:** `$top=500`, increment `$skip` by 500 until a page returns fewer than 500 items.

### Critical project convention

> **PXB1 does NOT use YouTrack's standard `Type` field.** Issue type lives in a custom field named **`TaskType`** (values: BUG, EPIC, STORY, DEVELOPMENT, UI, …). Every query MUST filter with `TaskType: BUG`. Using `Type: Bug` silently returns undercounted results.

### Field mapping (per bug)

| Report field | Source |
|---|---|
| ID | `idReadable` (link to `https://support.posibolt.com/issue/{idReadable}`) |
| Summary | `summary` |
| Created | `created` (epoch ms) |
| State | custom field `State` → `value.name` |
| Priority | custom field `Priority` → `value.name` |
| Module | custom field `Module` → `value.name` |
| Assignee | custom field `Assignee` → `value.name` |
| Reporter | top-level `reporter.fullName` (fallback `reporter.login`). A `Reporter` custom field may not exist. |

## 3. Reporting Window

The Section 1 window runs from **start of yesterday (00:00 IST)** through **report run time (now)** — not just yesterday. If the report runs at 4 PM, the window is yesterday 12:00 AM IST → today 4:00 PM.

- `WIN_START` = yesterday 00:00 IST = (day-before) 18:30 UTC, as epoch ms
- `WIN_END` = now (epoch ms)
- Query broadly with `created: {yesterday YYYY-MM-DD} .. Today`, then filter client-side by `WIN_START <= created <= WIN_END`.

## 4. Queries

| # | Purpose | YouTrack query | Post-processing |
|---|---|---|---|
| Q1 | New bugs in window | `project: PXB1 TaskType: BUG created: {yesterday} .. Today #Unresolved` | client-side window filter; group by Priority High/Medium/Low |
| Q2 | All open High bugs | `project: PXB1 TaskType: BUG Priority: {High} #Unresolved` | split: created within window vs before window |
| Q3 | All open Medium bugs | `project: PXB1 TaskType: BUG Priority: {Medium} #Unresolved` | group by State |
| Q4 | All open Low bugs | `project: PXB1 TaskType: BUG Priority: {Low} #Unresolved` | group by State |
| Q5 | Last-7-days bugs | `project: PXB1 TaskType: BUG created: {seven-days-ago YYYY-MM-DD} .. Today` | group by Module → submodule |

> ⚠️ **Known instance quirk:** the relative range `created: -7d .. Today` returns **HTTP 400** on this YouTrack instance. Always compute and use an explicit `YYYY-MM-DD` date.

### Submodule extraction rule (Q5)

Bug summaries follow `Module: Submodule - description`.

- Submodule = text after the **first colon**, cut at the **first dash of any type** — hyphen `-`, en-dash `–`, or em-dash `—` (regex `/[-–—]/`), regardless of surrounding spaces.
- Example: `"Settings: Register- Placeholder text missing"` → submodule `Register`.
- No dash after the colon → use the whole text after the colon.
- No colon → skip submodule for that bug.
- Group ONLY by the extracted submodule value (never include the description).

## 5. Report Specification

**Title:** `PXB1 — Bug Analysis Report`
**Subtitle:** `Generated {date} · Covers: QA bugs {window label, e.g. "8 Jul 12:00 AM → 9 Jul 4:35 PM IST"} · Open high priority · Medium/Low state breakdown · Module insights (last 7 days)`

### KPI bar (top)

`New High (window) | New Medium (window) | Open High Total | Open Medium | Open Low | Total Open Bugs | Modules Hit (7d)`

- Total Open Bugs = Q2 + Q3 + Q4 counts.
- Modules Hit (7d) = distinct Module values in Q5 (nulls bucketed as "(No module)").

### Section 1 — QA Bugs Reported ({window label})

- Header bar: dark red `#991b1b`, collapsible (click toggles body).
- Sub-sections by priority, High → Medium → Low, each with a count; rows sorted by `created` ascending.
- Columns: **ID | Summary | Created | State | Assignee | Module | Reporter**
- ID links to the YouTrack issue; State rendered as a colored badge.

### Section 2 — All Open High Priority Bugs (excluding reporting window)

- Header bar: red `#b91c1c`, collapsible.
- Contains open High bugs with `created < WIN_START`, sorted by `created` ascending.
- Same columns as Section 1 (including Created).

### Section 3 — Medium & Low Priority Bugs by State

- Header bar: amber `#b45309`, collapsible.
- Two side-by-side panels: **Medium (left)** and **Low (right)**.
- Each panel rows: State badge | Count (colored pill) | horizontal bar (proportional to max count) | percentage of that priority's open total. Sorted by count descending.

### Section 4 — Module Insights (Last 7 Days)

- Header bar: indigo `#4338ca`, collapsible.
- Columns: **Module | Bug Count (indigo pill) | Top Submodules** (purple badges `submodule · count`, top 8 per module by count).
- Modules sorted by bug count descending.

### Created column (all bug listing tables)

- Bug `created` timestamp rendered in **IST**, format `DD Mon YYYY, h:mm AM/PM` (e.g. `08 Jul 2026, 4:35 PM`).
- Muted styling: smaller font, color `#475569`, no-wrap.

## 6. Styling

| Element | Value |
|---|---|
| Page background / font | `#f8fafc` / Arial 13px |
| Header banner | `linear-gradient(135deg, #0f172a, #1e3a8a)`, white text |
| Priority colors | High `#dc2626` · Medium `#d97706` · Low `#16a34a` |
| State badge default | bg `#e0f2fe`, text `#0369a1` |
| State badge variants | OPEN = red tones (`#fee2e2`/`#b91c1c`) · RE-OPEN = orange (`#ffedd5`/`#c2410c`) · DEV/PROGRESS/UI = blue (`#dbeafe`/`#1d4ed8`) · QA/TEST = purple (`#ede9fe`/`#6d28d9`) · READY/DEPLOY/DONE = green (`#dcfce7`/`#15803d`) · BLOCKED = deep red (`#fecaca`/`#7f1d1d`) |
| Sections | rounded cards, 1px `#e2e8f0` border, collapsible via onclick |

## 7. Output

- Filename: `PXB1_BugAnalysis_YYYY-MM-DD.html` (today's date, IST).
- Single self-contained HTML file; no external CSS/JS/fonts; opens in any browser without authentication.
- Current delivery: browser Blob + anchor-click download to Chrome Downloads. Server delivery: write the same HTML to disk / object storage and serve statically.

## 8. Known open-state values (PXB1)

`OPEN, RE-OPEN, DEVELOPMENT, TESTING, UI INTEGRATION, READY FOR TESTING, READY FOR UI, READY FOR DEPLOYEMENT` *(note the instance's spelling "DEPLOYEMENT")*, `BLOCKED`.

Resolved/done detection elsewhere in this report family uses the state list: `done, fixed, verified, closed, won't fix, duplicate, obsolete` (case-insensitive substring match). This report relies on `#Unresolved` in queries instead.

## 9. Acceptance Criteria

1. All five queries use `TaskType: BUG` and paginate fully.
2. Section 1 counts match a manual YouTrack search for the same window (±0).
3. Section 1 + Section 2 together contain every open High bug exactly once.
4. Section 3 percentages per panel sum to ~100%.
5. Submodule badges never contain description text (dash rule applied).
6. File opens with all sections rendered and collapsible with JavaScript enabled, from local disk, with no network access.
