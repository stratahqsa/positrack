# PXB1 Bug Analysis Report — Requirements in Plain English

**Companion to:** PRD_1_PXB1_Bug_Analysis_Report.md · **Date:** 2026-07-09

## What this report is

Every morning at 10 AM, the team gets a single web page that summarizes the bug situation in the PXB1 project. It is built for the daily QA and triage routine. Anyone can open the file in a browser — no login, no internet connection needed — and it looks the same whether it was opened today or archived and opened six months from now.

The report answers four everyday questions. What new bugs did QA raise since yesterday morning? Which serious (High priority) bugs are still sitting open from before? Where exactly are all the open Medium and Low bugs stuck in our workflow? And which parts of the product have been generating the most bugs over the past week?

## Where the information comes from

All data comes from our issue tracker (YouTrack at support.posibolt.com), from the PXB1 project only. One important detail about how our tracker is set up: PXB1 does not use the tracker's built-in "Type" label to mark something as a bug. Instead we use our own field called **TaskType**. Whoever rebuilds this report must filter on TaskType being "BUG". If they use the standard Type field instead, the report will quietly miss most bugs and nobody will notice — this is the single most common mistake to guard against.

For every bug the report picks up its ID number, title, when it was created, its current state (like OPEN or TESTING), its priority (High, Medium, Low), the module it belongs to, who it is assigned to, and who reported it.

## The reporting window — "since the start of yesterday"

The first section covers what QA reported recently, and "recently" has a precise meaning: from **midnight at the start of yesterday (Indian time) right up to the moment the report is generated**. So it is more than a single day. If the report runs at 4 PM on Tuesday, the window is Monday 12:00 AM through Tuesday 4:00 PM. This deliberate overlap means a bug reported late in the evening never falls between the cracks of two consecutive daily reports.

## What the report shows, top to bottom

**A row of headline numbers.** Across the top: how many new High and Medium bugs came in during the window, how many High / Medium / Low bugs are open in total, the overall open bug count, and how many different modules were hit in the last seven days. This is the ten-second read for a manager.

**Section 1 — QA bugs reported in the window.** A dark-red section listing every unresolved bug created inside the window, split into High, then Medium, then Low priority, oldest first. Each row shows the bug's ID (clickable, opens the tracker), its title, when it was created (date and time, Indian time), its state shown as a small colored label, the assignee, the module, and the reporter.

**Section 2 — older High-priority bugs still open.** A red section with exactly the same columns, but showing High-priority bugs that were created *before* the window and are still not fixed. Together, Sections 1 and 2 account for every open High bug exactly once — nothing is double-counted and nothing is dropped.

**Section 3 — where the Medium and Low bugs are stuck.** An amber section with two panels side by side, Medium on the left and Low on the right. Each panel counts the open bugs by workflow state (OPEN, DEVELOPMENT, TESTING, and so on) and shows a count, a small bar, and a percentage for each state. This makes it obvious at a glance whether bugs are piling up waiting for developers, or waiting for QA, or ready to deploy.

**Section 4 — module insights for the last seven days.** An indigo section listing each product module with its bug count for the week, busiest module first. Next to each module are small purple tags naming the specific screens or features (submodules) inside it that got the most bugs, with a count on each tag — up to eight tags per module.

### How the report figures out the "submodule"

Our QA team writes bug titles in a consistent shape: "Module: Submodule - description of the problem". The report takes the text after the first colon and cuts it off at the first dash of any kind (our team variously types a plain hyphen, an en-dash, or an em-dash — all three must be treated the same). For example, "Settings: Register- Placeholder text missing" counts as one bug against the submodule "Register". If a title has no dash, everything after the colon is used; if it has no colon at all, that bug simply isn't counted in the submodule tags.

## Rules of presentation

Every section can be collapsed or expanded by clicking its header. Priority is always color-coded the same way: red for High, orange for Medium, green for Low. Workflow states get colored labels too — reddish for OPEN, orange for RE-OPEN, blue for development stages, purple for testing stages, green for anything done or ready to deploy. Created dates and times are always shown in Indian time in the form "08 Jul 2026, 4:35 PM".

## One technical quirk worth recording

When asking the tracker for "the last 7 days" of bugs, the shorthand relative date ("-7d") does not work on our server — it returns an error. The report must calculate the actual calendar date seven days ago and use that instead.

## What "done" looks like

The output is one file named `PXB1_BugAnalysis_2026-07-09.html` (with the day's date). It is correct when: its counts match what a manual search in the tracker shows for the same window; every open High bug appears exactly once across Sections 1 and 2; each state-breakdown panel's percentages add up to about 100%; and the submodule tags never contain leftover description text.
