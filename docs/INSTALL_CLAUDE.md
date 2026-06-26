# Install Positrack for Claude

Positrack gives Claude a talk-to-it front-end for Posibolt's YouTrack
(`https://support.posibolt.com`): ask in plain English, get briefings, and
create/update tickets — with **preview → confirm → commit** safety on every write.

There are two ways to run it. **The skill (Path A) is the richest and recommended
path** — it's the full assistant (capture-nudging, briefings, reports, the query
cookbook). Path B (the MCP connector) is a lighter option that points Claude at
the shared engine running on Railway.

Either way, **you use your own YouTrack token** — never a shared one. Your token
carries your own permissions, so Positrack can only do what your account already
allows. A `403` just means your token lacks that permission (you may need a
lead/admin token) — that's expected, not a bug.

---

## Path A — The skill (recommended)

### A1. Install from the plugin marketplace (one-time per user)

```
/plugin marketplace add stratahqsa/positrack
/plugin install positrack@groworx
```

Later, pull updates with:

```
/plugin update
```

That's the whole install. The skill auto-loads whenever you ask about Posibolt
tickets, projects, boards, briefings, or "what's stuck this week."

### A1 (alternative). Local install, no marketplace

If you'd rather install from the packaged archive (e.g. you don't have
marketplace access), unzip `dist/positrack.skill` into your Claude skills folder
so you end up with `~/.claude/skills/positrack/SKILL.md`:

```
mkdir -p ~/.claude/skills
unzip dist/positrack.skill -d ~/.claude/skills/
ls ~/.claude/skills/positrack/SKILL.md   # confirm it's there
```

### A2. Add your YouTrack token (one-time)

1. In YouTrack: click your **profile avatar → Account Security → New permanent
   token**, scope **YouTrack**, and copy it (it starts with `perm-`).
2. Make it available to the skill's scripts in **one** of these ways:

```
export YT_TOKEN='perm-...'
```

or write it to a session file (and lock it down):

```
echo 'YT_TOKEN=perm-...' > /tmp/yt.env
chmod 600 /tmp/yt.env
```

Never commit the token, paste it into a report, or store it in memory — it stays
local to you.

### A3. Verify

```
python3 scripts/yt.py whoami
```

If that returns your YouTrack identity, you're connected. Try a real query:

```
python3 scripts/yt.py report mywork
```

---

## Path B — MCP custom connector (shared engine)

Prefer not to install the skill locally? Point Claude at the deployed Positrack
MCP server instead. Same engine as the CLI and skill — 24 tools (16 read, 8 write).

1. Open **Settings → Connectors** and choose **Add custom connector**.
2. Set the URL to the deployed server (streamable HTTP, recommended):

   ```
   https://positrack.up.railway.app/mcp
   ```

   (An SSE endpoint at `https://positrack.up.railway.app/sse` is also available for older
   connector paths.)
3. For per-user auth, the connector passes your token as a header:

   ```
   Authorization: Bearer perm-...
   ```

   Use the **same** YouTrack permanent token from step A2 (`perm-...`).

### Write previews

Every write tool (`yt_create`, `yt_update`, `yt_cmd`, `yt_comment`, `yt_log`,
`yt_attach`, `yt_reassign`, `yt_article_create`) defaults to `commit=false` and
returns a **non-mutating preview** of exactly what it would change. Claude shows
you the preview; nothing is written until you confirm and it calls again with
`commit=true`. Read tools (e.g. `yt_whoami`, `yt_search`, `yt_report`) return data
directly.

---

## A note on YouTrack's official MCP

JetBrains ships its own **YouTrack Remote MCP server** (2025.3+). Positrack is
complementary, not a duplicate: it adds the assistant layer (plain-English
routing, capture-nudging), preview→commit safety on every write, location/briefing
reports, self-hosted reach, and runs the same engine that powers the Positrack CLI
and Claude skill.
