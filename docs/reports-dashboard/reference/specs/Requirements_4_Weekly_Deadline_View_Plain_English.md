# PXB1 Phase 1 Weekly Deadline View — Requirements in Plain English

**Companion to:** PRD_4_Phase1_Weekly_Deadline_View.md · **Date:** 2026-07-09

## What this report is

Phase 1 releases go out every Monday. This report, generated every morning at 9:40 AM, organizes all Phase 1 stories by the release week their development deadline falls into, so the team can look at any week — including past ones — and see what was due and where it stands now. It complements the Release Schedule Tracker: that one is organized around epics and milestones for the meeting; this one is organized around stories and calendar weeks for the working team.

## How the weeks work

A "release week" runs **Tuesday through Monday**, ending on the Monday the release ships. Week 1 is fixed: **30 June to 6 July 2026**. Week 2 is 7–13 July, Week 3 is 14–20 July, and so on. The report always shows one section per week, from Week 1 up to and including the week we're currently in — so it grows by one section each week as the phase progresses. Past weeks get red headers (those deadlines are behind us); the current week gets a blue header. Any story whose development deadline predates 30 June is folded into Week 1, and stories whose deadlines fall beyond the current week are left out entirely — this is a view of commitments up to now, not a forecast.

## Which stories appear

A story earns a place in this report only if it is genuinely schedulable and trackable. Four tests, all of which must pass:

The story must be a Phase 1 story in PXB1 (the POS Android epic, PXB1-3295, is excluded as always). It must have **both** a development deadline and a QA deadline set — a story missing either hasn't been properly scheduled, and leaving it out creates the right pressure to fill those fields in. It must carry **at least one estimate** (development, UI, or QA) — an unestimated story can't be tracked for effort. And it must be either still pending, or, if finished, finished **after 29 June 2026, 4:00 PM Indian time** — older completed work belongs to history, not to this view.

Stories are matched to their epics the same way as in the Release Schedule Tracker, including the case where a story's parent is another story rather than the epic itself. Within each week, stories are listed by their QA deadline, earliest first.

## What each row shows

Every story row carries thirteen columns: the story's ID (clickable), title, current state as a colored label, assignee, sprint, the epic it belongs to, the three estimates (development, UI, QA), time spent, the development deadline, the QA deadline, and the resolved date. Finished stories get a green-tinted row, and their resolved date carries a small verdict badge comparing it against the QA deadline — "3d early" in green or "+2d late" in red — so punctuality is visible at a glance without mental date arithmetic.

Any column can be sorted by clicking its header. One subtlety the implementation must honor: when a story has bug rows attached beneath it (see next section), sorting must move the story and its bugs together as a unit, and the totals row must stay at the bottom.

## The bug drill-down

Stories in the RE-OPEN state — the ones QA sent back — show a small bug button. Clicking it expands the open bugs behind that story, found by following the same trail as the Release Schedule Tracker: from the story to its development tickets, and from each development ticket to the bugs reported against it, keeping only bugs that are still open. Each bug row shows the bug's ID, title, state, assignee, priority, and the development ticket it came through.

## Summaries

Across the top of the page, summary cards give the totals: how many stories in view, how many pending versus done, how many open bugs, and the summed development, UI, QA, total estimates and time spent (hours, with 8 hours counting as one working day). Each week section has its own totals row, each week's header carries small count badges (pending / done / bugs), and a footer bar repeats the overall totals at the bottom.

## What "done" looks like

The output file is named `PXB1_WeeklyDeadlineView_2026-07-09.html` (with the day's date). It is correct when: the week boundaries follow the fixed anchor (Week 1 = 30 June–6 July, Tuesday-to-Monday thereafter); every story shown passes all four inclusion tests; early deadlines fold into Week 1 and nothing appears beyond the current week; sorting keeps bugs attached to their stories; and the top cards agree with the sums of the week sections. Like all reports in this family, it is a single self-contained file that opens in any browser without a login.

Note for maintainers: the Week 1 anchor date and the 29 June cutoff are Phase-1-specific and must be re-anchored (ideally made configurable) when Phase 2 begins.
