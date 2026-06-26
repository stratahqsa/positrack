# Linking commits to YouTrack tickets

How a developer's commit (often made from **Claude Code**) gets tied to the YouTrack
issue it belongs to. This is an exploration doc — it captures **three approaches**
and how they fit together, with concrete setup for the two we're leaning toward.

**TL;DR:** YouTrack already does commit↔issue linking natively (approach A) — you
*configure* it, you don't build it. The Positrack value-add (approach C) is a
Claude-Code-native nudge that posts the commit onto the ticket the moment a dev
commits, using their own token — so it's logged even before a push, and it fits
Positrack's "capture what you decide" ethos.

---

## Approach A — Native YouTrack ↔ GitHub integration (the backbone)

YouTrack's built-in VCS integration is purpose-built for this. Once a repo is
connected to its YouTrack project, YouTrack will:

- **Auto-link** any commit whose message or **branch name** contains an issue id
  (`IS-123`) — the commit shows up in that issue's **VCS changes / activity** stream.
- **Apply commands** written in commit messages (`#IS-123 Fixed`) on push — moving
  state or adding comments to the referenced issues, no UI needed.
- **Match the commit author by email** to a YouTrack user, so each action is
  attributed to the right person — which lines up exactly with Positrack's
  per-user model.

Docs: [Link Issues in VCS Commits](https://www.jetbrains.com/help/youtrack/cloud/map-issues-to-vcs-change-commit.html) ·
[Apply Commands in VCS Commits](https://www.jetbrains.com/help/youtrack/cloud/apply-commands-in-vcs-commits.html) ·
[GitHub Integration](https://www.jetbrains.com/help/youtrack/cloud/github-integration.html)

### Setup runbook (one-time, per repo, by a YouTrack admin)

1. In YouTrack: **Administration → Integrations → VCS Integrations** (or the project's
   **Settings → VCS Integrations**).
2. **Add integration → GitHub.** Authorize via a GitHub app/token that can read the
   target repository (e.g. `stratahqsa/positrack`, and each dev repo you want linked).
3. Pick the **YouTrack project** the repo maps to (e.g. `IS`, `P8`).
4. Enable **"Process commits"** and, if you want state changes from commits,
   **"Apply commands from commit messages."**
5. Tell devs to **use the same email** in GitHub and YouTrack (or add their GitHub
   username under **Profile → Account Security → VCS usernames** in Hub) so command
   attribution works.

### Developer convention (so the id is always present)

- **Branch naming:** `IS-123-short-description` → YouTrack links every commit on the
  branch to `IS-123` automatically.
- **Commit messages:** mention `IS-123`; optionally `#IS-123 In Progress` to move state.

That's the whole backbone — zero per-commit effort once it's wired up.

---

## Approach C — Claude Code hook + skill nudge (the Positrack layer)

Your devs commit *from Claude Code*. Two complementary mechanisms make linking
effortless and on-brand:

### C1 — A hook that posts the commit onto the ticket immediately

A small script — [`examples/vcs/positrack-commit-link.py`](../examples/vcs/positrack-commit-link.py)
— extracts the issue id from the **branch name or commit message**, and posts a
comment on that YouTrack issue with the short SHA, subject, branch, and repo, using
the developer's **own** `$YT_TOKEN`. It's idempotent (won't double-post a commit) and
no-ops quietly when there's no id.

Wire it up either way:

**As a Claude Code hook** (`~/.claude/settings.json` or project `.claude/settings.json`)
— fires after the agent runs shell commands; the script self-skips unless there's a
fresh commit:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "python3 /ABS/PATH/positrack/examples/vcs/positrack-commit-link.py --auto" }
        ]
      }
    ]
  }
}
```

**Or as a plain git hook** (fires exactly once per commit — lighter):

```bash
ln -s /ABS/PATH/positrack/examples/vcs/positrack-commit-link.py .git/hooks/post-commit
chmod +x .git/hooks/post-commit
# post-commit passes no args; the script defaults to --auto when run as a hook
```

**Manual / ad-hoc** linking is also supported:

```bash
python3 examples/vcs/positrack-commit-link.py link IS-123        # link HEAD to IS-123
python3 examples/vcs/positrack-commit-link.py link IS-123 a1b2c3  # link a specific commit
```

Relationship to approach A: native VCS links commits **on push**; this hook posts a
comment **at commit time** (pre-push), with a human-readable note. Use both, or just
one — they don't conflict (the comment is additive).

### C2 — Skill nudge (capture discipline)

The Positrack skill already prompts users to capture decisions/bugs. Extend that to
commits: after a dev commits without referencing a ticket, the assistant offers, in
one line — *"This commit doesn't reference a YouTrack ticket — which one is it for?
I'll add a note."* — and on a yes, calls `yt_comment` / `yt_cmd`. (This is a small
addition to `skill/positrack/SKILL.md`; not wired in yet — see "Decision" below.)

---

## Approach B — Repo git hooks for "never forget" (noted, not chosen)

A `prepare-commit-msg` hook that reads the branch name (`IS-123-…`) and auto-prepends
`IS-123` to the commit message, so the id is always present for approach A to link.
Cheap insurance; complementary to A. Captured here for completeness.

---

## Recommended path

1. **Stand up approach A** (native integration) as the backbone — biggest payoff,
   no code, correct attribution.
2. **Adopt the C1 hook** for teams that want the commit logged on the ticket the
   instant they commit (and for repos not wired into VCS integration).
3. **Optionally add the C2 skill nudge** so Claude-Code devs are reminded to
   reference a ticket at all.

## Security notes

- The C1 hook uses each developer's **own** token (`$YT_TOKEN` / `/tmp/yt.env`) — it
  only ever acts as that developer; a 403 just means their token lacks rights.
- It posts **comments** (low blast radius, reversible). It never changes state unless
  you extend it to call `yt_cmd`. Tokens are never written to the repo or logs.
