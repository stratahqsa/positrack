# PXB1 Phase 1 Release Schedule Tracker — Requirements in Plain English

**Companion to:** PRD_2_Phase1_Release_Schedule_Tracker.md · **Date:** 2026-07-09

## What this report is

This is the report we bring to the release-schedule meeting. Every morning at 9 AM it produces a dark-themed page that lays out every Phase 1 epic in the PXB1 project, grouped by the release date it is committed to, and shows plainly: is it done, is it not done, was it finished on time or late, and what work is still hanging off it. Like the other reports in this family, it is a single file that opens in any browser without logging in.

The report is anchored to two reference moments. The **meeting baseline** is 3 July 2026, 4:00 PM Indian time — "since the meeting" always means after this moment. There is also an earlier marker, 29 June 2026, 4:00 PM Indian time, used only to decide which stories are still worth showing under epics that are already finished (so a finished epic still lists its recently finished stories rather than showing up empty).

One epic, PXB1-3295 (POS Android), is permanently excluded from this report by agreement.

## Where the information comes from

Everything comes from the PXB1 project in our tracker, restricted to items whose Scope is "PHASE 1". The report collects all Phase 1 epics (open ones, plus any resolved since June), and separately collects all Phase 1 stories, then works out which story belongs to which epic.

That matching deserves a plain explanation because our tracker data isn't perfectly tidy. Most stories are linked directly underneath their epic. But some stories are children of *other stories*. The report handles both: first it matches every story that hangs directly off an epic; then, for a story whose parent is another story, it inherits that parent's epic. Stories that still can't be traced to any epic are counted quietly as "orphans" so we can spot data-hygiene problems, but they aren't displayed.

Two more tracker quirks that a rebuild must respect: the "state" a bug or story shows on its face in the tracker's standard field is always empty on our server — the real state lives in our custom State field. And the estimates live in three custom fields: "Server Estimation" (developer time), "UI Estimation", and "Testing Estimation" (QA time), all recorded in minutes, with 480 minutes counting as one working day.

## How the report judges "done"

A story counts as done when its state contains any of: done, fixed, verified, closed, won't fix, duplicate, or obsolete. An epic's badge follows from its stories: if every story is done the epic shows a green "DONE"; if anything is pending it shows a red "NOT DONE"; if the epic has exactly one story, we just show that story's actual state, which is more informative; and an epic with no stories at all says so. An epic that was itself marked resolved after the meeting counts as done regardless.

For a done epic, the report also shows *when* it was effectively finished — the date its last story was resolved — colored green if that was on or before its deadline, red if it slipped past.

## How epics are grouped into milestones

Each epic's release milestone is simply the latest deadline among its stories (whichever is later of the development deadline and the QA deadline). Epics are then grouped under those milestone dates, earliest first, and only milestones from 3 July 2026 onward are displayed. Each milestone header summarizes what's beneath it — how many epics and stories, and if the group is mixed, how many are pending versus done — along with totals of the estimated developer, UI, and QA time and the time spent. Milestone headers are color-coded by urgency: the closer (or more overdue) the date, the deeper the red; comfortably distant dates are green; and a milestone whose epics are *all* done turns fully green regardless of date.

Anything created after the meeting baseline gets a small purple "NEW" tag, so the meeting can immediately see what was added since we last talked.

## What each row shows

Under every epic you can expand its stories. Which stories appear depends on the epic: a not-done epic shows its pending stories plus anything finished since the meeting (so progress since the meeting is visible); a done epic shows only what was finished since 29 June. Every row carries the same columns: the item's ID (clickable), title, state, assignee, the three estimates, time spent, the development deadline, the QA deadline, resolved date, and sprint. The epic-level totals are deliberately calculated from *pending* stories only — they answer "how much is left", not "how big was this ever".

## The bug drill-down

Stories in the RE-OPEN state are the ones QA bounced back, so the meeting always wants to know: bounced back *why*? For every RE-OPEN story the report walks the trail our team uses in the tracker — the story's development tickets, and from each development ticket the bugs reported against it — and gathers the bugs that are still open. Each RE-OPEN story row gets a small bug button that expands a third level of rows showing each open bug's ID, title, state, assignee, priority (color-coded), and which development ticket it came through.

## What "done" looks like

The output file is named `PXB1_ReleaseSchedule_MtgTracking_2026-07-09.html` (with the day's date). It is correct when: the excluded epic never appears; every epic sits under exactly one milestone; done/not-done badges agree with the states of the stories underneath; the "remaining effort" totals only count pending work; every RE-OPEN story can be expanded to its open bugs; and finished epics show green or red resolved dates that correctly reflect early or late delivery.

Note for maintainers: the two baseline dates are fixed constants for the current meeting cycle. When the team holds a new baseline meeting, these dates must be updated — ideally they become a setting rather than a hard-coded value.
