# PXB1 Phase 1 Effort Report (v16) — Requirements in Plain English

**Companion to:** PRD_3_Phase1_Effort_Report_v16.md · **Date:** 2026-07-09

## What this report is

This is the "how much work is actually left?" report. Every morning at 9:20 AM it produces a page that takes every Phase 1 epic in PXB1 and sorts it into one of a handful of buckets — finished, fully pending, partly done, empty — adds up the remaining developer, UI, and QA effort, and ends with one headline figure: the **Grand Total of open work**, in hours and working days (one working day = 8 hours).

It also does two pieces of housekeeping no other report does. It detects epics that were **pushed out of Phase 1 into Phase 2** since the baseline, and it keeps a **watch list** of Phase 1 epics that still have Phase 2 stories tangled inside them.

The baseline moment for everything in this report is **29 June 2026, 4:00 PM Indian time**. The epic PXB1-3295 (POS Android) is always excluded.

## Where the information comes from

The report gathers every Phase 1 epic in PXB1 — open ones plus those resolved since the baseline — and then fetches each epic in full, including all the stories attached beneath it, with their states, estimates ("Server Estimation" for development, "UI Estimation", "Testing Estimation" for QA, all in minutes), and time spent. As everywhere on our tracker, the *real* state and assignee live in our custom fields; the standard built-in fields are empty and must not be trusted.

A story is considered a Phase 1 story unless its Scope explicitly says Phase 2. A story or epic counts as done when its state contains: done, fixed, verified, closed, won't fix, duplicate, or obsolete.

### How "moved to Phase 2" is detected

It is not enough to look at which epics are currently labelled Phase 2 — many were always Phase 2. The report instead reads each Phase 2 epic's **change history** and asks: was there a moment *after 29 June 4 PM* when the Scope changed from Phase 1 to Phase 2? Only those epics count as "P2 backlog" — work we deliberately deferred after the baseline. This distinction matters because the P2 backlog is a record of scope decisions, not a list of everything in Phase 2.

## The six sections

**Section 0 — Completed since 29 June.** Every epic finished after the baseline, with its total estimates and spent time, and its stories expandable underneath. This is the "what we've delivered lately" section.

**Section 1 — All pending.** Epics where nothing is done yet, sorted so the biggest chunks of work come first. Each row shows the epic's remaining developer/UI/QA estimates, total, and time spent. Two flags can appear on a row: an orange warning when the estimates look incomplete — the rule is "no development or UI estimate at all, or no QA estimate" — and a purple tag when the epic contains Phase 2 stories that don't belong in the Phase 1 count.

**Section 2 — Mixed.** Epics where some stories are done and some aren't. Only the *pending Phase 1* stories are counted in the effort figures, and the row notes how many are done versus pending. The pending stories are expandable.

**Section 3 — No stories.** Epics that have no stories attached at all. These are planning gaps: they represent commitments with no work broken down under them, so they need attention.

**Section 4 — P2 backlog.** The epics detected as deferred to Phase 2 after the baseline, each noting the date the scope changed, with their still-open stories expandable.

**Section 5 — Watch list.** Phase 1 epics (from Sections 1 and 2) that contain Phase 2 stories. For each one the report shows how many Phase 1 stories are still pending and how many Phase 2 stories it holds. When the Phase 1 pending count reaches zero, the row turns green and says **"Ready to move to P2"** — the instruction to the project manager is literally that: change the epic's scope to Phase 2, and it will disappear from Phase 1 tracking cleanly.

## The arithmetic that must be right

An epic's remaining effort is the sum of estimates over its pending Phase 1 stories. If the stories carry no estimate for some component, the epic's own estimate for that component is used as a fallback. The **Grand Total** is the Section 1 remaining effort plus the Section 2 pending-Phase-1 effort — nothing else. Done work, empty epics, and anything deferred to Phase 2 are deliberately outside the Grand Total, because the figure answers exactly one question: "if we finish Phase 1 as currently scoped, how much work remains?"

Every epic must land in exactly one section, so the section counts always add up to the total number of epics considered.

## Presentation

A row of summary cards at the top gives the counts and totals at a glance, with the Pending Total in red and the P2 buckets in purple. Every section is collapsible; every table can be sorted by clicking a column header; every epic ID and story ID links to the tracker; every effort figure appears in hours with working days beneath. Notices at the top call out how many epics have incomplete estimates and how many are contaminated with Phase 2 stories.

## Two operational notes

Fetching each epic in full takes about one to one-and-a-half minutes across ~72 epics; a server version can speed this up but shouldn't hammer the tracker. And there is a known symptom of an expired login: the tracker starts returning internal ID numbers (like "2-48123") instead of readable ones (like "PXB1-4567"). When that happens the connection must be refreshed and the affected steps repeated.

## What "done" looks like

The output file is named `PXB1_Phase1_EffortReport_v16_2026-07-09.html` (with the day's date). It is correct when every epic appears in exactly one section, the Grand Total equals Section 1 plus Section 2's pending Phase 1 work, the P2 backlog contains only genuinely deferred epics (verified through change history), and the watch list's "ready to move" flag appears exactly when no Phase 1 work remains.
