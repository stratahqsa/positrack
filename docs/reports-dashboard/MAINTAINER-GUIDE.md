# POSX Reports Dashboard — Maintainer's Guide

**Who this is for:** anyone who runs, changes, or approves changes to this dashboard.
**You do not need to be a developer.** This guide covers using it, changing it (with
Claude), and the review/merge process — in plain language.

**The three roles** (a person can hold more than one):
- **Viewer** — anyone on the team; just opens the link and reads it.
- **Maintainer** — anyone given repo access; makes changes/fixes (with Claude) and opens
  Pull Requests. Requires a GitHub account added to the repo (see §5).
- **Approver** — the designated person who reviews, approves, and merges Pull Requests.
  This is the quality gate so the owner can stay hands-off. Currently: the PM.

---

## 0. The 10-second version

- **Live link:** https://posxphase1.positrack.live · **access code:** `posx2026`
- It replaces the 4 daily HTML reports that used to be posted in the PosiboltX Admin
  WhatsApp group. **One link, always current, filterable, drill-downable.**
- Data refreshes **automatically every hour** from YouTrack. Nobody maintains it by hand.
- To change something: a **maintainer** asks Claude (§4) and opens a PR; the **approver**
  merges it once CI is green (§5).

---

## 1. Using the dashboard (viewers)

Open the link, enter the code once (it remembers you). Five tabs across the top:

| Tab | Answers |
|---|---|
| **Health** | "Is Phase 1 on track?" — the landing page. On-track/At-risk/Behind verdict + effort, deadline, and bug tiles. Start here. |
| **Weekly Deadline** | What's due each release week, sortable, with re-opened stories expandable to their bugs. |
| **Release Schedule** | Epics grouped by milestone, done vs not-done against the meeting baseline. Drill epic → story → bug. |
| **Bug Analysis** | New bugs in the window, older open High-priority bugs, state breakdowns, which modules are hottest. |
| **Effort** | The 6-section epic effort tracker (done / pending / mixed / P2 backlog / watch-list) + grand total. |

**Worth knowing:**
- **Filters** (Weekly & Schedule) write to the URL, so a filtered view is **shareable** —
  copy the address bar and the recipient sees the same filter.
- **Drill-downs:** click the ▸ chevron / 🐛 badge to expand. Sorting keeps sub-rows
  attached to their parent.
- **Theme + clock:** sun/moon toggles light/dark; the header shows SAST + IST and the
  snapshot's "as of" time.
- **Sharing:** send the **link + code**. It's gated — nothing is public.

---

## 2. The one mental model: the dashboard is a *mirror*, not a *source*

The single most important thing to understand.

```
YouTrack (support.posibolt.com)  ──►  Python scripts compute ONE snapshot (hourly)
                                              │
                                              ▼
                                      published to Vercel Blob (a file)
                                              │
                                              ▼
                              The dashboard just DISPLAYS that file.
```

The dashboard **never talks to YouTrack directly** and **never calculates numbers
itself**. Every number was computed by the Python layer at snapshot time and frozen.
So when a number looks wrong, the first question is always:

> **Is this a DATA problem or a DISPLAY problem?**
> - **Data** (wrong number, missing issue, wrong count) → fix is in the **Python** layer
>   (`scripts/reports/`), and you must **re-run the snapshot** to see it.
> - **Display** (layout, color, sorting, a typo, a broken button) → fix is in the
>   **dashboard** (`dashboard/`), visible on the next deploy.

You don't have to know which — **Claude figures it out** — but naming the exact number
and view helps.

---

## 3. Refreshing the data (usually automatic)

- **Automatic:** a scheduled job runs **hourly** — pulls YouTrack, builds the snapshot,
  publishes it. The dashboard is at most ~1 hour behind on its own.
- **On demand** (fresh *right now*): GitHub → **Actions → "Snapshot" → Run workflow →
  branch `master` → Run**. ~6 min later the dashboard shows the new numbers (no redeploy).
- **"Data as of HH:MM"** in the header tells you how fresh the current numbers are.

---

## 4. Changing or fixing something — with Claude

Maintainers use a Claude license (Pro or better) and **Claude Code**, which edits this
project directly. The workflow is always the same four steps:

**1. Open the project with Claude Code.** One-time: install Claude Code, clone
`stratahqsa/positrack`, open the folder. (Stuck? Ask Claude "help me set up Claude Code
for this repo.")

**2. Tell Claude what's wrong or what you want**, in plain English:
   - *"The Bug Analysis page shows the wrong total for open High bugs — it should be X."*
   - *"Add a 'Reporter' column to the Weekly Deadline table."*
   - *"The Effort grand total looks too high — check the math."*
   - *"Change the access code from posx2026 to something new."*

**3. The golden rule — point Claude at the guide first.** Start with:
   > *"Read `dashboard/CLAUDE.md` first, then …"*
   That's the internals manual (architecture, YouTrack quirks, how to add/change reports
   safely). It prevents most mistakes.

**4. Have Claude make the change, test it, and open a Pull Request** — *"run the tests
and open a PR when it's green."* Then the approver reviews + merges (§5). **Always ask
Claude to verify in the browser** before it calls it done — *"show me it working."*

---

## 5. The review & merge process (approver-gated)

The goal: **the owner is hands-off.** Maintainers open Pull Requests; the **approver**
merges them once safe. "Safe" is defined mechanically so the approver doesn't have to be
a code reviewer:

**A PR is safe to merge when:**
1. ✅ **CI is green** — the required `test` check passes automatically. A red PR *cannot*
   be merged (enforced by the repo).
2. ✅ **Claude showed it working** — a screenshot or description of the change live.
3. ✅ It does what was asked, with nothing surprising in the summary.

**To merge (approver):** open the PR on GitHub → wait for the green ✅ → (optionally click
**"Review changes → Approve"**) → **"Merge pull request" → Confirm**. Deleting the branch
after is optional/tidy.

**Ask the owner first / don't merge:** database or auth changes, anything touching the
shared engine (`core/`, `cli/`), or CI red that Claude can't explain. Normal report tweaks
are fine to merge.

> **Access & enforcement (owner sets this once):**
> - Add each **maintainer** as a repo collaborator with **Write** access
>   (repo **Settings → Collaborators → Add people**). Write lets them push branches and
>   open PRs.
> - The repo already **requires the `test` check to pass** before any merge.
> - To *enforce* the approver step (so no one self-merges without review), set
>   **Settings → Branches → master → Require a pull request before merging → Require
>   approvals = 1**, and have the approver be the one to approve. Leave at 0 if you prefer
>   convention over enforcement.

> **Deploys:** the live site is deployed via the Vercel CLI, so **merging a PR updates the
> code but not the live site yet.** After merging a UI change, ask Claude to *"deploy the
> reports dashboard"*, or connect Git auto-deploy once (`vercel git connect`) so merges
> deploy themselves. **Data changes need no deploy** — they flow through the hourly snapshot.

---

## 6. Re-baselining for Phase 2 (or another project)

Config-driven. To point at Phase 2 (or change dates/scope), edit
**`web/config/reports.json`** (`project`, `scope`, `week1_anchor`, cutoff dates, excluded
IDs) and re-run the Snapshot job — **no code change needed.** Ask Claude: *"re-baseline
the reports config for Phase 2."*

---

## 7. When something looks broken

| Symptom | Likely cause | Do this |
|---|---|---|
| Numbers look old | Hourly job hasn't run / you want it now | Run the "Snapshot" workflow (§3) |
| A number is wrong | Data (Python) or display (dashboard) bug | Ask Claude; name the exact number + view |
| Site won't load / login fails | Access code or deploy issue | Check the code is `posx2026`; ask Claude to check the deploy |
| A page says "no data / not configured" | Snapshot missing a block | Re-run the Snapshot workflow |
| Someone shouldn't have access | Code shared too widely | Ask Claude to rotate `ACCESS_CODE` |

---

## 8. Deeper docs (for Claude, and the curious)

- **`dashboard/CLAUDE.md`** — internals + "how to add a report" recipe. *The* reference.
- **`docs/reports-dashboard/HANDOFF.md`** — full technical state (deploy, data pipeline, Blob).
- **`docs/reports-dashboard/DESIGN-SPEC.md`** — the approved design decisions.
- **`docs/reports-dashboard/reference/specs/`** — the original report requirements.

You don't need to read these — **Claude does.** Point it at `dashboard/CLAUDE.md` first
and describe what you want.
