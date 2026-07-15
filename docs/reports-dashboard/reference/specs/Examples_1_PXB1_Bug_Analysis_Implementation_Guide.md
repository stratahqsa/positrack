# PXB1 Bug Analysis Report — Example-Driven Implementation Guide

**Companion to:** PRD_1_PXB1_Bug_Analysis_Report.md and Requirements_1 (plain English) · **Date:** 2026-07-09

Concrete request URLs, sample JSON in YouTrack's exact response shape, worked transformations, calculation walkthroughs, acceptance tests, and edge cases. Sample data is illustrative but production-shaped.

---

## 1. Pipeline at a Glance

```
[1] Auth  →  [2] Compute reporting window  →  [3] Run 5 queries (paginated)
          →  [4] Group/split/aggregate      →  [5] Build self-contained HTML
```

Auth is identical to the Weekly Deadline View guide §2 (browser: localStorage JWT; server: permanent token; retry on 401).

---

## 2. Reporting Window — Worked Examples

Window = **start of yesterday 00:00 IST → report run time (now)**. IST = UTC+5:30, so yesterday 00:00 IST = day-before 18:30 UTC.

### Example 1 — report runs Thu 9 Jul 2026, 10:04 AM IST

```
WIN_START = 8 Jul 00:00 IST = 2026-07-07T18:30:00Z = 1751913000000
WIN_END   = 9 Jul 10:04 IST = 2026-07-09T04:34:00Z = 1752035640000
Window label: "8 Jul 12:00 AM → 9 Jul 10:04 AM IST"
yesterday string for the query: "2026-07-08"
```

### Example 2 — report re-run same day at 4:35 PM

Same WIN_START; WIN_END moves to 16:35 IST. A bug created at 2 PM today appears in the 4:35 PM run but not the 10 AM run — **the window's end is the run moment, by design**.

### Example 3 — IST midnight vs UTC trap

A bug created 8 Jul 2026 at 00:15 IST has `created = 2026-07-07T18:45:00Z`. Its UTC calendar date is 7 Jul — but it IS inside the window (18:45 > 18:30 UTC). This is exactly why the query result must be re-filtered client-side by epoch ms, not by date strings.

```javascript
inWindow = (b.created >= WIN_START && b.created <= WIN_END)
```

---

## 3. The Five Queries — URLs and Post-Processing

Common parameters for all: `&fields=id,idReadable,summary,created,resolved,reporter(fullName,login),customFields(name,value(name,text))&$top=500&$skip=…` — paginate until a page returns < 500.

```
Q1  /api/issues?query=project: PXB1 TaskType: BUG created: 2026-07-08 .. Today #Unresolved
Q2  /api/issues?query=project: PXB1 TaskType: BUG Priority: {High} #Unresolved
Q3  /api/issues?query=project: PXB1 TaskType: BUG Priority: {Medium} #Unresolved
Q4  /api/issues?query=project: PXB1 TaskType: BUG Priority: {Low} #Unresolved
Q5  /api/issues?query=project: PXB1 TaskType: BUG created: 2026-07-02 .. Today
```

Two non-negotiable rules, with the failure they prevent:

1. **`TaskType: BUG`, never `Type: Bug`.** PXB1's issue type is a custom field. `Type: Bug` returns a small, silently wrong subset. Symptom of the mistake: Section counts far below what the tracker UI shows.
2. **Explicit date for Q5, never `created: -7d .. Today`.** The relative form returns **HTTP 400** on this instance. Compute `today(IST) − 7 days` → `"2026-07-02"`.

---

## 4. Sample Bug — Raw and Parsed

**Raw (as returned):**

```json
{
  "id": "2-48231",
  "idReadable": "PXB1-3987",
  "summary": "Settings: Register- Placeholder text missing",
  "created": 1751971500000,
  "resolved": null,
  "reporter": { "fullName": "Divya S", "login": "divya.s" },
  "customFields": [
    { "name": "State",    "value": { "name": "OPEN" } },
    { "name": "Priority", "value": { "name": "Medium" } },
    { "name": "Module",   "value": { "name": "Settings" } },
    { "name": "Assignee", "value": { "name": "Rahul M" } }
  ]
}
```

**Parsed:**

```json
{
  "id": "PXB1-3987",
  "summary": "Settings: Register- Placeholder text missing",
  "created": 1751971500000,
  "state": "OPEN", "priority": "Medium", "module": "Settings",
  "assignee": "Rahul M", "reporter": "Divya S"
}
```

Parsing notes shown by this payload: Reporter comes from the **top-level** `reporter.fullName` (fallback `login`; there is no Reporter custom field). Any missing custom field → `—`. Created renders as `08 Jul 2026, 4:15 PM` (IST, muted style).

---

## 5. Grouping Logic — Worked Examples

### Q1 → Section 1 (priority sub-sections)

Given 26 in-window bugs: 6 High, 17 Medium, 1 Low, 2 with priority "Critical" (unexpected value).

- Sub-sections rendered in order High(6) → Medium(17) → Low(1), each sorted by `created` ascending.
- **Unexpected priority values** do not disappear silently: log them in diagnostics. (Current behavior groups only H/M/L; a rebuild should decide: extra sub-section or diagnostic warning.)

### Q2 → Section 2 split

```javascript
var oldHigh = q2.filter(b => b.created <  WIN_START);  // → Section 2
var newHigh = q2.filter(b => b.created >= WIN_START);  // already visible in Section 1
```

**Invariant to assert:** `q2.length === oldHigh.length + newHigh.length` and every open High bug appears in exactly one of Section 1 / Section 2. Example: 25 open High, 6 created in window → Section 2 shows 19.

### Q3/Q4 → Section 3 state breakdown

Given Q3 = 122 open Medium bugs:

| State | Count | Bar width | % |
|---|---|---|---|
| TESTING | 44 | 100% (max) | 36.1% |
| OPEN | 31 | 70% | 25.4% |
| RE-OPEN | 18 | 41% | 14.8% |
| DEVELOPMENT | 15 | 34% | 12.3% |
| READY FOR TESTING | 9 | 20% | 7.4% |
| UI INTEGRATION | 3 | 7% | 2.5% |
| BLOCKED | 2 | 5% | 1.6% |

Rules illustrated: sort by count desc; bar width = `count / maxCount`; percentage = `count / totalInPanel` (they sum to ~100% per panel, allow rounding drift); null state groups as `—`.

---

## 6. Submodule Extraction — Worked Examples (Q5 / Section 4)

Rule: text after the **first colon**, cut at the **first dash of any type** `/[-–—]/`, trimmed. Group by this value only.

| Summary | Submodule | Why |
|---|---|---|
| `Settings: Register- Placeholder text missing` | `Register` | dash with no leading space still cuts |
| `Sale: Credit Note – wrong tax on return` | `Credit Note` | en-dash `–` cuts |
| `Reports: Stock Ledger — export empty` | `Stock Ledger` | em-dash `—` cuts |
| `Purchase: GRN` | `GRN` | no dash → whole text after colon |
| `Login page broken` | *(skipped)* | no colon → no submodule for this bug |
| `Accounts: Day Book - Pettycash - crash` | `Day Book` | cut at FIRST dash only |
| `POS Register App: Sync-retry loop` | `Sync` | dash inside word still cuts (accepted trade-off) |

### Section 4 aggregation example

Q5 (last 7 days) = 120 bugs. Group by Module (null → `(No module)`), sort desc; within each module count submodules, render top 8 as purple badges:

```
Sale (31)      [Credit Note · 7] [Cash Sale · 5] [Returns · 4] …
Reports (22)   [Stock Ledger · 6] [Day Book · 4] …
(No module)(9) [—]
```

KPI "Modules Hit (7d)" = number of distinct module groups = e.g. **11**.

---

## 7. KPI Bar — Computation Example

With Q1-window: 6 High/17 Med; Q2 = 25; Q3 = 122; Q4 = 72; modules = 11:

```
New High (window)=6 · New Medium (window)=17 · Open High Total=25
Open Medium=122 · Open Low=72 · Total Open Bugs=25+122+72=219 · Modules Hit (7d)=11
```

`Total Open Bugs` is the sum of the three priority queries — do NOT run a separate "all open" query (it can disagree if a bug has an unexpected priority; if the sums must reconcile, that's a data-quality signal, not a report bug).

---

## 8. HTML Output — Structural Example

Filename `PXB1_BugAnalysis_2026-07-09.html`; fully self-contained.

```html
<!DOCTYPE html><html><head><meta charset="utf-8"><title>PXB1 — Bug Analysis Report</title></head>
<body style="background:#f8fafc;font-family:Arial;font-size:13px">
  <!-- banner: linear-gradient(135deg,#0f172a,#1e3a8a); title + subtitle with window label -->
  <!-- KPI bar: 7 cards -->
  <div><!-- Section 1 · header #991b1b · collapsible -->
    <!-- High(6) table → Medium(17) table → Low(1) table
         columns: ID | Summary | Created | State | Assignee | Module | Reporter -->
  </div>
  <div><!-- Section 2 · header #b91c1c · same columns, pre-window open High --></div>
  <div><!-- Section 3 · header #b45309 · two flex panels Medium|Low:
            State badge | count pill | bar | % --></div>
  <div><!-- Section 4 · header #4338ca · Module | count pill | top-8 submodule badges --></div>
</body></html>
```

Collapse mechanic: header `onclick` toggles the body `div` display — must work from `file://` with no network.

State badge mapping with match-order examples: `RE-OPEN` must be tested **before** `OPEN` (substring trap); `READY FOR DEPLOYEMENT` (sic — real state, keep the misspelling) matches "READY/DEPLOY" → green; `UI INTEGRATION` matches DEV/UI family → blue; `TESTING` → purple; `BLOCKED` → deep red.

---

## 9. Acceptance Test Cases (Given / When / Then)

| # | Given | When | Then |
|---|---|---|---|
| T1 | Run at 10:04 AM IST on 9 Jul | Window computed | WIN_START = 7 Jul 18:30:00Z; label "8 Jul 12:00 AM → 9 Jul 10:04 AM IST" |
| T2 | Bug created 8 Jul 00:15 IST | Window filter | Included (despite UTC date 7 Jul) |
| T3 | Bug created 7 Jul 11:59 PM IST | Window filter | Excluded from Section 1 |
| T4 | Query uses `Type: Bug` | — | WRONG — counts collapse; must be `TaskType: BUG` |
| T5 | Q5 uses `created: -7d .. Today` | Request | HTTP 400 — must use explicit date |
| T6 | 25 open High, 6 in window | Sections built | Section 1-High = 6, Section 2 = 19, no overlap |
| T7 | 700 open Medium bugs | Pagination | Two pages ($skip 0, 500); all 700 in Section 3 |
| T8 | Summary "Accounts: Day Book - Pettycash - crash" | Submodule | Badge "Day Book" (first dash only) |
| T9 | Summary with en-dash "Sale: Credit Note – tax" | Submodule | Badge "Credit Note" |
| T10 | Summary "Login page broken" (no colon) | Submodule | Bug counts toward module only, no badge |
| T11 | Module custom field null | Section 4 | Grouped under "(No module)" |
| T12 | Medium panel counts 44+31+18+15+9+3+2 | Percentages | Sum ≈ 100% (±0.5 rounding) |
| T13 | Bug state "RE-OPEN" | Badge | Orange badge (not red OPEN) — match order |
| T14 | 12 modules with >8 submodules each | Section 4 | Max 8 badges per module, highest counts kept |
| T15 | Report opened offline from disk | Rendering | All sections render and collapse; zero network requests |
| T16 | Reporter custom field absent | Row | Reporter from top-level `reporter.fullName` |
| T17 | Same bug in Q1 and Q2 (new High) | Dedup check | Appears in Section 1 only; Section 2 excludes window |
| T18 | Created 1751971500000 | Created column | "08 Jul 2026, 4:15 PM" IST, muted `#475569`, no-wrap |

---

## 10. Edge Cases & Defensive Rules

- **Empty window (no new bugs):** Section 1 renders each priority sub-section with "No bugs." — never omit the section.
- **HTML-escape** summaries (QA titles contain `<`, `&`, quotes).
- **Duplicate protection:** de-duplicate by `idReadable` within each query result (pagination overlap under concurrent writes).
- **Timezone discipline:** ALL date math in epoch ms; ALL display in IST. Never use the server's local timezone implicitly.
- **Q2∩Q1 consistency:** a High bug created in-window and still open must appear in Section 1 and be absent from Section 2 — assert this in tests.
- **Priority values outside H/M/L:** count them, surface in diagnostics; don't silently drop.
- **Long summaries:** wrap (no truncation) — the ID column is no-wrap, summary column flexes.

---

## 11. Suggested Server Test Fixtures

Fixture the §4 raw bug verbatim plus variants (null module, no colon summary, en/em-dash summaries, RE-OPEN state, created at 00:15 IST boundary). Assert: parsed object, window inclusion, submodule extraction table (§6), and the Section 2 split invariant (T6).
