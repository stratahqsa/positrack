# Positrack MCP server

Wraps the shared `core/ytcore.py` engine as Model Context Protocol tools so
**Claude, ChatGPT (Developer Mode), and Gemini CLI** can act on the Posibolt
YouTrack instance. Same engine as the CLI and the Claude skill — never forked.

## Auth model (per-user, never shared)

Every call uses the **caller's own** YouTrack permanent token. Nothing is baked in.

- **Remote (HTTP):** the token rides in the request header
  `Authorization: Bearer perm-…`, read fresh per request, turned into a
  `ytcore.Ctx`, and **never stored or logged**.
- **Local (stdio):** the token comes from the user's own `$YT_TOKEN`.

A `403` means the token lacks permission — expected, not a bug (use a lead/admin
token for admin-only features). Write tools default to `commit=false` and return a
non-mutating **preview**; only `commit=true` applies.

## Tools

16 reads (`yt_whoami, yt_projects, yt_describe, yt_count, yt_search, yt_get,
yt_history, yt_report, yt_boards, yt_users, yt_orphans, yt_load, yt_articles,
yt_article, yt_tags, yt_saved`) and 8 writes (`yt_create, yt_update, yt_cmd,
yt_comment, yt_log, yt_attach, yt_reassign, yt_article_create`).

## Run locally

**stdio** (Claude Desktop/Code, Gemini CLI on your machine):

```bash
pip install -r mcp/requirements.txt
export YT_TOKEN='perm-...'          # your own token
python mcp/server.py                 # stdio (default)
```

**HTTP (dual transport)** — streamable HTTP at `/mcp`, SSE at `/sse`, health at `/health`:

```bash
POSITRACK_TRANSPORT=dual PORT=8000 python mcp/server.py
curl -fsS http://127.0.0.1:8000/health         # {"status":"ok",...}
```

## Container / Railway deploy

Build **from the repo root** (the image needs `core/` next to `mcp/`):

```bash
docker build -f mcp/Dockerfile -t positrack-mcp .
docker run --rm -e PORT=8080 -p 8080:8080 positrack-mcp
curl -fsS http://127.0.0.1:8080/health
```

**Railway:**
1. Point a Railway service at this repo with **Dockerfile path** `mcp/Dockerfile`
   (root build context), or `railway up` from the repo root.
2. Set the env var `YT_BASE=https://support.posibolt.com` (the only env needed).
   **Do NOT set YT_TOKEN** — tokens are per-user (header), never an env secret.
3. Railway injects `$PORT`; the server binds it automatically.
4. Health check path: `/health`. Connect URL for clients: `https://<app>.up.railway.app/mcp`
   (streamable HTTP) or `…/sse` (SSE).

## Transport note

All three current target clients (Claude custom connector, ChatGPT Developer Mode,
Gemini CLI) support **streamable HTTP** (`/mcp`) — that's the recommended URL. SSE
(`/sse`) is mounted alongside for older connector paths. The FastMCP version is
**pinned** in `requirements.txt`; the dual-mount + `/health` route are
version-sensitive, so re-run the dual-transport smoke test after any bump.

## Relation to YouTrack's official MCP

JetBrains shipped an official **YouTrack Remote MCP server** (2025.3+). It's
Cloud-oriented and exposes raw issue/KB CRUD. Positrack is complementary, not a
duplicate: it adds the assistant layer (plain-English routing, capture-nudging),
**preview→commit safety on every write**, location/briefing reports, and works
against this self-hosted instance with the same engine that powers the CLI + skill.
