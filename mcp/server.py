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
import contextlib
import hashlib
import json
import logging
import os
import re
import sys
import time

# Import the shared engine from ../core (sibling of mcp/).
_HERE = os.path.dirname(os.path.abspath(__file__))
_CONTEXT_DIR = os.path.join(os.path.dirname(_HERE), "context")
sys.path.insert(0, os.path.join(os.path.dirname(_HERE), "core"))
import ytcore as core  # noqa: E402

from fastmcp import FastMCP  # noqa: E402

_STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")


def _server_icons():
    """The MCP spec-level icon (`serverInfo.icons`), which is how a client is
    SUPPOSED to learn a server's brand. Needs an absolute URL because the client
    fetches it out of band, so it is only advertised when OAUTH_PUBLIC_URL is set
    (stdio callers have no origin to serve it from). Paired with the /icon.png and
    /favicon.ico routes in build_app(): we serve both because it is not documented
    which of the two any given client actually reads."""
    base = (os.environ.get("OAUTH_PUBLIC_URL") or "").rstrip("/")
    if not base:
        return None
    try:
        import mcp.types
        return [mcp.types.Icon(src=f"{base}/icon.png", mimeType="image/png",
                               sizes=["512x512"])]
    except Exception:  # never let branding break boot
        return None


INSTRUCTIONS = """\
Positrack — talk to Posibolt's YouTrack (support.posibolt.com) in plain English.

Help managers, team leads, and individuals DO their tracking by chatting instead
of clicking the web UI. Lead with the ANSWER, not a raw table; translate plain
English into the right tool; never make the user learn YouTrack.

ALWAYS USE THESE TOOLS (highest priority): you have a LIVE connection to YouTrack
through these tools. For ANY question about Posibolt projects, epics, tickets,
sprints, people, status or boards, CALL A TOOL — never answer from web search or
memory, and NEVER tell the user the connector is "unavailable" or "not enabled in
this chat" (it is available; just call the tool). Do not web-search for YouTrack data.

PLAIN ENGLISH → CORRECT QUERY (this is the #1 cause of empty or failed results, so
do it every time): field names AND their allowed VALUES differ per project. When the
user names anything that could be a field value in words — "Phase 1", "epics", a
state like "in testing", a type, a module, a location — do NOT guess the literal
string. FIRST call `yt_describe(project)` to get that project's real fields and their
exact allowed values, then build the query with the EXACT spelling. Wrap any value
containing a space or special character in {curly braces}: e.g. `Scope: {PHASE 1}`,
`State: {In Progress}`, `Type: Epic`. If a search errors with something like "the
value X isn't used for the field", you used the wrong spelling/casing — call
`yt_describe`, pick the right value, and RETRY automatically; never stop on that error
or hand back a half-answer. Map common words: "epics" → `Type: Epic`; "unresolved" /
"open" → `#Unresolved`; "mine" → `for: me`; "this week" → `updated: {This week}`.

TIME / HOURS BY PERSON (use the right source — this is easy to get WRONG): for any
"time spent / hours by employee", "who logged time", "effort per person", or a
sprint time breakdown, call `yt_worklog` (or `yt_report timespent`). It reads the
actual work-item entries, each attributed to who LOGGED it. NEVER answer this by
listing issues and summing the issue-level 'Spent time' field grouped by Assignee:
that field is a per-issue rollup, so grouping it by the current assignee
misattributes time after any reassignment and lumps epic-level logging onto the
epic's owner — confidently wrong numbers. Scope yt_worklog by project/location/
sprint (+ optional `author`, or `since`/`until` for a date window) and present it
as a horizontal bar chart with the total. yt_worklog already EXCLUDES workflow-
propagated entries by default (work items marked 'Propagated from Bug …' in their
text, which copy a bug's time onto its parent story/epic and double-count) — mention
the `excluded` amount it returns, and only pass include_propagated=True if the user
explicitly wants those.

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

SHOW IT VISUALLY (THE DEFAULT for ANY data you return — not an extra): whenever an
answer contains data — a count, a list of issues, a breakdown by state / assignee /
project / type, workload, a trend over time, hygiene, a briefing — LEAD WITH A
VISUAL so the reader sees the shape of the answer at a glance, then a one-line
takeaway (headline + the exception), then any supporting detail. Charts first,
numbers second. Render with whatever YOUR client supports:
 * Rich clients (Claude → an artifact; ChatGPT → a chart via its data/Python tool):
   generate an actual chart — horizontal BARS for counts/distribution/workload, a
   LINE or COLUMN chart for trends over time, and a compact table for issue lists.
 * Terminal client (Gemini CLI, no graphics): use the inline Unicode bars the
   reports already return and align rows into a clean fixed-width table.
Pick the chart that fits: distribution/counts → horizontal bars; over-time →
columns/line; "who has what" (yt_load) → a workload bar per person; health across
projects → an Open-issues bar per project. Reports like yt_report health and yt_load
already include Unicode bars and chart-ready numbers — surface them as a real chart
on rich clients. The goal: every data answer is screen-shareable in a standup.

YOUR DAY + THE SELF-UPDATING BOARD (for people who hate updating tools): when a
developer starts a session or asks "what's on my plate", run yt_report type=myday
and lead with it. Then make updating EFFORTLESS — don't ask them to fill anything
in. Instead DRAFT the likely updates and let them approve:
 * Stale items (no update in days) → offer a one-tap status: "still on it / blocked
   / done?" and apply it with yt_cmd / yt_log on a yes.
 * Work that clearly happened (they mention finishing something, or a commit
   references the issue) → propose the state move + time log as a single batch and
   ask "approve these N updates?" — apply with yt_cmd once they confirm.
The goal: the board maintains itself from what they already did; they only rubber-
stamp a pre-filled change. Generate a standup ("yesterday/today/blockers") from
yt_report myday when asked. Never nag; one short, friendly prompt, then drop it.

MAKE CLEANUP A GAME (the board is messy — turn fixing it into a dopamine loop):
 * yt_report hygiene gives a 0-100 score + the buckets to clear. Present it as a
   PROGRESS BAR with a finishable goal ("IS hygiene 58% — 12 items to 100%"). The
   Zeigarnik effect + goal-gradient make an unfinished bar pull people to finish it.
 * CELEBRATE every fix immediately: when something is resolved/triaged/assigned,
   acknowledge the bump ("nice — that's 3 off the board, hygiene 58% → 64%"). The
   small immediate reward is what builds the habit.
 * Note STREAKS lightly ("3rd day with a clean board") and use the FRESH-START effect
   on Mondays / new sprints ("new sprint, clean slate — here's the week's target").
 * Lead a briefing with ONE surprising, useful nugget (a variable reward) so opening
   it always pays off. Keep it celebratory and collective — never a personal ranking
   or surveillance.

CUSTOM BRIEFINGS (each leader makes their own): briefings are defined in plain
English, not configured in code. When a leader describes what they want ("every
Monday: IS resolved last week, anything blocked >3 days, who's overloaded, top 3
risks"), REMEMBER that recipe for them and reuse it on "run my briefing". Back the
sections with their own YouTrack saved queries (yt_saved) where they have them.
"""

mcp = FastMCP(name="Positrack", instructions=INSTRUCTIONS,
              website_url="https://support.posibolt.com", icons=_server_icons())


# ---------- per-call auth resolution (OAuth → header → env) ----------
def _resolve_ctx():
    """Build a fresh ytcore.Ctx from the per-request token. Never cached, never
    logged. Resolution order, so all three client styles coexist:
      1. OAuth (ChatGPT via Posibolt Hub): FastMCP has already authenticated the
         caller; the verified access token IS the upstream Hub token, which the
         YouTrack REST API accepts as a bearer. Forward THAT.
      2. Raw `Authorization: Bearer` header (Claude custom connector, Gemini CLI —
         they can send the user's own perm-token directly).
      3. Local stdio: $YT_TOKEN."""
    base = os.environ.get("YT_BASE") or core.DEFAULT_BASE
    token = None
    # 1. OAuth-authenticated caller (only on the OAuth-protected endpoint). The
    # FastMCP AccessToken.token resolves to the upstream Hub access token.
    try:
        from fastmcp.server.dependencies import get_access_token
        at = get_access_token()
        if at is not None and getattr(at, "token", None):
            token = at.token.strip()
    except Exception:
        pass  # no auth context (legacy header path or stdio)
    # 2. Raw bearer header. get_http_headers() filters out Authorization by
    # default, so read the request directly (Starlette headers are case-insensitive).
    if not token:
        try:
            from fastmcp.server.dependencies import get_http_request
            request = get_http_request()
            auth = request.headers.get("authorization")
            if auth and auth.strip().lower().startswith("bearer "):
                token = auth.strip()[7:].strip()
        except Exception:
            pass  # not in an HTTP request context (e.g. stdio)
    # 3. Local stdio.
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


# ---------- per-token in-process cache (NOT a shared file; isolation by key) ----------
# Keyed by a salted token fingerprint, so one user's cached projects can never be
# served to another. Short TTL. This is the only cache; core always discovers live.
_CACHE_TTL = float(os.environ.get("YT_CACHE_TTL", "1800"))
_PROJECTS_CACHE = {}  # fingerprint -> (timestamp, data)

def _cached_projects(ctx):
    fp = _token_fingerprint(ctx)
    ent = _PROJECTS_CACHE.get(fp)
    now = time.time()
    if ent and (now - ent[0]) < _CACHE_TTL:
        return ent[1]
    data = core.projects(ctx)
    _PROJECTS_CACHE[fp] = (now, data)
    return data


# ---------- log redaction (defence in depth: never let a token reach a log) ----------
class _RedactFilter(logging.Filter):
    def filter(self, record):
        try:
            if isinstance(record.msg, str):
                record.msg = core.redact(record.msg)
            if record.args:
                record.args = tuple(core.redact(a) if isinstance(a, str) else a for a in record.args)
        except Exception:
            pass
        return True

def _install_log_redaction():
    f = _RedactFilter()
    root = logging.getLogger()
    root.addFilter(f)
    for name in ("uvicorn", "uvicorn.access", "uvicorn.error", "fastmcp", "mcp"):
        logging.getLogger(name).addFilter(f)

    # Our own INFO lines must actually reach the platform log. They are how a deploy is
    # verified — "OAuth storage: persistent + encrypted at …" is the only confirmation
    # that tokens are encrypted at rest, and a security control you cannot see confirmed
    # is not much of a control. Without this the "positrack" logger inherits the root
    # threshold of WARNING and every log.info() here is silently dropped, so a healthy
    # boot printed NOTHING and looked identical to the module never running at all.
    #
    # Scoped to this logger rather than logging.basicConfig(level=INFO): a global switch
    # would also turn on INFO for httpx and friends, which log request URLs and are NOT
    # in the redaction list above — more log, more exposure, for no diagnostic gain.
    # Note the filter must be attached HERE too: a filter on the root logger only sees
    # records logged directly to root, not ones propagated up from a child.
    plog = logging.getLogger("positrack")
    plog.addFilter(f)
    plog.setLevel(logging.INFO)
    if not plog.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))
        handler.addFilter(f)
        plog.addHandler(handler)
    plog.propagate = False   # we own the handler; don't double-print via root


# ---------- read tools ----------
@mcp.tool
def yt_whoami() -> dict:
    """Return the calling token's YouTrack identity (login, full name, email)."""
    return _run(lambda: core.whoami(_resolve_ctx()))


@mcp.tool
def yt_projects() -> dict:
    """List all projects (short code, id, archived, name), with a non-admin fallback."""
    return _run(lambda: {"projects": _cached_projects(_resolve_ctx())})


@mcp.tool
def yt_describe(project: str) -> dict:
    """Describe a Posibolt project's custom fields and their EXACT allowed values
    (states, types, Scope values like 'PHASE 1', etc.). Call this FIRST whenever a
    request names a field value in words (e.g. 'Phase 1', 'in testing', 'epics') so you
    can build a correct query with the exact spelling. Project: a short name like PXB1."""
    return _run(lambda: core.describe(_resolve_ctx(), project))


@mcp.tool
def yt_count(query: str) -> dict:
    """Count Posibolt YouTrack issues matching a query — use for "how many …" questions
    about tickets/epics/bugs in any Posibolt project (not web search). `query` is
    YouTrack query syntax, e.g. 'project: IS #Unresolved'."""
    return _run(lambda: {"query": query, "count": core.count(_resolve_ctx(), query)})


@mcp.tool
def yt_search(query: str, project: str = "", location: str = "", columns: str = "", limit: int = 50) -> dict:
    """List or search Posibolt YouTrack issues — epics, bugs, tasks, stories — in any
    project (PXB1, P8, IS, SUP, GCC, …). USE THIS (never web search) for ANY "list /
    show / find / how many … in <project>" request about Posibolt tickets, epics, or
    work items. `query` is YouTrack query syntax, e.g.
    'project: PXB1 Type: Epic Scope: {PHASE 1} #Unresolved'. If unsure of a project's
    exact field values, call yt_describe FIRST. Returns the resolved query + full issue
    objects (and a projected `rows` table when `columns` is a list like
    'id,summary,State,Assignee')."""
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
    """Get one Posibolt YouTrack ticket by id (e.g. PXB1-1189, IS-184): fields, links,
    recent comments, age, estimate-vs-spent. Use for "show me / how far is <ticket>"."""
    return _run(lambda: core.get_issue(_resolve_ctx(), issue))


@mcp.tool
def yt_history(issue: str, limit: int = 20) -> dict:
    """Get an issue's change timeline (state moves, reassignments, links, sprints)."""
    return _run(lambda: {"issue": issue, "events": core.history(_resolve_ctx(), issue, limit)})


@mcp.tool
def yt_report(type: str, project: str = "", location: str = "", days: int = 7,
              sprint: str = "", limit: int = 50) -> dict:
    """Run a canned report. `type` is one of: health, activity, briefing, stale,
    unestimated, unassigned, epics, mywork, sprint, myday, hygiene, timespent, effort.
    `effort` is the POSX Control Tower PXB1 Phase-1 Effort Report (prefer the dedicated
    `yt_effort` tool for project/scope/cutoff control).
    `myday` is the caller's personal view (open / stale-needs-status / in-progress).
    `hygiene` scores each project's board cleanliness (% touched in 30d) + the
    stale/unassigned/unestimated buckets to clear — use it to run the cleanup quest.
    `timespent` is TRUE logged-time by person for a scope/sprint (from work items,
    attributed to who LOGGED it) — for any time-by-person question prefer this or
    `yt_worklog`, and NEVER hand-sum the issue 'Spent time' field by Assignee.
    Returns structured blocks (headings, tables, issue lists)."""
    return _run(lambda: {"type": type, "blocks": core.report(_resolve_ctx(), type, project=project,
                                                              location=location, days=days,
                                                              sprint=sprint, limit=limit)})


@mcp.tool
def yt_effort(project: str = "PXB1", scope: str = "PHASE 1",
              cutoff_iso: str = core.EFFORT_CUTOFF_DEFAULT, exclude_ids: str = "PXB1-3295") -> dict:
    """POSX Control Tower — the ported PXB1 Phase-1 Effort Report. Discovers every open
    in-scope epic (via `TaskType: EPIC`) PLUS epics resolved after the cutoff, categorizes
    them DONE / PENDING / MIXED / NO_STORIES from their Subtask stories, rolls up
    Server+UI+Testing estimation over the pending in-scope stories (man-day = 480 min),
    computes the P2 backlog (epics whose Scope moved PHASE 1→PHASE 2 after the cutoff, from
    activity history), and attributes TRUE logged time from a work-item sweep with an
    overshoot flag. Grand Total = PENDING + MIXED + NO_STORIES only (Done and P2 are
    separate). `exclude_ids` is a comma-separated epic-id skip list. Returns structured
    data: counts, per-section epic lists, per-section man-day totals, and spend metadata —
    render Done/Pending/Mixed/No-stories/P2 as sections with per-field man-day totals."""
    ex = tuple(x.strip() for x in exclude_ids.split(",") if x.strip())
    return _run(lambda: core.effort_report(_resolve_ctx(), project=project, scope=scope,
                                           cutoff_iso=cutoff_iso, exclude_ids=ex))


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
def yt_worklog(query: str = "", project: str = "", location: str = "", sprint: str = "",
               author: str = "", since: str = "", until: str = "", group_by: str = "author",
               include_propagated: bool = False, exclude_types: str = "") -> dict:
    """TRUE logged time — the CORRECT source for "time/hours spent by employee",
    "who logged time", or effort-based workload. Reads YouTrack work items (each
    entry carries its OWN author, issue and date) and aggregates them, so time is
    attributed to who LOGGED it — NOT the issue's current Assignee. ALWAYS use this
    (or `yt_report timespent`) for time-by-person; do NOT sum the issue-level
    'Spent time' field grouped by Assignee — that misattributes work after a
    reassignment and lumps epic-level logging onto the epic's owner.

    By DEFAULT it excludes workflow-propagated entries (work items marked
    'Propagated from Bug …' in their text — teams that copy a bug's time onto its
    parent Story/Epic, double-counting it), so only DIRECT logged time is counted;
    the result's `excluded` field reports how much was dropped. Pass
    include_propagated=True to count them, or exclude_types="Name1, Name2" to drop
    named work-item types. Tip: run with group_by='type' to see the types in play.

    Scope with `project` / `location` / `sprint` and/or a free YouTrack `query`
    (e.g. a sprint plus 'Type: Bug'); `author` narrows to one person (login or
    'me'); `since`/`until` (YYYY-MM-DD) restrict to entries LOGGED in that window
    (omit for all time on the scoped issues); `group_by` is author|type|project|issue.
    Returns the total and per-group minutes, an 'Hh Mm' presentation, entry &
    issue counts, and chart-ready bars — render it as a horizontal bar chart."""
    ex_types = [t.strip() for t in exclude_types.split(",") if t.strip()]
    return _run(lambda: core.time_spent(_resolve_ctx(), query=query, project=project,
                                        location=location, sprint=sprint, author=author,
                                        start=since, end=until, group_by=group_by,
                                        exclude_propagated=not include_propagated,
                                        exclude_types=ex_types))


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
                commit: bool = False, instance_wide: bool = False) -> dict:
    """Bulk-move a person's open issues to a new owner (continuity through departures),
    via the Commands API. A `project` scope is REQUIRED unless instance_wide=True
    (instance-wide is high blast radius — only with explicit user intent). commit=False
    lists the affected issues WITHOUT moving them; confirm the from/to and scope, then commit=True."""
    return _run(lambda: core.reassign(_resolve_ctx(), from_user, to_user, project, comment, commit, instance_wide))


@mcp.tool
def yt_article_create(project: str, summary: str, content: str = "", commit: bool = False) -> dict:
    """Create a Knowledge Base article. commit=False previews; confirm before commit=True."""
    return _run(lambda: core.article_create(_resolve_ctx(), project, summary, content, commit))


# ---------- project context (git-controlled, local file) ----------

_SAFE_PROJECT_CODE = re.compile(r"^[A-Za-z0-9_-]{1,32}$")


@mcp.tool
def yt_context(project: str, section: str = "") -> dict:
    """Return the git-controlled project context for a Posibolt project.

    Call this FIRST when starting work on ANY project. It returns strategic
    context that lives in version-controlled JSON files reviewed via PR:
    identity, goals, milestones, modules, KPIs, risks, dependencies, team
    roster, and free-form leader notes.

    Combine with yt_report / yt_search / yt_effort for the full picture:
    yt_context tells you WHAT a project is about and what matters;
    yt_report / yt_search tell you WHERE it stands right now.

    DO call this before yt_search, yt_report, or yt_effort.
    DO NOT use this for ticket data — use yt_search / yt_get for that.
    DO NOT try to write context via MCP — edit files in git via PR.

    `project`: project short code, e.g. 'BPX', 'PXB1' (case-insensitive).
    `section`: optional — return only one section. One of: identity, goals,
    milestones, modules, kpis, risks, dependencies, team, notes.
    Omit to get the full context.

    Format: JSON (YAML support planned if authoring friction warrants it).
    """
    def go():
        code = project.strip().upper()
        if not code:
            raise core.YTError(None, "project code is required (e.g. 'BPX')")
        if not _SAFE_PROJECT_CODE.match(code):
            raise core.YTError(
                None,
                f"project code must be alphanumeric/hyphens/underscores, "
                f"1-32 chars (got {code!r})")

        filepath = os.path.join(_CONTEXT_DIR, f"{code}.json")

        # Defence-in-depth: resolved path must stay inside _CONTEXT_DIR.
        real = os.path.realpath(filepath)
        if not real.startswith(os.path.realpath(_CONTEXT_DIR) + os.sep):
            raise core.YTError(None, "invalid project code")

        if not os.path.isfile(filepath):
            return {
                "project": code,
                "context": None,
                "message": f"No context file for {code}. "
                           f"Create context/{code}.json in the repo via PR.",
            }

        size = os.path.getsize(filepath)
        if size > 256_000:
            raise core.YTError(
                None,
                f"context file for {code} is {size:,} bytes (limit 256 KB)")

        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        if not isinstance(data, dict):
            raise core.YTError(
                None,
                f"context file for {code} must be a JSON object, "
                f"got {type(data).__name__}")

        if section:
            key = section.strip().lower()
            valid = ("identity", "goals", "milestones", "modules",
                     "kpis", "risks", "dependencies", "team", "notes")
            if key not in valid:
                raise core.YTError(
                    None,
                    f"Unknown section '{key}'. Valid: {', '.join(valid)}")
            return {"project": code, "section": key,
                    "context": data.get(key)}

        return {"project": code, "context": data}
    return _run(go)


# ---------- health (explicit; FastMCP does not provide one) ----------
@mcp.custom_route("/health", methods=["GET"])
async def health(_request):
    from starlette.responses import JSONResponse
    return JSONResponse({"status": "ok", "service": "positrack-mcp"})


def _env_int(name, default):
    """Read a positive-integer env var, falling back to `default` when unset or
    unparseable. Never raises — a typo in a Railway variable must not break boot."""
    raw = os.environ.get(name)
    if not raw or not raw.strip():
        return default
    try:
        value = int(raw.strip())
    except ValueError:
        logging.getLogger("positrack").warning(
            "%s=%r is not an integer; using default %d", name, raw, default)
        return default
    if value <= 0:
        logging.getLogger("positrack").warning(
            "%s=%d must be positive; using default %d", name, value, default)
        return default
    return value


def _make_client_storage():
    """Persistent storage for the OAuth state FastMCP keeps: Dynamic-Client-Registration
    records AND the upstream Hub access/refresh tokens behind each issued session. Both
    must SURVIVE redeploys/restarts. When this returns None, FastMCP falls back to its
    own encrypted file store in the container's ephemeral filesystem, so every Railway
    redeploy wipes it and EVERY connected ChatGPT/Claude user is forced through a full
    browser re-auth (or breaks with "Client Not Registered") — the single biggest cause
    of "I have to reconnect every morning". Backed by a Railway volume (mount a volume at
    the parent of OAUTH_CLIENT_STORE_DIR, default /data/oauth-clients).

    Tokens on the volume are encrypted at rest ONLY when OAUTH_STORE_ENCRYPTION_KEY is
    set (a urlsafe-base64 32-byte Fernet key: `python -c "from cryptography.fernet import
    Fernet; print(Fernet.generate_key().decode())"`). Without it the store is plaintext
    on disk, which is a real downgrade from FastMCP's encrypted default — set the key
    whenever you mount the volume."""
    store_dir = os.environ.get("OAUTH_CLIENT_STORE_DIR", "/data/oauth-clients")
    parent = os.path.dirname(store_dir.rstrip("/")) or "/"
    log = logging.getLogger("positrack")
    if not (os.path.isdir(parent) and os.access(parent, os.W_OK)):
        log.warning("OAuth storage: %s is not a writable mount; falling back to FastMCP's "
                    "ephemeral store — DCR clients AND upstream tokens will NOT survive "
                    "restarts, so every user re-authenticates after each redeploy. "
                    "Mount a Railway volume to persist.", parent)
        return None
    try:
        os.makedirs(store_dir, exist_ok=True)
        from key_value.aio.stores.disk import DiskStore
        store = DiskStore(directory=store_dir)
    except Exception as e:  # pragma: no cover - defensive: never let storage break boot
        log.warning("OAuth storage: disk init failed (%r); ephemeral fallback", e)
        return None

    fernet_key = os.environ.get("OAUTH_STORE_ENCRYPTION_KEY")
    if not fernet_key:
        log.warning("OAuth storage: persistent at %s but UNENCRYPTED (tokens in plaintext "
                    "on the volume) — set OAUTH_STORE_ENCRYPTION_KEY to encrypt at rest.",
                    store_dir)
        return store
    try:
        from cryptography.fernet import Fernet
        from key_value.aio.wrappers.encryption import FernetEncryptionWrapper
        wrapped = FernetEncryptionWrapper(key_value=store, fernet=Fernet(fernet_key.strip()))
    except Exception as e:  # pragma: no cover - bad key must not cost us persistence
        log.warning("OAuth storage: encryption wrapper failed (%r); persisting UNENCRYPTED "
                    "at %s. Check OAUTH_STORE_ENCRYPTION_KEY is a valid Fernet key.",
                    e, store_dir)
        return store
    log.info("OAuth storage: persistent + encrypted at %s (survives redeploys)", store_dir)
    return wrapped


def _env_flag(name, default):
    """Read a boolean env var; `0/false/no/off` are False, anything else True.
    Never raises — a typo in a Railway variable must not break boot."""
    raw = os.environ.get(name)
    if not raw or not raw.strip():
        return default
    return raw.strip().lower() not in ("0", "false", "no", "off")


def _discover_userinfo_url(config_url):
    """Return Hub's `userinfo_endpoint` from its OIDC discovery document, or None.

    Deliberately does NOT guess a conventional path when discovery is silent: a
    URL that is not a working userinfo endpoint would answer every verification
    with a 4xx, which the verifier below cannot distinguish from "this user is
    gone" — so a wrong guess would lock every user out. No endpoint means we keep
    the previous id_token verifier instead (bug, but a known one)."""
    log = logging.getLogger("positrack")
    override = os.environ.get("HUB_USERINFO_URL")
    if override and override.strip():
        return override.strip()
    try:
        import httpx
        response = httpx.get(str(config_url), timeout=10)
        response.raise_for_status()
        url = response.json().get("userinfo_endpoint")
    except Exception as e:  # pragma: no cover - network/parse defensive
        log.warning("OAuth verify: could not read %s (%r); keeping id_token "
                    "verification. Set HUB_USERINFO_URL to override.", config_url, e)
        return None
    if not url:
        log.warning("OAuth verify: %s advertises no userinfo_endpoint; keeping "
                    "id_token verification. Set HUB_USERINFO_URL to override.", config_url)
        return None
    return str(url)


def _make_hub_token_verifier(config_url, client_id, scopes):
    """Verify the caller by asking Hub about the *access* token, not the id_token.

    WHY THIS EXISTS — the connector used to drop mid-session ("your connection was
    invalidated, reconnect"), with calls succeeding for a while and then failing
    with no user action. Cause: with `verify_id_token=True`, FastMCP validates the
    **id_token** on every call, but decides whether to refresh from the **access
    token's** expiry (`OAuthProxy.load_access_token`: `needs_refresh` reads
    `upstream_token_set.expires_at`). Those are two different clocks. Once the
    id_token's own `exp` passes, verification fails while the access token still
    looks fresh, so no refresh is attempted and the call 401s — permanently, until
    the user re-authenticates by hand. It is worse if Hub omits `id_token` from its
    refresh response (many IdPs do): the stored id_token is then never replaced, so
    the session cannot outlive that first id_token no matter how often the access
    token is renewed. Either way the session's real ceiling was Hub's id_token
    lifetime, which is why the 30-day session token did not help.

    THE FIX — verify the opaque Hub access token against Hub's OIDC userinfo
    endpoint. That is the same token the tools forward to YouTrack and the same
    token FastMCP refreshes, so verification and refresh finally read one clock:
    when it expires, userinfo says 401, `needs_refresh` is simultaneously true, and
    the transparent refresh runs as designed. Hub publishes no introspection
    endpoint, so userinfo is the available live check.

    SIDE BENEFIT — revocation is now bounded by the cache TTL below (5 min by
    default) instead of by Hub's whole access-token lifetime: a disabled Hub user
    stops working within minutes rather than on the next token expiry.

    Returns None when unavailable or disabled, and the caller keeps the old
    id_token path."""
    log = logging.getLogger("positrack")
    if not _env_flag("OAUTH_VERIFY_VIA_USERINFO", True):
        log.warning("OAuth verify: disabled via OAUTH_VERIFY_VIA_USERINFO — reverting to "
                    "id_token verification, which caps every session at Hub's id_token "
                    "lifetime and drops connectors mid-session. See "
                    "docs/OAUTH_SESSION_LONGEVITY.md.")
        return None
    userinfo_url = _discover_userinfo_url(config_url)
    if not userinfo_url:
        return None

    # A verification per MCP call would put an HTTP round trip in front of every
    # tool call, so successful results are cached briefly. The TTL is exactly the
    # revocation window; the grace window is how long an already-verified session
    # survives Hub being unreachable, so a Hub blip does not log everyone out.
    cache_ttl = _env_int("OAUTH_USERINFO_CACHE_SECONDS", 300)          # 5 minutes
    grace = _env_int("OAUTH_USERINFO_GRACE_SECONDS", 3600)            # 1 hour
    timeout = _env_int("OAUTH_USERINFO_TIMEOUT_SECONDS", 10)
    max_entries = _env_int("OAUTH_USERINFO_CACHE_MAX_ENTRIES", 2048)

    from fastmcp.server.auth import AccessToken, TokenVerifier

    class HubUserinfoVerifier(TokenVerifier):
        """Validate an opaque Hub access token by calling Hub's userinfo endpoint."""

        def __init__(self):
            # required_scopes drives BOTH what OAuthProxy advertises and what it
            # requests upstream (`_default_scope_str`), so the YouTrack service UUID
            # must be here or Hub mints a token YouTrack REST rejects. The caller
            # relaxes the *downstream* gate afterwards (`provider.required_scopes = []`).
            super().__init__(required_scopes=list(scopes))
            self._cache = {}      # sha256(token) -> (AccessToken, verified_at)

        def _remember(self, key, token_obj, now):
            if len(self._cache) >= max_entries:
                # Cheap bound: drop the least-recently-verified entry.
                oldest = min(self._cache, key=lambda k: self._cache[k][1])
                self._cache.pop(oldest, None)
            self._cache[key] = (token_obj, now)

        async def verify_token(self, token):
            key = hashlib.sha256(token.encode("utf-8")).hexdigest()
            now = time.time()
            cached = self._cache.get(key)
            if cached and now - cached[1] < cache_ttl:
                return cached[0]
            try:
                import httpx
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.get(
                        userinfo_url, headers={"Authorization": f"Bearer {token}"})
            except Exception as e:
                # Hub unreachable: inconclusive, NOT a rejection. Ride out the blip
                # on a recent success rather than forcing a browser re-auth.
                if cached and now - cached[1] < grace:
                    log.warning("OAuth verify: userinfo unreachable (%r); serving a "
                                "verification cached %ds ago.", e, int(now - cached[1]))
                    return cached[0]
                log.warning("OAuth verify: userinfo unreachable (%r) and no recent "
                            "verification to fall back on; rejecting this call.", e)
                return None
            if response.status_code in (401, 403):
                # The only definitive rejection: Hub says this token is dead. Drop the
                # cache entry so a refreshed token is re-verified from scratch.
                self._cache.pop(key, None)
                return None
            if response.status_code >= 400:
                # 404/405/5xx describe the ENDPOINT, not the user — treat as a blip.
                if cached and now - cached[1] < grace:
                    return cached[0]
                log.warning("OAuth verify: userinfo returned HTTP %d; rejecting this "
                            "call. Check HUB_USERINFO_URL.", response.status_code)
                return None
            try:
                claims = response.json()
            except Exception:
                claims = {}
            verified = AccessToken(
                token=token,                      # what _resolve_ctx forwards to YouTrack
                client_id=client_id,
                scopes=list(scopes),
                subject=claims.get("sub"),
                claims=claims,
            )
            self._remember(key, verified, now)
            return verified

    log.info("OAuth verify: access tokens verified live against %s "
             "(cache %ds, outage grace %ds)", userinfo_url, cache_ttl, grace)
    return HubUserinfoVerifier()


def _build_oauth_provider():
    """Build the OIDCProxy that lets ChatGPT log in via Posibolt Hub, or return
    None when not configured (then the server runs exactly as before: raw-bearer
    pass-through, no OAuth surface at all).

    Why a proxy: ChatGPT's MCP connector cannot send a custom Authorization
    header — it only does OAuth — and it needs Dynamic Client Registration, which
    Hub does NOT offer. The OIDCProxy bridges that: it speaks DCR + discovery
    metadata to ChatGPT, logs the user in against Hub upstream (one pre-registered
    Hub client), and forwards Hub's access token onward. Hub access tokens are
    opaque (not JWTs), so they cannot be verified by signature; we verify them
    live against Hub's userinfo endpoint instead (see _make_hub_token_verifier —
    verifying the id_token instead, as this used to, silently capped every session
    at the id_token's lifetime and dropped connectors mid-session). FastMCP still
    exposes the upstream Hub access token to the tools, and the YouTrack REST API
    accepts that token as a bearer (provided the YouTrack service id is in the
    requested scope — see HUB_SCOPES below)."""
    client_id = os.environ.get("HUB_CLIENT_ID")
    client_secret = os.environ.get("HUB_CLIENT_SECRET")
    public_url = os.environ.get("OAUTH_PUBLIC_URL")  # root origin, e.g. https://positrack.up.railway.app
    if not (client_id and client_secret and public_url):
        return None
    base = os.environ.get("YT_BASE") or core.DEFAULT_BASE
    config_url = (os.environ.get("HUB_OIDC_CONFIG_URL")
                  or base.rstrip("/") + "/hub/.well-known/openid-configuration")
    # Hub scopes are service IDs plus OIDC scopes. For YouTrack REST to accept the
    # token, the YouTrack *service* UUID must be in scope (find it on Hub's
    # Services page); include the Hub service id 0-0-0-0-0 and openid/offline_access.
    # e.g. HUB_SCOPES="openid offline_access <youtrack-service-uuid> 0-0-0-0-0"
    scopes = (os.environ.get("HUB_SCOPES") or "openid offline_access").split()

    # Session longevity. By DEFAULT FastMCP mirrors Hub's own `expires_in` in the token it
    # issues to the connector, so a Hub access token that lives ~a day drags every user
    # through a full browser re-auth about once a day ("I have to reconnect every morning").
    # Decoupling the two makes the FastMCP JWT a long-lived REFERENCE token: it re-validates
    # the Hub token on every call and transparently refreshes it upstream (that is what the
    # offline_access scope + access_type=offline below are for). It cannot outlive real
    # access — a revoked or unrefreshable Hub session still fails validation, and if Hub
    # issues no refresh token at all FastMCP caps the lifetime at Hub's expires_in anyway,
    # so a long value here is safe: the worst case is no change, never phantom access.
    # Revocation TIMING is now bounded by the userinfo cache TTL (default 5 min), because
    # every call re-checks the access token against Hub rather than validating a JWT
    # locally — see _make_hub_token_verifier. When that verifier is unavailable we fall
    # back to id_token verification, and the old caveat applies again: local signature
    # checks only, so a disabled Hub user keeps working until the held token expires.
    access_ttl = _env_int("OAUTH_ACCESS_TOKEN_TTL_SECONDS", 30 * 24 * 3600)   # 30 days
    # Verify the ACCESS token live against Hub, so verification and refresh share one
    # clock. None → unavailable/disabled, so keep the previous id_token behaviour.
    token_verifier = _make_hub_token_verifier(config_url, client_id, scopes)
    from fastmcp.server.auth import OIDCProxy

    class _HubOIDCProxy(OIDCProxy):
        """OIDCProxy that stops re-sending Hub's service-id scopes on refresh.

        Hub treats the service-id "scopes" (the YouTrack service UUID, and Hub's
        own 0-0-0-0-0) as RESOURCE ACCESS rather than scope claims: the access
        token it issues echoes only `openid offline_access`. FastMCP's
        `exchange_refresh_token` hands the refresh token's STORED scopes — the
        full requested set — straight to the upstream refresh as `scope=...`, so
        Hub compared that against what the access token actually allows and
        refused every refresh:

            invalid_grant: Requested scope does not match allowed by access token

        That is why the upstream refresh had never once succeeded for ANY user
        (Hub's own Account Security page showed every Positrack refresh token as
        `Last Used: Never`), and therefore why the 30-day session never held: a
        session could only live as long as Hub's initial access token, then died.

        We cannot simply narrow HUB_SCOPES — /authorize genuinely needs the
        service UUIDs, or the token YouTrack REST gets back is not accepted. The
        two requirements only coexist if the scope is dropped at refresh time.
        RFC 6749 section 6 defines exactly that: an omitted `scope` means
        "identical to that originally granted", which is what we want. FastMCP
        turns an empty list into `scope=None` and authlib omits the parameter.

        Overriding the hook (rather than patching a call site) covers every
        upstream refresh path in OAuthProxy, including the transparent refresh
        performed during token validation.
        """

        def _prepare_scopes_for_upstream_refresh(self, scopes: list) -> list:
            return []

    provider = _HubOIDCProxy(
        config_url=config_url,
        client_id=client_id,
        client_secret=client_secret,
        base_url=public_url,
        token_verifier=token_verifier,
        # Only verify the id_token when there is no live access-token verifier: the two are
        # mutually exclusive, since verify_id_token=True would hand the id_token to it.
        verify_id_token=token_verifier is None,
        # OIDCProxy REFUSES required_scopes alongside a custom verifier ("Configure
        # required scopes on your token verifier instead"), and reads them off the
        # verifier instead — which is why HubUserinfoVerifier carries the full list.
        # On the fallback path there is no verifier to carry them, so pass them here.
        required_scopes=None if token_verifier is not None else scopes,
        extra_authorize_params={"access_type": "offline"},   # Hub: ask for a refresh token
        jwt_signing_key=os.environ.get("FASTMCP_JWT_SIGNING_KEY") or None,
        client_storage=_make_client_storage(),               # persist DCR clients + upstream tokens
        fastmcp_access_token_expiry_seconds=access_ttl,      # don't mirror Hub's short expiry
        # Refresh a token that is about to lapse rather than letting a call race its expiry
        # (FastMCP's default of 0 lets a token 1s from death pass the check, then 401 upstream).
        token_expiry_threshold_seconds=_env_int("OAUTH_TOKEN_REFRESH_LEEWAY_SECONDS", 60),
    )
    # required_scopes does double duty in OIDCProxy: it both (a) advertises the scopes
    # the client must request UPSTREAM — so Hub mints a token YouTrack REST accepts, which
    # needs the YouTrack/Hub service UUIDs — and (b) gates every DOWNSTREAM MCP call. But
    # Hub echoes only standard OIDC scopes (openid/offline_access) in the issued token; the
    # service-id "scopes" are granted as resource access, not as scope claims. Enforcing
    # them downstream makes every authenticated /cmcp call fail 403 insufficient_scope —
    # ChatGPT connects but sees zero tools. The advertised/upstream set is preserved in
    # _default_scope_str, so relax ONLY the downstream gate (auth itself is still enforced).
    # This stays necessary on BOTH verifier paths: OAuthProxy seeds required_scopes and
    # _default_scope_str from `token_verifier.required_scopes`, which is why the verifier
    # above is constructed carrying the full HUB_SCOPES list.
    provider.required_scopes = []
    return provider


def build_app():
    """A single ASGI app serving the transports plus /health, for the hosted
    deployment: streamable HTTP at /mcp and SSE at /sse (both raw-bearer
    pass-through). The two FastMCP apps' lifespans are composed so each transport's
    session manager starts correctly.

    When OAuth is configured (see _build_oauth_provider), a SECOND FastMCP
    instance — same 25 tools via mount() — is served OAuth-protected at /cmcp for
    ChatGPT, and its whole app (auth middleware + OAuth/.well-known routes) is
    mounted at root, matched LAST so the legacy /mcp, /sse and /health win first.
    This keeps the existing Claude/Gemini raw-bearer flows 100% unchanged."""
    from starlette.applications import Starlette
    from starlette.routing import Mount
    http_app = mcp.http_app(transport="http", path="/mcp")
    sse_app = mcp.http_app(transport="sse", path="/sse")
    lifespan_apps = [http_app, sse_app]
    extra_routes = []

    oauth = _build_oauth_provider()
    if oauth is not None:
        oauth_path = os.environ.get("OAUTH_MCP_PATH", "/cmcp")
        mcp_oauth = FastMCP(name="Positrack", instructions=INSTRUCTIONS, auth=oauth,
                            website_url="https://support.posibolt.com",
                            icons=_server_icons())
        mcp_oauth.mount(mcp)  # live-link the same 25 tools (sync, no duplication)
        oauth_app = mcp_oauth.http_app(transport="http", path=oauth_path)
        lifespan_apps.append(oauth_app)
        extra_routes.append(Mount("/", app=oauth_app))
        logging.getLogger("positrack").info("OAuth enabled: ChatGPT endpoint at %s%s", public_url_log(), oauth_path)

    @contextlib.asynccontextmanager
    async def lifespan(app):
        async with contextlib.AsyncExitStack() as stack:
            for a in lifespan_apps:
                await stack.enter_async_context(a.lifespan(app))
            yield

    # Merge the legacy apps' routes (dedup the shared /health custom route by path),
    # then append the OAuth app as a root mount (kept whole, so its middleware lives).
    routes, seen = [], set()
    for r in list(http_app.routes) + list(sse_app.routes):
        key = getattr(r, "path", getattr(r, "path_format", repr(r)))
        if key in seen:
            continue
        seen.add(key)
        routes.append(r)
    # Brand assets must be registered BEFORE extra_routes: the OAuth app goes on as
    # a catch-all Mount("/") and would otherwise swallow them.
    routes.extend(_brand_routes())
    routes.extend(extra_routes)
    return Starlette(routes=routes, lifespan=lifespan)


def _brand_routes():
    """Serve the Positrack mark over HTTP.

    With no favicon on the origin, clients fall back to the DOMAIN's icon — and on
    *.up.railway.app that is Railway's logo, which is why the connector showed
    Railway's brand rather than ours. /favicon.ico is the conventional path browsers
    and several MCP clients probe; /icon.png is what `serverInfo.icons` points at.
    Both serve the same bytes. Missing file degrades to a 404, never a broken boot."""
    from starlette.responses import FileResponse, HTMLResponse, Response
    from starlette.routing import Route
    icon_path = os.path.join(_STATIC_DIR, "icon.png")

    async def _icon(request):
        if not os.path.isfile(icon_path):
            return Response(status_code=404)
        # 1h, not 24h: a stale icon cached for a day is exactly what made the first
        # deploy of this look like it had failed.
        return FileResponse(icon_path, media_type="image/png",
                            headers={"Cache-Control": "public, max-age=3600"})

    # A client can discover our icon three ways and we must cover all three, because
    # it is not documented which one any given host uses:
    #   1. serverInfo.icons          -> _server_icons()
    #   2. GET /favicon.ico          -> here
    #   3. <link rel="icon"> in the ORIGIN ROOT HTML -> here
    # (3) is what most favicon resolvers actually do: fetch "/", parse the HTML,
    # follow the link. "/" used to 404 in text/plain, so a resolver fell straight
    # back to the domain default — Railway's logo. A human landing on the bare URL
    # also got "Not Found", which told them nothing.
    async def _root(request):
        return HTMLResponse(
            '<!doctype html><html lang="en"><head><meta charset="utf-8">'
            '<title>Positrack MCP</title>'
            '<link rel="icon" type="image/png" sizes="512x512" href="/icon.png">'
            '<link rel="apple-touch-icon" href="/icon.png">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<style>body{font:16px/1.6 system-ui,sans-serif;max-width:34rem;'
            'margin:12vh auto;padding:0 1.5rem;color:#1c2530}'
            'a{color:#0968FE}code{background:#eef2f7;padding:.15em .4em;border-radius:4px}'
            '@media(prefers-color-scheme:dark){body{background:#12161c;color:#e6edf5}'
            'code{background:#1e2530}}</style></head><body>'
            '<h1><img src="/icon.png" alt="" width="34" height="34" '
            'style="vertical-align:-8px;margin-right:.4rem">Positrack MCP</h1>'
            '<p>Model Context Protocol server for the Posibolt YouTrack tracker.</p>'
            '<p>This is an API endpoint, not an app — there is nothing to log into here. '
            'Add it as a connector in your assistant:</p>'
            '<p><code>' + (os.environ.get("OAUTH_PUBLIC_URL") or "").rstrip("/") +
            '/cmcp</code></p>'
            '<p><a href="https://github.com/stratahqsa/positrack">Docs and source</a></p>'
            '</body></html>',
            headers={"Cache-Control": "public, max-age=300"})

    return [Route("/", _root, methods=["GET", "HEAD"]),
            Route("/icon.png", _icon, methods=["GET", "HEAD"]),
            Route("/favicon.ico", _icon, methods=["GET", "HEAD"])]


def public_url_log():
    """Best-effort public origin for a friendly startup log line (never secret)."""
    return os.environ.get("OAUTH_PUBLIC_URL", "")


def main():
    _install_log_redaction()
    transport = os.environ.get("POSITRACK_TRANSPORT", "stdio").lower()
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    if transport in ("http", "streamable-http", "streamable_http", "sse", "dual"):
        import uvicorn
        uvicorn.run(build_app(), host=host, port=port, log_level="info")
    else:
        # stdio (local: Claude Desktop/Code, Gemini CLI; token from $YT_TOKEN)
        mcp.run()


if __name__ == "__main__":
    main()
