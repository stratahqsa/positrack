# Install Positrack for Gemini

Positrack is a talk-to-it front-end for Posibolt's YouTrack
(`https://support.posibolt.com`). On Gemini there are two ways to use it — pick by
whether you can open a terminal.

> **Heads up:** the **consumer Gemini app** (Gemini Advanced / "Gemini Pro" on the
> web or phone) **cannot connect a custom MCP server**, so it has **no live access
> to YouTrack**. If you want Positrack to actually read and change tickets on
> Gemini, you need the **Gemini CLI** (option A). Option B is a knowledge-only
> "Gem" — it teaches and drafts, but cannot touch the board.

---

## What you need first: your own YouTrack token

Every user authenticates with **their own** YouTrack permanent token — never a
shared one. It carries your own permissions, which safely bounds what Positrack
can do.

1. In YouTrack: profile avatar → **Account Security** → **New permanent token**.
2. Scope: **YouTrack**. Copy it — it starts with `perm-`.
3. Keep it private. Never paste it into a chat, a commit, or a report.

A `403` later just means your token lacks that permission (you may need a
lead/admin token) — that's expected, not a bug.

---

## A. LIVE — Gemini CLI (recommended)

This is the real thing: Gemini calls the deployed Positrack MCP server and works
with live YouTrack data. Recommended for anyone comfortable with a terminal.

### 1. Install the CLI

```bash
npm install -g @google/gemini-cli
```

### 2. Add the Positrack server

Your YouTrack token rides in the `Authorization` header — read fresh per request,
never stored or logged by the server. Replace `<YT token>` with your `perm-...`
token and `positrack.up.railway.app` with the deployed app host.

```bash
gemini mcp add --transport http \
  --header "Authorization: Bearer <YT token>" \
  positrack https://positrack.up.railway.app/mcp
```

`/mcp` is the recommended **streamable HTTP** endpoint. (An `/sse` endpoint exists
for older clients if you ever need it.)

### 3. Confirm it's connected

```bash
gemini
```

Then inside the session:

```
/mcp
```

You should see **positrack** listed as **CONNECTED** with its 24 tools (16 read,
8 write).

### 4. Try a read

Just ask in plain English — Gemini routes it to the right tool:

```
> Who am I in YouTrack?
> What's unresolved in Integration Support, assigned to me?
> Weekly briefing on P8 for the last 7 days.
```

`Who am I` calls `yt_whoami` and confirms your token works end to end.

### Equivalent settings.json

`gemini mcp add` writes this into `~/.gemini/settings.json`. You can edit it by
hand instead — same result:

```json
{
  "mcpServers": {
    "positrack": {
      "httpUrl": "https://positrack.up.railway.app/mcp",
      "headers": {
        "Authorization": "Bearer <YT token>"
      }
    }
  }
}
```

### Writes are safe by default

The 8 write tools (`yt_create`, `yt_update`, `yt_cmd`, `yt_comment`, `yt_log`,
`yt_attach`, `yt_reassign`, `yt_article_create`) default to **preview, not apply**.
Positrack returns a non-mutating preview first; nothing changes until you confirm
and it re-runs with `commit=true`. So "create a bug for the ZATCA crash" shows you
the draft before anything lands on the board.

---

## B. FALLBACK — a knowledge-only "Gem" (consumer app)

If you can't use a terminal and only have the consumer Gemini app, you can build a
**Gem** that knows Positrack's commands and YouTrack query syntax. Import the pack
in [`docs/gem/`](./gem/):

1. Open Gemini → **Gems** → **New Gem** (Gem manager).
2. Paste the contents of the Gem **instructions** file from `docs/gem/` into the
   instructions box.
3. Upload as **Knowledge**:
   - `SKILL.md` (Positrack's voice and command surface)
   - `query_cookbook.md` (YouTrack query syntax + ready-made queries)
4. Save the Gem.

**What it can and cannot do — be clear-eyed:**

- It **cannot call YouTrack live.** No reads, no writes, no real ticket data.
- It's a **teach-the-syntax / drafting** helper: it can explain how to phrase a
  query, draft a ticket or comment, and tell you exactly which command to run.
- Workflow is **manual copy-paste**: you paste issue data in, it reasons over it
  and hands you back a query or a draft to run elsewhere (CLI, the YouTrack web
  UI, or Claude).

Use the Gem when you have no terminal; switch to the Gemini CLI (option A) the
moment you can — that's the only Gemini path with live YouTrack.

### Org alternative: Vertex AI / Gemini Enterprise

If Posibolt provisions Gemini at the organisation level, the enterprise path runs
through **Vertex AI / Gemini Enterprise**, where admins can wire managed tool/MCP
integrations centrally. That's an org-admin project, not an individual setup — out
of scope for this guide, but the place to look if you want live Gemini access
without the CLI.

---

## Note: YouTrack's own MCP

JetBrains now ships an official **YouTrack Remote MCP server** (2025.3, Oct 2025).
Positrack complements it rather than duplicating it: it adds the assistant layer
(plain-English routing, capture-nudging), **preview→commit safety on every write**,
location/briefing reports, reaches this self-hosted instance, and runs the **same
engine** as the Positrack CLI and Claude skill.
