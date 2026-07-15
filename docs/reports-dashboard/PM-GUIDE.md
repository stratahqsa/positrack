# POSX Reports Dashboard — Project Manager's Guide

**Audience:** Suhail (PM), now the owner of this dashboard.
**You do not need to be a developer.** This guide covers using it, changing it
(with Claude), and owning the merge process — in plain language.

---

## 0. The 10-second version

- **Live link:** https://posxphase1.positrack.live · **access code:** `posx2026`
- It replaces the 4 daily HTML reports you used to post in the PosiboltX Admin
  WhatsApp group. **One link, always current, filterable, drill-downable.**
- Data refreshes **automatically every night** from YouTrack. You don't maintain it.
- To change something, you **ask Claude** (see §4) and **merge the PR** (see §5).

---

## 1. Using the dashboard

Open the link, enter the code once (it remembers you). Five tabs across the top:

| Tab | Answers |
|---|---|
| **Health** | "Is Phase 1 on track?" — the landing page. On-track/At-risk/Behind verdict + effort, deadline, and bug tiles. Start here. |
| **Weekly Deadline** | What's due each release week, sortable, with re-opened stories expandable to their bugs. |
| **Release Schedule** | Epics grouped by milestone, done vs not-done against the meeting baseline. Drill epic → story → bug. |
| **Bug Analysis** | New bugs in the window, older open High-priority bugs, state breakdowns, which modules are hottest. |
| **Effort** | The 6-section epic effort tracker (done / pending / mixed / P2 backlog / watch-list) + grand total. |

**Things worth knowing:**
- **Filters** (Weekly & Schedule): the filter bar writes to the URL, so a filtered
  view is **shareable** — copy the address bar and the person sees the same filter.
- **Drill-downs:** click the ▸ chevron / 🐛 badge to expand. Sorting keeps sub-rows
  attached to their parent.
- **Theme + clock:** sun/moon toggles light/dark; the header shows SAST + IST time and
  the snapshot's "as of" time.
- **Sharing:** send the **link + code** in WhatsApp. It's gated — nothing is public.

---

## 2. The one mental model: the dashboard is a *mirror*, not a *source*

This is the single most important thing to understand.

```
YouTrack (support.posibolt.com)  ──►  Python scripts compute ONE snapshot (nightly)
                                              │
                                              ▼
                                      published to Vercel Blob (a file)
                                              │
                                              ▼
                              The dashboard just DISPLAYS that file.
```

The dashboard **never talks to YouTrack directly** and **never calculates numbers
itself**. Every number you see was computed the night before by the Python layer and
frozen into a snapshot. So when a number looks wrong, the first question is always:

> **Is this a DATA problem or a DISPLAY problem?**
> - **Data problem** (wrong number, missing issue, wrong count) → the fix is in the
>   **Python** layer (`scripts/reports/`), and you must **re-run the snapshot** to see it.
> - **Display problem** (layout, color, sorting, a typo, a broken button) → the fix is
>   in the **dashboard** (`dashboard/`), and it shows on the next deploy.

You don't need to know which yourself — **Claude figures this out** — but knowing the
distinction helps you describe the problem.

---

## 3. Refreshing the data (usually automatic)

- **Automatic:** a scheduled job runs **nightly at 02:00 UTC** — pulls YouTrack, builds
  the snapshot, publishes it. By morning the dashboard is current. You do nothing.
- **On demand** (if you need it fresh *right now*): on GitHub, go to
  **Actions → "Snapshot" → Run workflow → branch `master` → Run**. ~6 minutes later the
  dashboard shows the new numbers (no redeploy needed).
- **"Data as of HH:MM"** in the header tells you how fresh the current numbers are.

---

## 4. Changing or fixing something — with Claude (your Pro license)

You have a Claude Pro license. That gives you **Claude Code**, which can edit this
project directly. The workflow is always the same four steps:

**1. Open the project with Claude Code.** (One-time setup: install Claude Code, clone
the repo `stratahqsa/positrack`, open the folder. Ask Claude "help me set up Claude
Code for this repo" if stuck.)

**2. Tell Claude what's wrong or what you want**, in plain English. Examples:
   - *"The Bug Analysis page shows the wrong total for open High bugs — it should be X."*
   - *"Add a column for 'Reporter' to the Weekly Deadline table."*
   - *"The Effort page's grand total looks too high — check the math."*
   - *"Change the access code from posx2026 to something new."*

**3. The golden rule — point Claude at the guide first.** Start your message with:
   > *"Read `dashboard/CLAUDE.md` first, then …"*
   That file is the internals manual — it tells Claude the architecture, the YouTrack
   quirks, and how to add/change reports safely. It prevents most mistakes.

**4. Let Claude make the change, test it, and open a Pull Request.** Ask it to
   *"run the tests and open a PR when it's green."* Then you review + merge (§5).

**What Claude will handle for you:** deciding data-vs-display, writing the code, running
the 140 automated tests, checking the build, and opening the PR. **Always ask it to
verify in the browser** before it says it's done — *"show me it working."*

---

## 5. You're in charge of Pull Requests now

The goal: **Mohamed is hands-off.** You open changes as Pull Requests and **merge them
yourself** once they're safe. "Safe" is defined mechanically so you don't have to be a
code reviewer:

**A PR is safe to merge when:**
1. ✅ **CI is green** — the "test" check passes automatically (this is *required* by the
   repo; a red PR literally cannot be merged). This runs the engine tests.
2. ✅ **Claude showed you it working** — a screenshot or description of the change live.
3. ✅ It does what you asked and nothing surprising in the summary.

**To merge:** open the PR on GitHub → wait for the green ✅ check → click **"Merge pull
request"** → **Confirm**. That's it. (Deleting the branch after is optional/tidy.)

**When NOT to merge / ask first:** database or auth changes, anything touching the shared
engine (`core/`, `cli/`), or if CI is red and Claude can't explain why. When unsure,
it's fine to leave it and ask Mohamed — but for normal report tweaks, you're clear.

> **Note for the deploy:** today the live site is deployed manually via the Vercel CLI, so
> merging a PR updates the *code* but doesn't auto-update the live site yet. Ask Claude to
> *"deploy the reports dashboard"* after merging a UI change, or have Mohamed connect Git
> auto-deploy once (`vercel git connect`) so merges deploy themselves. **Data changes do
> NOT need a deploy** — they flow through the nightly snapshot automatically.

---

## 6. Re-baselining for Phase 2 (or another project)

The dashboard is config-driven. To point it at Phase 2 (or change dates/scope), edit
**`web/config/reports.json`** (`project`, `scope`, `week1_anchor`, cutoff dates, excluded
IDs) and re-run the Snapshot job — **no code change needed.** Ask Claude: *"re-baseline the
reports config for Phase 2"* and it'll walk you through the JSON.

---

## 7. When something looks broken

| Symptom | Likely cause | What to do |
|---|---|---|
| Numbers look a day old | Nightly hasn't run / you want it now | Run the "Snapshot" workflow (§3) |
| A number is wrong | Data (Python) or display (dashboard) bug | Ask Claude, name the exact number + view |
| Site won't load / login fails | Access code or deploy issue | Check the code is `posx2026`; ask Claude to check the deploy |
| A page says "no data / not configured" | Snapshot missing a block | Re-run the Snapshot workflow |
| Someone shouldn't have access | Code is shared too widely | Ask Claude to rotate `ACCESS_CODE` |

---

## 8. Where the deeper docs live (for Claude, and the curious)

- **`dashboard/CLAUDE.md`** — the internals + "how to add a report" recipe. *The* reference.
- **`docs/reports-dashboard/HANDOFF.md`** — full technical state (deploy, data pipeline, Blob).
- **`docs/reports-dashboard/DESIGN-SPEC.md`** — the approved design decisions.
- **`docs/reports-dashboard/reference/specs/`** — the original report requirements (the
  ground truth for what each report should show).

You don't need to read these — **Claude does.** Just point it at `dashboard/CLAUDE.md`
first and describe what you want.
