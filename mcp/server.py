#!/usr/bin/env python3
"""
Positrack MCP server — wraps the shared `ytcore` engine as Model Context Protocol
tools so Claude, ChatGPT (Developer Mode), and Gemini CLI can act on YouTrack.

ONE engine, never forked: every tool delegates to `core/ytcore.py`. Auth is
per-user and per-call:
  * remote HTTP: the caller's token rides in the `Authorization: Bearer …` header,
    read fresh per request and turned into a `ytcore.Ctx` — never stored, never a
    shared/global token, never logged.
  * local stdio: the token comes from the user's own `$YT_TOKEN`.

Write tools default to commit=False and return a non-mutating PREVIEW; only
commit=True applies. Errors are returned as friendly structured objects, never
raw stack traces.

Transports are wired in a later step; this module already resolves auth from
either source so it is transport-ready.
"""
import base64
import hashlib
import os
import sys

# Import the shared engine from ../core (sibling of mcp/).
_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(_HERE), "core"))
import ytcore as core  # noqa: E402

from fastmcp import FastMCP  # noqa: E402

INSTRUCTIONS = """\
Positrack — talk to Posibolt's YouTrack (support.posibolt.com) in plain English.

Help managers, team leads, and individuals DO their tracking by chatting instead
of clicking the web UI. Lead with the ANSWER, not a raw table; translate plain
English into the right tool; never make the user learn YouTrack.

AUTH & PERMISSIONS: every call uses the caller's OWN YouTrack token (an
`Authorization: Bearer` header remotely, or $YT_TOKEN locally). A 403 means the
token lacks permission for that action — that is EXPECTED, not a bug; suggest a
lead/admin token if an admin-only feature is needed.

WRITE SAFETY (critical): every write tool defaults to commit=False and returns a
PREVIEW of the exact change WITHOUT mutating. ALWAYS show the preview to the user
and get explicit confirmation, THEN call the same tool again with commit=True.
For state / assignee / priority / sprint changes, prefer `yt_cmd` (the Commands
API — it validates against the project's workflow before applying).

CAPTURE DISCIPLINE (your most important job): the team's biggest failure mode is
that decisions, bugs, and commitments made in chat never reach the board. So be
an active capture partner — when the conversation surfaces something trackable,
offer in ONE short line to log it: a decision → a comment (yt_comment); a bug →
yt_create; a commitment → a ticket; "it's done" / "we're blocked" → yt_cmd to
move or flag it. Make capture a single confirm-and-go, and never nag twice.
"""

mcp = FastMCP(name="Positrack", instructions=INSTRUCTIONS)


# ---------- per-call auth resolution (header for remote, env for local) ----------
def _resolve_ctx():
    """Build a fresh ytcore.Ctx from the per-request token. Never cached, never
    logged. Prefers the HTTP Authorization header; falls back to $YT_TOKEN."""
    base = os.environ.get("YT_BASE") or core.DEFAULT_BASE
    token = None
    try:
        from fastmcp.server.dependencies import get_http_headers
        headers = get_http_headers() or {}
        auth = headers.get("authorization") or headers.get("Authorization")
        if auth and auth.strip().lower().startswith("bearer "):
            token = auth.strip()[7:].strip()
    except Exception:
        pass  # not in an HTTP request context (e.g. stdio)
    if not token:
        env = os.environ.get("YT_TOKEN")
        token = env.strip() if env else None
    if not token:
        raise core.YTError(401, "no token supplied — send 'Authorization: Bearer <your YouTrack token>' "
                                "(remote) or set $YT_TOKEN (local). Each user acts with their own token.")
    return core.Ctx(token, base)


def _run(thunk):
    """Run an engine call, converting YTError (and anything unexpected) into a
    friendly structured result instead of leaking a stack trace to the host."""
    try:
        return thunk()
    except core.YTError as e:
        return {"error": True, "status": e.status_code, "message": e.friendly_message}
    except Exception as e:  # never leak internals
        return {"error": True, "status": None, "message": f"unexpected error: {type(e).__name__}"}


def _token_fingerprint(ctx):
    """A stable, non-reversible id for per-token cache keying (never the token)."""
    return hashlib.sha256(("positrack|" + ctx.token).encode()).hexdigest()[:16]


# ---------- read tools ----------
@mcp.tool
def yt_whoami() -> dict:
    """Return the calling token's YouTrack identity (login, full name, email)."""
    return _run(lambda: core.whoami(_resolve_ctx()))


@mcp.tool
def yt_projects() -> dict:
    """List all projects (short code, id, archived, name), with a non-admin fallback."""
    return _run(lambda: {"projects": core.projects(_resolve_ctx())})


@mcp.tool
def yt_describe(project: str) -> dict:
    """Describe a project: its custom fields, their types, and key enum/state values."""
    return _run(lambda: core.describe(_resolve_ctx(), project))


@mcp.tool
def yt_count(query: str) -> dict:
    """Return the issue count for a YouTrack query string."""
    return _run(lambda: {"query": query, "count": core.count(_resolve_ctx(), query)})


@mcp.tool
def yt_search(query: str, project: str = "", location: str = "", columns: str = "", limit: int = 50) -> dict:
    """Search issues. `query` is YouTrack query syntax; `project`/`location` add scope.
    Returns the resolved query and full issue objects (plus projected `rows` if
    `columns` is a comma-separated list like 'id,summary,State,Assignee')."""
    def go():
        ctx = _resolve_ctx()
        scoped = core.search_query(query, project, location)
        issues = core.search(ctx, query, project, location, limit=limit)
        out = {"query": scoped, "count": len(issues), "issues": issues}
        if columns:
            cols = [c.strip() for c in columns.split(",") if c.strip()]
            out["rows"] = [_project_row(it, cols) for it in issues]
        return out
    return _run(go)


def _project_row(it, cols):
    d = core.cf_map(it); row = {}
    for c in cols:
        if c == "id": row[c] = it.get("idReadable", "")
        elif c == "summary": row[c] = it.get("summary") or ""
        elif c == "project": row[c] = (it.get("project") or {}).get("shortName") or it.get("idReadable", "").split("-")[0]
        elif c == "age": row[c] = core.days_since(it.get("created"))
        else: row[c] = core.vname(d.get(c))
    return row


@mcp.tool
def yt_get(issue: str) -> dict:
    """Get one issue: fields, links, recent comments, age, estimate-vs-spent."""
    return _run(lambda: core.get_issue(_resolve_ctx(), issue))


@mcp.tool
def yt_history(issue: str, limit: int = 20) -> dict:
    """Get an issue's change timeline (state moves, reassignments, links, sprints)."""
    return _run(lambda: {"issue": issue, "events": core.history(_resolve_ctx(), issue, limit)})


@mcp.tool
def yt_report(type: str, project: str = "", location: str = "", days: int = 7,
              sprint: str = "", limit: int = 50) -> dict:
    """Run a canned report. `type` is one of: health, activity, briefing, stale,
    unestimated, unassigned, epics, mywork, sprint. Returns structured blocks
    (headings, tables, and issue lists)."""
    return _run(lambda: {"type": type, "blocks": core.report(_resolve_ctx(), type, project=project,
                                                              location=location, days=days,
                                                              sprint=sprint, limit=limit)})


@mcp.tool
def yt_boards(project: str = "") -> dict:
    """List agile boards and their live (non-archived) sprints, optionally for one project."""
    return _run(lambda: {"boards": core.boards(_resolve_ctx(), project)})


@mcp.tool
def yt_users(filter: str = "", banned: bool = False, active: bool = False, limit: int = 400) -> dict:
    """List users (admin/lead-scoped). `filter` matches login/name; `banned`/`active`
    narrow by status. A non-admin token gets a friendly 403."""
    return _run(lambda: core.users(_resolve_ctx(), banned=banned, active=active, grep=filter, limit=limit))


@mcp.tool
def yt_orphans(project: str = "", limit: int = 50) -> dict:
    """Open work assigned to deactivated users, plus currently unassigned open work
    (continuity view for departures). Returns structured blocks."""
    return _run(lambda: {"blocks": core.orphans(_resolve_ctx(), project, limit)})


@mcp.tool
def yt_load(project: str) -> dict:
    """Open-work concentration per owner for a project (single-point-of-failure view)."""
    return _run(lambda: core.load(_resolve_ctx(), project))


@mcp.tool
def yt_articles(query: str = "", limit: int = 40) -> dict:
    """Search Knowledge Base article titles (optionally filtered by `query`)."""
    return _run(lambda: core.articles(_resolve_ctx(), query, limit))


@mcp.tool
def yt_article(id: str) -> dict:
    """Read one Knowledge Base article's content by id."""
    return _run(lambda: core.article(_resolve_ctx(), id))


@mcp.tool
def yt_tags() -> dict:
    """List tags and their owners."""
    return _run(lambda: {"tags": core.tags(_resolve_ctx())})


@mcp.tool
def yt_saved() -> dict:
    """List saved queries (name, query, owner)."""
    return _run(lambda: {"saved": core.saved(_resolve_ctx())})


# ---------- write tools (commit=False previews; show preview & confirm first) ----------
@mcp.tool
def yt_create(project: str, summary: str, description: str = "", fields: dict | None = None,
              commit: bool = False) -> dict:
    """Create an issue. `fields` is {name: value}, auto-typed from the project schema.
    commit=False returns a PREVIEW of the exact payload without creating anything;
    show it to the user, get confirmation, then call again with commit=True."""
    return _run(lambda: core.create(_resolve_ctx(), project, summary, description, fields or {}, commit))


@mcp.tool
def yt_update(issue: str, summary: str = "", description: str = "", fields: dict | None = None,
              commit: bool = False) -> dict:
    """Update an issue's summary/description/custom fields. commit=False previews
    without mutating; confirm with the user before commit=True."""
    return _run(lambda: core.update(_resolve_ctx(), issue, summary, description, fields or {}, commit))


@mcp.tool
def yt_cmd(issues: str, command: str, comment: str = "", commit: bool = False) -> dict:
    """Apply a YouTrack Command (e.g. 'state Testing assignee jsmith') to one or more
    comma-separated issues. Use for state/assignee/priority/sprint/tag changes — it
    respects the workflow. commit=False validates via /commands/assist and returns
    OK/ERROR per clause WITHOUT mutating; confirm, then commit=True."""
    return _run(lambda: core.run_command(_resolve_ctx(), issues, command, comment, commit))


@mcp.tool
def yt_comment(issue: str, text: str, commit: bool = False) -> dict:
    """Post a comment on an issue. commit=False previews; confirm before commit=True."""
    return _run(lambda: core.comment(_resolve_ctx(), issue, text, commit))


@mcp.tool
def yt_log(issue: str, time: str, text: str = "", type: str = "", commit: bool = False) -> dict:
    """Log work time on an issue (periods like '90m', '1h30m', '1d'). commit=False
    previews; confirm before commit=True."""
    return _run(lambda: core.log_time(_resolve_ctx(), issue, time, text, type, commit))


@mcp.tool
def yt_attach(issue: str, file_name: str, content_b64: str, commit: bool = False) -> dict:
    """Attach a file to an issue. Pass the bytes as base64 in `content_b64` (a
    server-local path is unreachable for remote users). commit=False previews;
    confirm before commit=True."""
    def go():
        try:
            data = base64.b64decode(content_b64)
        except Exception:
            raise core.YTError(None, "content_b64 is not valid base64.")
        return core.attach(_resolve_ctx(), issue, file_name, data, commit)
    return _run(go)


@mcp.tool
def yt_reassign(from_user: str, to_user: str, project: str = "", comment: str = "",
                commit: bool = False) -> dict:
    """Bulk-move a person's open issues to a new owner (continuity through departures),
    via the Commands API. commit=False lists the affected issues WITHOUT moving them;
    confirm the from/to and scope, then commit=True. Prefer scoping with `project`."""
    return _run(lambda: core.reassign(_resolve_ctx(), from_user, to_user, project, comment, commit))


@mcp.tool
def yt_article_create(project: str, summary: str, content: str = "", commit: bool = False) -> dict:
    """Create a Knowledge Base article. commit=False previews; confirm before commit=True."""
    return _run(lambda: core.article_create(_resolve_ctx(), project, summary, content, commit))


# ---------- health (explicit; FastMCP does not provide one) ----------
@mcp.custom_route("/health", methods=["GET"])
async def health(_request):
    from starlette.responses import JSONResponse
    return JSONResponse({"status": "ok", "service": "positrack-mcp"})


def main():
    # stdio by default (local: Claude Desktop/Code, Gemini CLI). HTTP/SSE transports
    # for the hosted Railway deployment are wired in the next step.
    mcp.run()


if __name__ == "__main__":
    main()
