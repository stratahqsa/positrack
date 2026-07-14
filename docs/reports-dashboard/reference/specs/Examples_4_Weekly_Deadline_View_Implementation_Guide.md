# PXB1 Phase 1 Weekly Deadline View — Example-Driven Implementation Guide

**Companion to:** PRD_4_Phase1_Weekly_Deadline_View.md and Requirements_4 (plain English) · **Date:** 2026-07-09

This document walks through the entire implementation with concrete, realistic examples: actual request URLs, sample JSON responses in the exact shape YouTrack returns, worked transformations, calculation walkthroughs, edge cases, and acceptance test cases. All sample data is illustrative but shaped exactly like production data.

---

## 1. Pipeline at a Glance

```
[1] Auth  →  [2] Fetch epics  →  [3] Fetch stories (paginated) + parse + match to epics
          →  [3.5] Bug drill-down for RE-OPEN stories  →  [4] Filter, bucket by week, build HTML
```

Each stage's output feeds the next. Below, every stage has a worked example.

---

## 2. Authentication

### Current (browser) implementation

The YouTrack SPA stores a JWT in localStorage under a key containing `-token`:

```javascript
var tkKey = Object.keys(localStorage).find(k => k.includes('-token'));
// e.g. "yt-oauth2-token"
var tk = JSON.parse(localStorage[tkKey]);
window.__H = 'Bearer ' + tk.accessToken;
```

### Server implementation

Use a YouTrack **permanent token** instead:

```
GET https://support.posibolt.com/api/issues?...
Authorization: Bearer perm:c3VoYWls.UkVQT1JUUw==.7dY3...
Accept: application/json
```

### Expired-token symptom (must handle)

A stale token can cause responses where `idReadable` is missing and only internal IDs appear:

```json
{ "id": "2-48123", "$type": "Issue" }        ← BAD: token expired / fields not resolved
{ "id": "2-48123", "idReadable": "PXB1-4567" } ← GOOD
```

On HTTP 401 or internal-ID symptom: refresh token, retry the failed call.

---

## 3. Fetch Epics — Request & Response Example

**Request:**

```
GET /api/issues
  ?query=project: PXB1 TaskType: Epic #Unresolved Scope: {PHASE 1}
  &fields=id,idReadable,summary,created,resolved,assignee(name),customFields(name,value(name,text,minutes,id))
  &$top=500
```

**Sample response (trimmed to 2 epics):**

```json
[
  {
    "id": "2-41200",
    "idReadable": "PXB1-3101",
    "summary": "Sales Returns & Refunds",
    "created": 1745910000000,
    "resolved": null,
    "assignee": { "name": "Anjali R" },
    "customFields": [
      { "name": "State",  "value": { "name": "OPEN" } },
      { "name": "Scope",  "value": { "name": "PHASE 1" } }
    ]
  },
  {
    "id": "2-41355",
    "idReadable": "PXB1-3295",
    "summary": "POS Android",
    "created": 1746000000000,
    "resolved": null,
    "customFields": [ { "name": "Scope", "value": { "name": "PHASE 1" } } ]
  }
]
```

**Processing rule + example:** `PXB1-3295` is in the exclusion list → after this step the epic list contains only `PXB1-3101`. De-duplicate by internal `id` when merging the unresolved + recently-resolved query results (an epic resolved today can appear in both).

---

## 4. Fetch Stories — Request, Response & Parsing Example

**Request (page 1):**

```
GET /api/issues
  ?query=project: PXB1 TaskType: Story Scope: {PHASE 1}
  &fields=id,idReadable,summary,created,resolved,customFields(name,value(name,text,minutes,id)),links(direction,linkType(name),issues(id,idReadable))
  &$top=200&$skip=0
```

Pagination: if the page returns exactly 200 items, request `$skip=200`, then 400, … until a page returns fewer than 200.

**Sample raw story as returned by YouTrack:**

```json
{
  "id": "2-45872",
  "idReadable": "PXB1-3412",
  "summary": "Sales: Return to original tender",
  "created": 1750750200000,
  "resolved": null,
  "customFields": [
    { "name": "State",              "value": { "name": "RE-OPEN" } },
    { "name": "Assignee",           "value": { "name": "Fahad K" } },
    { "name": "Server Estimation",  "value": { "minutes": 960 } },
    { "name": "UI Estimation",      "value": { "minutes": 480 } },
    { "name": "Testing Estimation", "value": { "minutes": 240 } },
    { "name": "Spent time",         "value": { "minutes": 1110 } },
    { "name": "Deadline Date",      "value": 1751932800000 },
    { "name": "QA Deadline",        "value": 1752451200000 },
    { "name": "Sprints",            "value": [ { "name": "Sprint 14" }, { "name": "Sprint 15" } ] }
  ],
  "links": [
    { "direction": "INWARD",  "linkType": { "name": "Subtask" },
      "issues": [ { "id": "2-41200", "idReadable": "PXB1-3101" } ] },
    { "direction": "OUTWARD", "linkType": { "name": "Subtask" },
      "issues": [ { "id": "2-46011", "idReadable": "PXB1-3488" } ] }
  ]
}
```

**Three parsing gotchas, illustrated by this payload:**

1. **State comes ONLY from customFields.** There is no usable top-level `state` on this instance.
2. **Two value shapes for custom fields.** Period fields nest minutes (`{"minutes": 960}`); date fields are **bare numbers** (`"value": 1751932800000`). The period reader and the timestamp reader must each accept both shapes defensively.
3. **`Sprints` is an array.** Display value = max by numeric suffix → here `Sprint 15`.

**Parsed story object (the transformation target):**

```json
{
  "storyId": "PXB1-3412",
  "summary": "Sales: Return to original tender",
  "state": "RE-OPEN", "done": false,
  "assignee": "Fahad K",
  "created": 1750750200000, "resolved": null,
  "devEst": 960, "uiEst": 480, "qaEst": 240, "spent": 1110,
  "ddTs": 1751932800000, "ddDate": "2026-07-08", "ddDisp": "08 Jul",
  "qaTs": 1752451200000, "qaDate": "2026-07-14", "qaDisp": "14 Jul",
  "sprints": ["Sprint 14", "Sprint 15"],
  "epicId": "PXB1-3101",
  "parentId": "PXB1-3101"
}
```

**Done detection example:** `isDone("READY FOR DEPLOYEMENT")` → false (not in done list — and note the instance's misspelling "DEPLOYEMENT" is a real state, don't "fix" it). `isDone("Fixed")` → true. `isDone("Won't fix")` → true. The done list is: done, fixed, verified, closed, won't fix, duplicate, obsolete — case-insensitive **substring** match.

---

## 5. Story→Epic Matching — Three Worked Cases

Link semantics on this instance: link type is named **`Subtask`**; `direction: "INWARD"` = the linked issue is **my parent**; `OUTWARD` = the linked issue is **my child**.

### Case A — direct match

```
PXB1-3412 has Subtask INWARD → PXB1-3101, and PXB1-3101 is an epic
⇒ epicId = PXB1-3101   (Pass 1)
```

### Case B — transitive match (story under a story)

```
PXB1-3520 has Subtask INWARD → PXB1-3412 (a story, not an epic)
PXB1-3412 maps to epic PXB1-3101 (from Pass 1)
⇒ PXB1-3520 inherits epicId = PXB1-3101   (Pass 2)
```

Pass 2 also handles the grandparent form: parent's own INWARD link points directly to an epic.

### Case C — orphan

```
PXB1-3601 has no Subtask INWARD link at all
⇒ epicId = null → counted in the orphans diagnostic, not rendered
```

---

## 6. Inclusion Filter — Worked Truth Table

Constants: `JUN29_CUTOFF = 2026-06-29T10:30:00Z`. Assume today = **Thu 9 Jul 2026** → current week = Week 2 → `WEEK_END = "2026-07-13"`.

| Story | State | Resolved | Dev DL | QA DL | Ests (D/U/Q) | Verdict | Failing test |
|---|---|---|---|---|---|---|---|
| PXB1-3412 | RE-OPEN | — | 08 Jul | 14 Jul | 960/480/240 | ✅ include | — |
| PXB1-3390 | DONE | 05 Jul (> Jun 29) | 03 Jul | 06 Jul | 480/0/240 | ✅ include | — |
| PXB1-3255 | DONE | 25 Jun (≤ Jun 29) | 22 Jun | 24 Jun | 480/0/240 | ❌ exclude | done too early |
| PXB1-3470 | OPEN | — | 09 Jul | — (null) | 960/0/480 | ❌ exclude | missing QA deadline |
| PXB1-3488 | DEVELOPMENT | — | 10 Jul | 15 Jul | 0/0/0 | ❌ exclude | no estimate |
| PXB1-3550 | OPEN | — | 21 Jul | 27 Jul | 480/0/240 | ❌ exclude | dd (21 Jul) > WEEK_END (13 Jul) |
| PXB1-3111 | OPEN | — | 12 Jun | 20 Jun | 960/480/480 | ✅ include → Week 1 | — (early dd folds into Week 1) |

The filter in code form:

```javascript
var done = isDone(s.state);
if (done && (!s.resolved || s.resolved <= JUN29_CUTOFF)) return;  // old done work
if (!s.ddTs || !s.qaTs) return;                                    // must have BOTH deadlines
if (!(s.devEst > 0 || s.uiEst > 0 || s.qaEst > 0)) return;         // ≥1 estimate
if (!s.ddDate || s.ddDate > WEEK_END) return;                      // inside shown weeks
include(s);
```

---

## 7. Week Bucketing — Anchor Arithmetic With Examples

```javascript
var ANCHOR = new Date(2026, 5, 30);            // 30 Jun 2026 (month is 0-based!)
var curIdx = Math.floor((todayMidnight - ANCHOR) / (86400000 * 7));
if (curIdx < 0) curIdx = 0;
// Week i: start = ANCHOR + i*7 days, end = start + 6 days
```

### Example 1 — run on Thu 9 Jul 2026

`(9 Jul − 30 Jun) = 9 days → floor(9/7) = 1` → curIdx 1 → render **Week 1 (30 Jun – 06 Jul)** red + **Week 2 (07 Jul – 13 Jul)** blue. `WEEK_END = 2026-07-13`.

### Example 2 — run on Mon 14 Jul 2026 (release day)

`14 days → floor(14/7) = 2` → Weeks 1, 2 red + **Week 3 (14 Jul – 20 Jul)** blue. Note 13 Jul (Monday) still belongs to Week 2; 14 Jul (Tuesday) starts Week 3 — the Tue→Mon boundary matters.

### Example 3 — bucketing individual stories (run date 9 Jul)

| Story dev deadline | First week whose end ≥ dd | Bucket |
|---|---|---|
| 2026-06-12 | ≤ 2026-07-06 | Week 1 (early deadlines fold in) |
| 2026-07-06 | ≤ 2026-07-06 | Week 1 |
| 2026-07-07 | ≤ 2026-07-13 | Week 2 |
| 2026-07-08 | ≤ 2026-07-13 | Week 2 |

Within a week, sort by QA deadline ascending, tie-break by story ID:
`[PXB1-3390 (qa 06 Jul), PXB1-3111 (qa 20 Jun → still Week 1 by dd!)] → Week 1 order: 3111 (20 Jun), 3390 (06 Jul)`.

---

## 8. Bug Drill-Down — Full Worked Example

Only stories whose state contains `re-open` (case-insensitive) get drilled. Trail: **story → OUTWARD Subtask children (dev tickets) → each child's "Bugs Reported" OUTWARD links → bugs → keep open only.**

### Step 1 — fetch the RE-OPEN story with nested links

```
GET /api/issues/PXB1-3412
  ?fields=id,idReadable,links(direction,linkType(name),issues(id,idReadable,summary,links(direction,linkType(name),issues(id,idReadable))))
```

```json
{
  "idReadable": "PXB1-3412",
  "links": [
    { "direction": "OUTWARD", "linkType": { "name": "Subtask" },
      "issues": [
        { "idReadable": "PXB1-3488", "summary": "DEV: Return tender mapping",
          "links": [
            { "direction": "OUTWARD", "linkType": { "name": "Bugs Reported" },
              "issues": [ { "idReadable": "PXB1-3901" }, { "idReadable": "PXB1-3907" } ] }
          ] },
        { "idReadable": "PXB1-3489", "summary": "UI: Return screen",
          "links": [] }
      ] }
  ]
}
```

Interpretation: `PXB1-3488` has Bugs-Reported links → it is a **dev ticket** with bug candidates `PXB1-3901`, `PXB1-3907`. `PXB1-3489` has none → ignored for bugs.

### Step 2 — fetch each unique bug

```
GET /api/issues/PXB1-3901?fields=id,idReadable,summary,resolved,customFields(name,value(name,text))
```

```json
{ "idReadable": "PXB1-3901", "summary": "Sales: Return - amount rounds wrong",
  "resolved": null,
  "customFields": [
    { "name": "State",    "value": { "name": "OPEN" } },
    { "name": "Assignee", "value": { "name": "Fahad K" } },
    { "name": "Priority", "value": { "name": "High" } } ] }
```

`PXB1-3907` comes back with state `Fixed` → `isDone` → **dropped**.

### Step 3 — result attached to the story

```json
{ "PXB1-3412": [
    { "bugId": "PXB1-3901", "summary": "Sales: Return - amount rounds wrong",
      "state": "OPEN", "assignee": "Fahad K", "priority": "High",
      "devTicketId": "PXB1-3488", "devTicketSummary": "DEV: Return tender mapping" } ] }
```

Rendered as a 🐛-toggled sub-row under PXB1-3412: bug ID (link), summary, state badge, assignee, priority badge (High → orange `#c2410c`), dev ticket link.

---

## 9. Calculations — Worked Numbers

Man-day constant: **480 min = 8 h**. Display: `fH(m) = (m/60).toFixed(1)+'h'`, `fD(m) = (m/480).toFixed(1)+'md'`, zero → `—`.

### Example: Week 2 contains exactly PXB1-3412 (960/480/240, spent 1110) and PXB1-3470b (480/0/240, spent 300)

| Metric | Computation | Display |
|---|---|---|
| Dev Est | 960+480 = 1440 min | `24.0h` / `3.0md` |
| UI Est | 480+0 = 480 | `8.0h` / `1.0md` |
| QA Est | 240+240 = 480 | `8.0h` / `1.0md` |
| Total Est | 1440+480+480 = 2400 | `40.0h` / `5.0md` |
| Spent | 1110+300 = 1410 | `23.5h` |

KPI cards at the top are the same sums across ALL weeks, plus counts: `Stories = included count`, `Pending = not done`, `Done = included done`, `Bugs = sum of open bugs across RE-OPEN stories`.

### Early/late badge (Resolved column) — examples

Rule: compare `resolved` vs **QA deadline**; `diff = round(|resolved − qaTs| / 86400000)` days.

| Resolved | QA deadline | Verdict |
|---|---|---|
| 04 Jul 14:00 | 06 Jul | `2d early` — green badge, green date |
| 08 Jul 18:00 | 06 Jul | `+3d late` — red badge, red date (rounds from 2.75d) |
| 06 Jul 09:00 | 06 Jul 00:00 | `+0d late` — resolved > deadline even same day; strictly `resolved > qaTs` |
| null (pending) | any | plain `—` |

---

## 10. HTML Output — Structural Example

Self-contained single file, filename `PXB1_WeeklyDeadlineView_2026-07-09.html`. Skeleton:

```html
<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Phase 1 Weekly Deadline View — 09 Jul 2026</title>
<style>/* ALL css inline — no external assets */</style></head>
<body>
  <!-- header + KPI cards: Stories · Pending · Done · Bugs · Dev/UI/QA/Total Est · Spent -->
  <div class="week past">   <!-- red header: Week 1 (30 Jun – 06 Jul)  [pending n][done n][bugs n] -->
    <table> <!-- 13 sortable columns -->
      <tr class="story done">…</tr>
      <tr class="story reopen">…</tr>       <!-- has 🐛 toggle -->
      <tr class="bugrow" data-parent="PXB1-3412">…</tr>  <!-- moves WITH its parent when sorting -->
      <tr class="totals">…</tr>             <!-- always re-inserted last after sort -->
    </table>
  </div>
  <div class="week current"> <!-- blue header: Week 2 (07 Jul – 13 Jul) --> … </div>
  <!-- footer summary bar -->
  <script>/* sortTbl(): collects story+bug rows as units, sorts, re-appends totals row */</script>
</body></html>
```

Column header row (13): `Story · Summary · State · Assignee · Sprint · Epic · Dev Est · UI Est · QA Est · Spent · Dev Deadline · QA Deadline · Resolved`. Default sort: QA Deadline ascending. Spent column header uses the distinct dark-purple `#2d1b69`; other headers `#1e3a5f`.

State badge color examples: `RE-OPEN` → `#fee2e2`/`#b91c1c` · `TESTING` → `#e0f2fe`/`#0369a1` · `READY FOR DEPLOYEMENT` → matches "ready" → `#e0e7ff`/`#4338ca` · `Fixed` → done green `#dcfce7`/`#15803d` · `BLOCKED` → `#fce7f3`/`#9d174d`. **Match order matters:** test done → re-open → testing/qa → ready → open → progress/development → integration → blocked; e.g. "RE-OPEN" contains "open", so re-open must be tested before open.

---

## 11. Acceptance Test Cases (Given / When / Then)

| # | Given | When | Then |
|---|---|---|---|
| T1 | Today = 9 Jul 2026 | Report runs | Exactly 2 week sections: Week 1 (red), Week 2 (blue); WEEK_END = 13 Jul |
| T2 | Today = 14 Jul 2026 | Report runs | 3 sections; Week 3 = 14–20 Jul is current |
| T3 | Story dev DL = 12 Jun 2026, passes other tests | Bucketing | Appears in Week 1 |
| T4 | Story dev DL = 21 Jul, today = 9 Jul | Filtering | Not in report (beyond current week) |
| T5 | Story has dev DL but QA DL empty | Filtering | Excluded |
| T6 | Story all estimates 0 | Filtering | Excluded |
| T7 | Story state "Fixed", resolved 25 Jun (≤ Jun 29 4PM IST) | Filtering | Excluded |
| T8 | Story state "Fixed", resolved 5 Jul | Filtering | Included, green row |
| T9 | Story state "RE-OPEN" with 1 open + 1 fixed linked bug | Drill-down | 🐛 shows exactly 1 bug row (the open one) with dev ticket link |
| T10 | RE-OPEN story's child has no "Bugs Reported" links | Drill-down | Story shows bug count 0, no crash |
| T11 | Click "Assignee" column header | Sorting | Rows reorder; each bug row stays directly under its parent story; totals row stays last |
| T12 | Story resolved 08 Jul, QA DL 06 Jul | Rendering | Resolved cell red with `+2d late` badge |
| T13 | Week with stories 960/480/240 + 480/0/240 min | Totals row | Dev 24.0h, UI 8.0h, QA 8.0h, Total 40.0h/5.0md |
| T14 | Epic PXB1-3295 has qualifying stories | Whole report | None of them appear (epic excluded upstream) |
| T15 | Story parented to another story under epic E | Matching | Story displays epic E in the Epic column |
| T16 | Story with no epic link | Matching | Not rendered; orphan count incremented in diagnostics |
| T17 | 450 stories in project | Pagination | 3 requests ($skip 0, 200, 400); all parsed |
| T18 | Sprints = ["Sprint 9", "Sprint 14"] | Display | Sprint column shows "Sprint 14" |
| T19 | Open file from disk, offline | Rendering | Everything renders; sorting and toggles work (no network calls) |
| T20 | State "READY FOR DEPLOYEMENT" (sic) | Badge | Renders as ready-blue badge; NOT treated as done |

---

## 12. Edge Cases & Defensive Rules

- **Null Module/Assignee/custom field:** reader functions must return null/0/[] instead of throwing; display `—`.
- **Custom field value as array vs object vs number:** handle all three (`Sprints` array, period `{minutes}`, date bare number).
- **Same-day resolved vs deadline:** strictly `resolved > qaTs` = late; equal timestamps = not late.
- **Week 1 clamp:** if run before 30 Jun 2026, `curIdx` clamps to 0 — exactly one week section, never negative.
- **Duplicate bugs:** the same bug can be linked from two dev tickets — de-duplicate by bug ID before fetching, but attach per dev-ticket when rendering.
- **HTML-escape everything** from the tracker (summaries contain `<`, `&`, quotes).
- **Rate limits:** bug fetches are one call per unique bug; batch with `Promise.all` (browser) or a small concurrency pool (server).
- **Empty week:** a week with zero qualifying stories still renders its header (with zero badges) so the timeline stays continuous.

---

## 13. Suggested Server Test Fixtures

Build a fixture file with the §4 raw story JSON, §3 epic JSON, and §8 link/bug JSON verbatim, then assert the parsed objects in §4/§8 and the computed table in §9. That gives regression coverage for the three most fragile areas: custom-field parsing, link-walking, and week arithmetic.
