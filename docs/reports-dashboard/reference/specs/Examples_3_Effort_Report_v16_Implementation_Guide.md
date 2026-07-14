# PXB1 Phase 1 Effort Report (v16) — Example-Driven Implementation Guide

**Companion to:** PRD_3_Phase1_Effort_Report_v16.md and Requirements_3 (plain English) · **Date:** 2026-07-09

Concrete requests, production-shaped sample JSON, worked categorization and effort math, P2-backlog activity detection with a real-shaped payload, acceptance tests, edge cases.

---

## 1. Pipeline at a Glance

```
[1] Auth → [2] Discover epic IDs (2 queries) → [3] Fetch each epic FULL (nested stories)
        → [4/5] Categorize + story spent      → [6/7] P2 backlog via activity history
        → [8] Build sortable HTML + Grand Total
```

Constants: `CUTOFF = 2026-06-29T10:30:00Z` (29 Jun 4PM IST) · exclude `PXB1-3295` · man-day 480 min · done states: done, fixed, verified, closed, won't fix, duplicate, obsolete · a story is **P1 unless** its Scope contains "PHASE 2".

**Auth quirk specific to this report:** the header set is an **object** `{'Authorization':'Bearer …','Accept':'application/json'}`, not a bare string — keep that shape if reusing the scripts.

---

## 2. Discover Epic IDs — Example

```
Q-A  project: PXB1 TaskType: EPIC Scope: {PHASE 1} #Unresolved
Q-B  project: PXB1 TaskType: EPIC Scope: {PHASE 1} resolved date: 2026-06-29 .. today
fields=id,idReadable,summary &$top=500
```

Example outcome: Q-A → 63, Q-B → 10, overlap 1, minus PXB1-3295 → **72 epic IDs**.

---

## 3. Fetch Full Epic — Request & Response Example

One request **per epic** (N+1 by design; ~60–90 s for 72 epics — a server port may parallelize with a small pool):

```
GET /api/issues/2-41200?fields=id,idReadable,summary,state(name),resolved,created,
  customFields(name,value(name,minutes)),
  links(direction,linkType(name),issues(id,idReadable,summary,state(name),resolved,created,customFields(name,value(name,minutes))))
```

**Sample response (trimmed):**

```json
{
  "idReadable": "PXB1-3101",
  "summary": "Sales Returns & Refunds",
  "resolved": null,
  "created": 1745910000000,
  "customFields": [
    { "name": "State",              "value": { "name": "OPEN" } },
    { "name": "Assignee",           "value": { "name": "Anjali R" } },
    { "name": "Scope",              "value": { "name": "PHASE 1" } },
    { "name": "Server Estimation",  "value": { "minutes": 2400 } },
    { "name": "UI Estimation",      "value": { "minutes": 960 } },
    { "name": "Testing Estimation", "value": { "minutes": 720 } },
    { "name": "Spent time",         "value": { "minutes": 1830 } }
  ],
  "links": [
    { "direction": "OUTWARD", "linkType": { "name": "Subtask" },
      "issues": [
        { "idReadable": "PXB1-3412", "summary": "Return to original tender", "resolved": null,
          "customFields": [
            { "name": "State", "value": { "name": "RE-OPEN" } },
            { "name": "Scope", "value": { "name": "PHASE 1" } },
            { "name": "Server Estimation",  "value": { "minutes": 960 } },
            { "name": "UI Estimation",      "value": { "minutes": 480 } },
            { "name": "Testing Estimation", "value": { "minutes": 240 } },
            { "name": "Spent time",         "value": { "minutes": 1110 } } ] },
        { "idReadable": "PXB1-3390", "summary": "Refund audit log", "resolved": 1751703000000,
          "customFields": [
            { "name": "State", "value": { "name": "Fixed" } },
            { "name": "Server Estimation", "value": { "minutes": 480 } },
            { "name": "Testing Estimation","value": { "minutes": 240 } } ] },
        { "idReadable": "PXB1-3555", "summary": "Return analytics (P2)", "resolved": null,
          "customFields": [
            { "name": "State", "value": { "name": "OPEN" } },
            { "name": "Scope", "value": { "name": "PHASE 2" } },
            { "name": "Server Estimation", "value": { "minutes": 960 } } ] }
      ] }
  ]
}
```

Notes shown by this payload: stories = **`Subtask` OUTWARD** issues (this report reads them nested — unlike the other two reports, which fetch stories top-level); `state(name)` at top level exists in the request but the reliable value is the custom field; Assignee ALWAYS from customFields (top-level is null).

---

## 4. Categorization — Worked Examples

| Epic | Own state | Stories | Category → Section |
|---|---|---|---|
| PXB1-3120 | Verified | any | **DONE → S0** (epic state wins) |
| PXB1-3101 | OPEN | RE-OPEN, Fixed, OPEN(P2) | **MIXED → S2** (some done, some not) |
| PXB1-3130 | OPEN | 3 stories, none done | **PENDING → S1** |
| PXB1-3155 | OPEN | 0 stories | **NO_STORIES → S3** |
| PXB1-3222 | OPEN, detected as P2-backlog | any | **S4 only** (removed from S1–S3 buckets) |

Every epic lands in exactly one section: `total = S0+S1+S2+S3+S4`.

---

## 5. Effort Rollups — Worked Numbers (epic PXB1-3101, MIXED)

Stories: 3412 (pending P1: 960/480/240), 3390 (done: excluded), 3555 (pending **P2**: excluded from P1 math).

```
S2 row for PXB1-3101:
  Dev = 960  UI = 480  QA = 240  → Total 1680 min = 28.0h / 3.5md
  Spent = pending-P1 story spent = 1110 min = 18.5h
  Summary note: "1 done / 2 pending" · purple tag "1 P2 pending"
```

### Fallback rule example (S1 epic with unestimated stories)

Epic PXB1-3130: pending P1 stories all have 0 estimates, but the epic itself carries `Server Estimation 2400, Testing 720`:

```
rollupP1 = { server: 0→fallback 2400, ui: 0→fallback(epic UI, 0), testing: 0→fallback 720 }
```

Component-wise fallback: only components whose story-sum is 0 fall back to the epic's own field.

### Missing-estimate flag — truth table (`(Dev==0 AND UI==0) OR QA==0` on rollupP1)

| Dev | UI | QA | Flagged? |
|---|---|---|---|
| 2400 | 0 | 720 | No |
| 0 | 480 | 720 | No |
| 0 | 0 | 720 | **Yes** (no dev AND no ui) |
| 2400 | 480 | 0 | **Yes** (no QA) |
| 0 | 0 | 0 | **Yes** |

Flagged rows: orange left border, ⚠ prefix, counted in the top warning bar.

---

## 6. Grand Total — Worked Example

```
S1 (PENDING epics rollupP1 sums):        Dev 180.0h · UI  56.0h · QA  72.0h
S2 (MIXED pending-P1 story sums):        Dev  64.0h · UI  16.0h · QA  24.0h
Grand:                                   Dev 244.0h · UI  72.0h · QA  96.0h
Grand Total = 412.0h  = 412/8 = 51.5md
```

Rendered as the closing bar: `Grand Total (open work) — Dev: 244.0h | UI: 72.0h | QA: 96.0h | Total: 412.0h / 51.5md`. Nothing from S0/S3/S4 enters this figure.

---

## 7. P2 Backlog Detection — Activity API Worked Example

**Step 1 — candidates:** `project: PXB1 TaskType: EPIC Scope: {PHASE 2} #Unresolved` → e.g. 38 epics. Being Phase 2 **now** is not enough.

**Step 2 — history check per candidate:**

```
GET /api/issues/2-46990/activities?categories=CustomFieldCategory
    &fields=timestamp,added(name),removed(name),field(name)
```

```json
[
  { "timestamp": 1751537400000,
    "field":   { "name": "Scope" },
    "removed": [ { "name": "PHASE 1" } ],
    "added":   [ { "name": "PHASE 2" } ] },
  { "timestamp": 1748000000000,
    "field":   { "name": "Priority" },
    "removed": [ { "name": "Medium" } ],
    "added":   [ { "name": "High" } ] }
]
```

Match rule: `field.name === 'Scope'` AND `timestamp > CUTOFF (29 Jun 4PM IST)` AND removed contains "PHASE 1" AND added contains "PHASE 2". Here `1751537400000` = 3 Jul 2026 → **match** → epic is P2 backlog, annotated "→ P2 on 03 Jul 2026".

**Counter-examples:** same change on 15 Jun (≤ cutoff) → not backlog. An epic created directly in Phase 2 (no such activity) → not backlog. A Priority change → ignored (field filter).

**Step 3:** fetch each backlog epic full (as §3) and display only its **open** stories, with a note like "3 done" if some were finished.

---

## 8. Watch List (S5) — Worked Examples

Watch list = S1/S2 epics containing ≥1 Phase 2 story.

| Epic | P1 pending | P2 stories | Row renders |
|---|---|---|---|
| PXB1-3101 (from S2) | 2 | 1 | badge `S2` · "2 P1 remaining" (amber) |
| PXB1-3140 (from S1) | 0 | 3 | badge `S1` · green row · **"✓ Ready to move to P2"** |

"Ready to move" = P1 pending count is exactly 0 → the PM's action is to flip the epic's Scope to Phase 2. Top warning bar aggregates: "2 Phase 1 epics contain Phase 2 stories (S1: 1, S2: 1). ✓ 1 epic(s) ready to move."

---

## 9. Report Layout — Structural Example

Filename `PXB1_Phase1_EffortReport_v16_2026-07-09.html`. All sections collapsible; **all tables column-sortable** (click header; `data-val` attributes carry numeric sort keys; expanded story sub-rows and TOTAL rows keep position rules).

```
Header: "PXB1 Phase 1 — Effort Report" · 09 Jul 2026, 09:25 IST · 72 epics · Man-day=8h
Info bars: scope note · purple P2-contamination warning · orange missing-estimate count
KPI cards: Done(since Jun 29) · Pending · Dev · UI · QA · Pending Total(red)
           · Mixed(P1) · No Stories · P2 Backlog(purple) · Has P2 Stories(violet) · Grand Total
S0 ✓ Completed since 29 Jun      — Epic|Summary(+resolved)|Dev|UI|QA|Total|Spent  + story sub-rows
S1 📋 Has Stories · All Pending  — sorted by Total desc · ⚠/✓ Est column · P2 badges
S2 ⚡ Mixed (Some Done)          — "N done / M pending" notes · pending-P1 sub-rows
S3 🚫 No Stories                 — Epic|Summary|Assignee|Created
S4 📁 P2 Backlog                 — "→ P2 on {date}" · open story sub-rows only
S5 👀 Watch List                 — Epic|Summary|Assignee|P1 Pending|P2 Stories|Action
Grand bar: Dev | UI | QA | Total (hours + man-days)
```

Styling anchors: header `#1a3a5c` · table heads `#2c5282` · Total column `#d6eaf8` · Spent column `#fce4d6` · S4 header `#5b4a8a` · S5 header `#6a1b9a` · grand bar `#154360` · done rows `#f0fff4`. Estimates `X.Xh` with `X.Xd` beneath; every ID links to the tracker.

---

## 10. Acceptance Test Cases (Given / When / Then)

| # | Given | When | Then |
|---|---|---|---|
| T1 | 63 unresolved + 10 recently-resolved, 1 overlap, incl. PXB1-3295 | Discovery | 72 unique IDs, 3295 absent |
| T2 | Epic state "Verified" with pending stories | Categorize | S0 (epic state wins) |
| T3 | Epic 0 stories | Categorize | S3 |
| T4 | Epic some done/some pending | Categorize | S2 |
| T5 | Epic in P2 backlog AND cat PENDING | Sectioning | Appears in S4 only |
| T6 | MIXED epic w/ pending P1 (960/480/240) + pending P2 (960) | S2 math | Row shows 28.0h total; P2 story excluded; purple tag |
| T7 | S1 epic, story ests 0, epic est 2400/0/720 | Rollup | Fallback per component: 2400/0/720 |
| T8 | rollupP1 = 2400/480/0 | Flag | ⚠ missing estimate (QA=0) |
| T9 | rollupP1 = 0/480/720 | Flag | Not flagged |
| T10 | Scope change P1→P2 on 3 Jul | Activity check | In P2 backlog, "→ P2 on 03 Jul" |
| T11 | Scope change P1→P2 on 15 Jun | Activity check | NOT backlog (≤ cutoff) |
| T12 | Epic always Phase 2 | Activity check | NOT backlog (no matching activity) |
| T13 | Watch epic P1 pending = 0 | S5 | Green "✓ Ready to move to P2" |
| T14 | S1 totals 308h + S2 totals 104h | Grand | 412.0h / 51.5md; excludes S0/S3/S4 |
| T15 | Responses return "2-XXXXX" without idReadable | Any fetch | Detect expired token; refresh + re-run affected steps |
| T16 | Click "Total" header in S1 | Sort | Numeric desc/asc via data-val; sub-rows collapse behavior consistent; TOTAL row stays last |
| T17 | Story state "won't fix" | isDone | true (apostrophe handled) |
| T18 | Sum of section counts | Reconcile | = discovered epics (each in exactly one section) |
| T19 | Open offline | Render | Sorting, toggles, all sections work with no network |

---

## 11. Edge Cases & Defensive Rules

- **N+1 pacing:** 72 sequential fetches ≈ 60–90 s. Server port: concurrency pool of 4–6, backoff on 429/5xx; don't hammer the tracker.
- **Activity payloads:** `added`/`removed` can be arrays or missing — guard with `(a.removed||[])`; multiple Scope changes → the rule matches if **any** qualifying change exists after cutoff (use the latest for the display date).
- **Story Scope null** → P1 by definition (`isP1` treats missing scope as Phase 1).
- **Epic Spent vs story spent:** S1 shows the epic's own `Spent time`; story sub-rows show per-story spent captured in step 4/5 — don't sum both.
- **"won't fix"** contains an apostrophe — done-list matching must not break on quoting.
- **HTML-escape** everything; beware summaries with emoji and angle brackets.
- **Baseline constant:** 29 Jun cutoff hard-coded — parameterize for the next baseline; a stale value corrupts S0 and S4 simultaneously.

---

## 12. Suggested Server Test Fixtures

Fixture the §3 full-epic JSON (MIXED with a P2 story), a PENDING epic with zero story estimates (fallback test), the §7 activities array (one qualifying + one non-qualifying change), and an S5 pair (ready / not ready). Assert: categorization table (§4), rollup numbers (§5), Grand Total (§6), backlog membership (§7), and watch-list actions (§8).
