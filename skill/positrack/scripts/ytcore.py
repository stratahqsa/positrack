#!/usr/bin/env python3
"""
ytcore.py — the shared Positrack engine (stdlib only; nothing hardcoded).

This is the SINGLE SOURCE OF TRUTH for talking to the Posibolt YouTrack instance.
Both the CLI (`cli/yt.py`) and the MCP server (`mcp/server.py`) import it.

Design rules (do not break — they are what makes the engine safe on a multi-user
HTTP server):
  * PURE: every function returns Python data (dict/list) or raises. It NEVER
    prints, NEVER calls sys.exit, and NEVER reads process-global mutable state.
  * PER-CALL AUTH: the caller's token + base URL travel in an explicit `Ctx`
    passed as the first argument to every networked function. There is no global
    token, no os.environ mutation. Two concurrent requests with two different
    tokens can never see each other's identity, permissions, or data.
  * NO SHARED CACHE: discovery is always live here. Caching is a *shell* concern
    (the CLI caches to a local file; the MCP caches in-process keyed by a token
    fingerprint) — never a shared file in core.
  * STRUCTURED ERRORS: failures raise `YTError(status_code, friendly_message,
    raw_body)`. The CLI renders it; the MCP maps it to a structured tool error.
  * WRITE SAFETY: mutating functions take `commit=False` and return a preview
    payload WITHOUT mutating; only `commit=True` applies.

Projects, fields, states and allowed values are all discovered live, with
non-admin fallbacks, so this adapts as the instance changes.
"""
import json, re, time, urllib.request, urllib.parse, urllib.error, mimetypes, uuid, datetime
from collections import Counter

DEFAULT_BASE = "https://support.posibolt.com"

# ---------- error model + per-call context ----------
_TOKEN_RE = re.compile(r"perm-[A-Za-z0-9._\-]+")

def redact(text):
    """Strip anything that looks like a permanent token from a string."""
    if not text:
        return text
    return _TOKEN_RE.sub("perm-***", str(text))

class YTError(Exception):
    """A friendly, structured error. `status_code` is the HTTP code (int) for
    transport errors, or None for validation/domain errors. `raw_body` is the
    (redacted) upstream body, never shown to users by default."""
    def __init__(self, status_code, friendly_message, raw_body=""):
        self.status_code = status_code
        self.friendly_message = friendly_message
        self.raw_body = redact(raw_body)
        super().__init__(friendly_message)

class Ctx:
    """Per-call auth context: the caller's own token + the instance base URL.
    Build a fresh one per request on the server; build one per process on the CLI.
    Never store it in module-level state."""
    __slots__ = ("token", "base")
    def __init__(self, token, base=None):
        if not token:
            raise YTError(None, "ERROR: no token supplied to ytcore.Ctx.")
        self.token = token
        self.base = (base or DEFAULT_BASE).rstrip("/")

FRIENDLY = {
    401: "your token is invalid or expired — regenerate a YouTrack permanent token (Account Security).",
    403: "your token doesn't have permission for this (it acts with YOUR YouTrack rights). "
         "An admin token, or the item's owner, may be required — this is expected, not a bug.",
    404: "not found — double-check the issue/project/article ID.",
    429: "rate-limited by YouTrack — wait a moment and retry.",
    400: "that query or field looks invalid for this project (often a field the "
         "project doesn't have) — run `describe` to see its real fields/values.",
}

# ---------- transport ----------
def _req(ctx, method, path, body=None, raw=None, content_type=None, soft=False):
    headers = {"Authorization": "Bearer " + ctx.token, "Accept": "application/json"}
    data = None
    if raw is not None:
        data = raw
        if content_type:
            headers["Content-Type"] = content_type
    elif body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(ctx.base + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            txt = r.read().decode()
            return json.loads(txt) if txt else {}
    except urllib.error.HTTPError as e:
        if soft:                      # caller wants to try a fallback instead of failing
            return None
        raw_body = e.read().decode()[:400]
        friendly = FRIENDLY.get(e.code)
        raise YTError(e.code, friendly or redact(raw_body), raw_body)
    except urllib.error.URLError as e:
        raise YTError(None, f"Network error reaching {ctx.base}: {e.reason}. "
                            f"Check the base URL / connectivity.", "")

def GET(ctx, path):        return _req(ctx, "GET", path)
def POST(ctx, path, body): return _req(ctx, "POST", path, body=body)

# ---------- dynamic discovery (live; caching is a shell concern) ----------
def projects(ctx):
    """All projects, discovered live. Admin path is precise; non-admin tokens
    fall back to the projects exposed by agile boards. No shared cache here."""
    ps = _req(ctx, "GET",
              "/api/admin/projects?fields=id,shortName,name,archived,leader(login)&$top=300", soft=True)
    if ps is None:
        ags = GET(ctx, "/api/agiles?fields=projects(id,shortName,name)&$top=200")
        seen = {}
        for ag in ags:
            for p in (ag.get("projects") or []):
                if p.get("shortName"):
                    seen[p["shortName"]] = p
        ps = list(seen.values())
    return ps

def project_id(ctx, short):
    short = short.upper()
    for p in projects(ctx):
        if (p.get("shortName") or "").upper() == short:
            return p["id"]
    raise YTError(None, f"ERROR: project '{short}' not found. Run `yt.py projects` to list.")

_TYPE_FROM_CFTYPE = {  # reverse-map issue customField $type -> fieldType id (non-admin fallback)
    "SingleEnumIssueCustomField": "enum[1]", "MultiEnumIssueCustomField": "enum[*]",
    "StateIssueCustomField": "state[1]", "StateMachineIssueCustomField": "state[1]",
    "SingleUserIssueCustomField": "user[1]", "MultiUserIssueCustomField": "user[*]",
    "SingleVersionIssueCustomField": "version[1]", "MultiVersionIssueCustomField": "version[*]",
    "SingleBuildIssueCustomField": "build[1]", "MultiBuildIssueCustomField": "build[*]",
    "SingleOwnedIssueCustomField": "ownedField[1]", "MultiOwnedIssueCustomField": "ownedField[*]",
    "SingleGroupIssueCustomField": "group[1]", "MultiGroupIssueCustomField": "group[*]",
    "PeriodIssueCustomField": "period", "DateIssueCustomField": "date",
    "TextIssueCustomField": "text", "SimpleIssueCustomField": "string",
}

def field_schema(ctx, short):
    """{field_name: fieldType_id} for a project, discovered live.
    Admin path is precise; non-admin tokens infer types from a sample issue."""
    pid = project_id(ctx, short)
    fs = _req(ctx, "GET",
              f"/api/admin/projects/{pid}/customFields?fields=field(name,fieldType(id))&$top=200", soft=True)
    if fs is not None:
        return {f["field"]["name"]: f["field"]["fieldType"]["id"] for f in fs if f.get("field")}
    sample = get_issues(ctx, f"project: {short}", fields="customFields(name,$type)", limit=1)
    out = {}
    if sample:
        for c in sample[0].get("customFields", []):
            out[c["name"]] = _TYPE_FROM_CFTYPE.get(c.get("$type"), "string")
    return out

def field_values(ctx, short, field):
    """Allowed enum/state values for a field in a project."""
    pid = project_id(ctx, short)
    fs = GET(ctx, f"/api/admin/projects/{pid}/customFields"
                  f"?fields=field(name),bundle(values(name,archived))&$top=200")
    for f in fs:
        if (f.get("field") or {}).get("name") == field:
            return [v["name"] for v in ((f.get("bundle") or {}).get("values") or []) if not v.get("archived")]
    return []

# ---------- issue I/O ----------
ISSUE_FIELDS = ("idReadable,summary,created,resolved,updated,"
                "reporter(login,fullName),project(shortName),"
                "customFields(name,value(name,login,fullName,minutes,presentation,text))")

def get_issues(ctx, query, fields=ISSUE_FIELDS, top=200, limit=None):
    out, skip = [], 0
    while True:
        page = GET(ctx, f"/api/issues?query={urllib.parse.quote(query)}"
                        f"&fields={urllib.parse.quote(fields)}&$top={top}&$skip={skip}")
        out.extend(page)
        if len(page) < top or (limit and len(out) >= limit):
            break
        skip += len(page)
    return out[:limit] if limit else out

def count(ctx, query):
    for _ in range(40):
        c = POST(ctx, "/api/issuesGetter/count?fields=count", {"query": query}).get("count", -1)
        if c != -1:
            return c
        time.sleep(0.3)
    return -1

# ---------- pure helpers (no network) ----------
def cf_map(it): return {c["name"]: c.get("value") for c in it.get("customFields", [])}

def vname(v):
    if v is None: return ""
    if isinstance(v, list): return ", ".join(vname(x) for x in v)
    if isinstance(v, dict):
        return v.get("name") or v.get("fullName") or v.get("login") or v.get("presentation") or v.get("text") or ""
    return str(v)

DAY = 86400000
def days_since(ms): return round((time.time()*1000 - ms)/DAY, 1) if ms else None

def parse_period(s):
    if s is None: return None
    s = str(s).strip()
    if s.isdigit(): return int(s)
    total = 0
    for num, unit in re.findall(r"(\d+)\s*([wdhm])", s.lower()):
        total += int(num) * {"w": 2400, "d": 480, "h": 60, "m": 1}[unit]
    return total or None

def cf_entry(name, ftype, value):
    """Correctly-typed customFields entry. NOTE: for State / Assignee / Priority /
    Sprint transitions, prefer the Commands API (`run_command`) — it respects the
    project's state-machine workflow, which a raw field set can violate."""
    base = ftype.split("[")[0]; multi = ftype.endswith("[*]")
    parts = [x.strip() for x in str(value).split(",")] if multi else value
    named = {"enum": "EnumIssueCustomField", "ownedField": "OwnedIssueCustomField",
             "version": "VersionIssueCustomField", "build": "BuildIssueCustomField",
             "group": "GroupIssueCustomField"}
    if base in named:
        shape = [{"name": x} for x in parts] if multi else {"name": parts}
        return {"name": name, "$type": ("Multi" if multi else "Single") + named[base], "value": shape}
    if base == "user":
        shape = [{"login": x} for x in parts] if multi else {"login": parts}
        return {"name": name, "$type": ("Multi" if multi else "Single") + "UserIssueCustomField", "value": shape}
    special = {
        "state":   ("StateIssueCustomField", lambda v: {"name": v}),
        "period":  ("PeriodIssueCustomField", lambda v: {"minutes": parse_period(v)}),
        "date":    ("DateIssueCustomField", lambda v: int(v)),
        "integer": ("SimpleIssueCustomField", lambda v: int(v)),
        "float":   ("SimpleIssueCustomField", lambda v: float(v)),
        "string":  ("SimpleIssueCustomField", lambda v: v),
        "text":    ("TextIssueCustomField", lambda v: {"$type": "TextFieldValue", "text": v}),
    }
    typ, conv = special.get(base, ("SimpleIssueCustomField", lambda v: v))
    return {"name": name, "$type": typ, "value": conv(value)}

def scope_clause(project="", location=""):
    """Leading query scope from project/location (mirrors the CLI's old ctx_scope)."""
    clause = ""
    if project:
        clause += f"project: {project} "
    if location:
        clause += (f"Location: {{{location}}} " if " " in location else f"Location: {location} ")
    return clause

def build_cf(ctx, short, fields):
    """fields: {name: value}. Validates names against the live schema."""
    if not fields: return []
    fs = field_schema(ctx, short); entries = []
    for name, value in fields.items():
        name = name.strip()
        if name not in fs:
            raise YTError(None, f"field '{name}' not in {short}. Fields: {', '.join(sorted(fs))}")
        entries.append(cf_entry(name, fs[name], value))
    return entries

# ---------- at-a-glance visuals (dependency-free; render in any client) ----------
def bar(n, maxn, width=14):
    """A Unicode bar for n out of maxn — screen-shareable, renders anywhere a
    monospaced/markdown block does. Empty string when there's nothing to scale to."""
    if not isinstance(n, int) or n < 0 or not maxn or maxn <= 0:
        return ""
    filled = max(0, min(width, int(round(width * n / maxn))))
    return "█" * filled + "░" * (width - filled)

def _cell(v):
    """Render a count cell: None (query rejected) -> em dash; -1 (transient) -> ellipsis."""
    if v is None:
        return "—"
    if v == -1:
        return "…"
    return v

def count_soft(ctx, query):
    """count() but tolerant: returns None when YouTrack rejects the query (e.g. a
    field a project doesn't have), so one bad cell never aborts a whole report."""
    try:
        return count(ctx, query)
    except YTError:
        return None


# ---------- identity & context ----------
def whoami(ctx):
    return GET(ctx, "/api/users/me?fields=login,fullName,email")

def describe(ctx, project):
    """{'fields': {name:type}, 'values': {key:[vals]}} for a project."""
    fs = field_schema(ctx, project)
    values = {}
    for key in ("State", "Type", "TaskType", "Priority", "Location", "Category", "Team"):
        if key in fs:
            vals = field_values(ctx, project, key)
            if vals:
                values[key] = vals
    return {"project": project, "fields": fs, "values": values}

# ---------- read ----------
def search(ctx, query, project="", location="", limit=50):
    """Return raw issues for a (scoped) query. Column selection is a shell concern."""
    q = (scope_clause(project, location) + query).strip()
    return get_issues(ctx, q, limit=limit)

def search_query(query, project="", location=""):
    """The exact scoped query string a search will display/use (pure)."""
    return (scope_clause(project, location) + query).strip()

def get_issue(ctx, iid):
    base = GET(ctx, f"/api/issues/{iid}?fields={urllib.parse.quote(ISSUE_FIELDS)}")
    links = GET(ctx, f"/api/issues/{iid}/links?fields=direction,linkType(name,sourceToTarget,targetToSource),"
                     f"issues(idReadable,summary,resolved)")
    comments = GET(ctx, f"/api/issues/{iid}/comments?fields=text,created,author(login)&$top=8")
    return {"base": base, "links": links, "comments": comments}

def _issue_block(query, columns, issues):
    return {"kind": "search", "query": query, "columns": columns, "issues": issues}

def report(ctx, rtype, project="", location="", days=7, sprint="", limit=50):
    """Run a canned report. Returns an ordered list of structured blocks so any
    shell can render or serialize it. `project` here is already resolved by the
    shell (no profile read in core)."""
    scope = scope_clause(project, location)
    proj = project or None
    if rtype == "health":
        targets = [proj] if proj else [p["shortName"] for p in projects(ctx) if not p.get("archived")]
        raw = []
        for s in targets:
            raw.append([s,
                        count_soft(ctx, f"project: {s}"),
                        count_soft(ctx, f"project: {s} #Unresolved"),
                        count_soft(ctx, f"project: {s} #Unresolved has: -{{Estimate}}"),
                        count_soft(ctx, f"project: {s} #Unresolved #Unassigned"),
                        count_soft(ctx, f"project: {s} #Unresolved updated: * .. {{minus 30d}}")])
        opens = [r[2] for r in raw if isinstance(r[2], int) and r[2] >= 0]
        maxopen = max(opens) if opens else 0
        rows = [[r[0], _cell(r[1]), _cell(r[2]), _cell(r[3]), _cell(r[4]), _cell(r[5]), bar(r[2], maxopen)]
                for r in raw]
        return [{"kind": "raw", "s": "# Board health\n"},
                {"kind": "table",
                 "headers": ["Proj", "Total", "Open", "Open-unest", "Open-unassg", "Stale>30d", "Open ▕"],
                 "rows": rows}]
    if rtype == "activity":
        s = scope.strip()
        label = s or "(whole instance)"
        created = count(ctx, f"{s} created: {{minus {days}d}} .. Today".strip())
        resolved = count(ctx, f"{s} resolved date: {{minus {days}d}} .. Today".strip())
        updated = count(ctx, f"{s} updated: {{minus {days}d}} .. Today".strip())
        q_res = search_query(f"resolved date: {{minus {days}d}} .. Today sort by: updated desc", project, location)
        q_new = search_query(f"created: {{minus {days}d}} .. Today sort by: created desc", project, location)
        iss_res = get_issues(ctx, q_res, limit=25)
        iss_new = get_issues(ctx, q_new, limit=25)
        return [{"kind": "raw", "s": f"# Activity (last {days}d) — {label}\n"},
                {"kind": "table", "headers": ["Created", "Resolved", "Updated"], "rows": [[created, resolved, updated]]},
                {"kind": "raw", "s": "\n## Resolved in window"},
                _issue_block(q_res, ["id", "project", "summary", "Assignee"], iss_res),
                {"kind": "raw", "s": "\n## Newly created in window"},
                _issue_block(q_new, ["id", "project", "summary", "State", "Assignee"], iss_new)]
    if rtype == "briefing":
        if not proj:
            raise YTError(None, "briefing needs --project (or a default project in your profile)")
        blocks = [{"kind": "raw", "s": f"# Weekly briefing — {proj} (last {days}d)\n"},
                  {"kind": "table", "headers": ["Resolved", "Created", "Still open"], "rows": [[
                      count(ctx, f"project: {proj} resolved date: {{minus {days}d}} .. Today"),
                      count(ctx, f"project: {proj} created: {{minus {days}d}} .. Today"),
                      count(ctx, f"project: {proj} #Unresolved"),
                  ]]},
                  {"kind": "raw", "s": "\n## Process outliers"}]
        fs = field_schema(ctx, proj); states = field_values(ctx, proj, "State")
        brace = lambda v: "{%s}" % v if " " in v else v
        outliers = [("Open & unassigned", f"project: {proj} #Unresolved #Unassigned"),
                    ("Stale > 30d (open)", f"project: {proj} #Unresolved updated: * .. {{minus 30d}}")]
        if "Estimate" in fs:
            outliers.insert(0, ("Open & unestimated", f"project: {proj} #Unresolved has: -{{Estimate}}"))
        blocked = [s for s in states if re.search(r"block|hold", s, re.I)]
        reopen = [s for s in states if re.search(r"re.?open", s, re.I)]
        if blocked:
            outliers.append(("Blocked / On-hold", f"project: {proj} State: " + ", ".join(brace(b) for b in blocked)))
        if reopen:
            outliers.append(("Reopened", f"project: {proj} State: " + ", ".join(brace(r) for r in reopen)))
        blocks.append({"kind": "table", "headers": ["Outlier", "Count"],
                       "rows": [[name, count(ctx, q)] for name, q in outliers]})
        blocks.append({"kind": "raw", "s": "\n## Oldest open items"})
        q_old = search_query("#Unresolved sort by: created asc", proj, "")
        blocks.append(_issue_block(q_old, ["id", "summary", "State", "Assignee", "age"],
                                   get_issues(ctx, q_old, limit=12)))
        return blocks
    if rtype == "myday":
        # The caller's personal view: what's theirs, what's gone stale (needs a
        # quick status), what's in progress. Powers the "your day" + stale-nudge
        # + the self-updating-board batch. `for: me` works across their projects.
        open_mine = count_soft(ctx, f"{scope}#Unresolved for: me")
        stale_q = search_query(f"#Unresolved for: me updated: * .. {{minus {days}d}} sort by: updated asc",
                               project, location)
        prog_q = search_query("#Unresolved for: me sort by: updated desc", project, location)
        stale = get_issues(ctx, stale_q, limit=15)
        prog = get_issues(ctx, prog_q, limit=15)
        return [{"kind": "raw", "s": f"# Your day — {_cell(open_mine)} open · {len(stale)} stale (>{days}d)\n"},
                {"kind": "raw", "s": "\n## Stale — needs a quick status from you"},
                _issue_block(stale_q, ["id", "project", "summary", "State", "age"], stale),
                {"kind": "raw", "s": "\n## In progress (you)"},
                _issue_block(prog_q, ["id", "project", "summary", "State", "age"], prog)]
    if rtype == "hygiene":
        # Turns "the board is messy" into a scored, finishable cleanup quest.
        # Hygiene% = share of open work touched in the last 30 days (stale = untouched).
        # The buckets (stale / unassigned / unestimated) are the quest items to clear.
        targets = [proj] if proj else [p["shortName"] for p in projects(ctx) if not p.get("archived")]
        rows, attention = [], 0
        for s in targets:
            op = count_soft(ctx, f"project: {s} #Unresolved")
            st = count_soft(ctx, f"project: {s} #Unresolved updated: * .. {{minus 30d}}")
            un = count_soft(ctx, f"project: {s} #Unresolved #Unassigned")
            ue = count_soft(ctx, f"project: {s} #Unresolved has: -{{Estimate}}")
            o = op if isinstance(op, int) and op > 0 else 0
            stale = st if isinstance(st, int) and st >= 0 else 0
            score = round(100 * (o - stale) / o) if o else 100
            for x in (st, un, ue):
                if isinstance(x, int) and x > 0:
                    attention += x
            rows.append([s, _cell(op), _cell(st), _cell(un), _cell(ue), f"{score}%", bar(score, 100)])
        return [{"kind": "raw", "s": "# Board hygiene\n"},
                {"kind": "table",
                 "headers": ["Proj", "Open", "Stale", "Unassigned", "No-est", "Hygiene", "▕"],
                 "rows": rows},
                {"kind": "raw", "s": f"\n**{attention} item(s) need attention (stale / unassigned / "
                                     f"unestimated) — clear them to push hygiene toward 100%.**"}]
    # stale / unestimated / unassigned / epics / mywork / sprint
    qmap = {
        "stale":       f"#Unresolved updated: * .. {{minus {days}d}} sort by: updated asc",
        "unestimated": "#Unresolved has: -{Estimate} sort by: created asc",
        "unassigned":  "#Unresolved #Unassigned sort by: created asc",
        "epics":       "Type: Epic, TaskType: EPIC sort by: State",
        "mywork":      "#Unresolved for: me sort by: updated desc",
        "sprint":      f"Sprints: {{{sprint}}} sort by: State" if sprint else None,
    }
    q = qmap.get(rtype)
    if q is None:
        raise YTError(None, "sprint report needs --sprint NAME")
    scoped = search_query(q, project, location)
    return [_issue_block(scoped, ["id", "project", "summary", "State", "Assignee"],
                         get_issues(ctx, scoped, limit=limit))]

def boards(ctx, project=""):
    ags = GET(ctx, "/api/agiles?fields=name,projects(shortName),"
                   "sprints(name,isDefault,archived,start,finish)&$top=100")
    want = (project or "").upper()
    out = []
    for ag in ags:
        codes = [p.get("shortName", "") for p in (ag.get("projects") or [])]
        if want and want not in [c.upper() for c in codes]:
            continue
        live = [s["name"] for s in (ag.get("sprints") or []) if not s.get("archived")]
        out.append({"name": ag["name"], "projects": codes, "sprints": live})
    return out

def history(ctx, issue, limit=20):
    cats = "IssueCreatedCategory,CustomFieldCategory,LinksCategory,SprintCategory"
    acts = GET(ctx, f"/api/issues/{issue}/activities?categories={cats}"
                    f"&fields=timestamp,author(login),field(name),"
                    f"added(name,presentation,login),removed(name,presentation,login)&$top={limit}")
    def fmt(xs):
        if not isinstance(xs, list): return ""
        return ", ".join(x.get("name") or x.get("presentation") or x.get("login")
                         for x in xs if isinstance(x, dict) and (x.get("name") or x.get("presentation") or x.get("login")))
    out = []
    for e in acts:
        ts = e.get("timestamp")
        d = datetime.datetime.utcfromtimestamp(ts/1000).strftime("%Y-%m-%d") if ts else "?"
        out.append({"date": d, "who": (e.get("author") or {}).get("login", "?"),
                    "field": (e.get("field") or {}).get("name", ""),
                    "added": fmt(e.get("added")), "removed": fmt(e.get("removed"))})
    return out

# ---------- people & continuity ----------
def banned_logins(ctx):
    return [u["login"] for u in GET(ctx, "/api/users?fields=login,banned&$top=400") if u.get("banned")]

def users(ctx, banned=False, active=False, grep="", limit=400):
    us = GET(ctx, "/api/users?fields=login,fullName,banned,online,email&$top=400")
    if banned: us = [u for u in us if u.get("banned")]
    if active: us = [u for u in us if not u.get("banned")]
    if grep:
        g = grep.lower()
        us = [u for u in us if g in ((u.get("login") or "") + (u.get("fullName") or "")).lower()]
    return {"total": len(us), "users": us[:limit]}

def orphans(ctx, project="", limit=50):
    """Open work that will be stranded by departures. Returns structured blocks."""
    banned = banned_logins(ctx)
    scope = f"project: {project} " if project else ""
    blocks = [{"kind": "raw",
               "s": f"# Orphan risk{f' in {project}' if project else ''} (open work that needs a new owner)\n"}]
    if banned:
        bq = "Assignee: " + ", ".join(banned)
        n = count(ctx, f"{scope}#Unresolved {bq}")
        blocks.append({"kind": "raw", "s": f"**Open issues assigned to {len(banned)} deactivated user(s): {n}**\n"})
        if n:
            q = search_query(f"#Unresolved {bq} sort by: updated desc", project, "")
            blocks.append(_issue_block(q, ["id", "project", "summary", "State", "Assignee"],
                                       get_issues(ctx, q, limit=limit)))
    unassg = count(ctx, f"{scope}#Unresolved #Unassigned")
    blocks.append({"kind": "raw",
                   "s": f"\n**Plus currently unassigned open: {unassg}** "
                        f"(use `report unassigned{' --project '+project if project else ''}` to list)"})
    return blocks

def load(ctx, project):
    if not project:
        raise YTError(None, "load needs --project (or a default project in your profile)")
    issues = get_issues(ctx, f"project: {project} #Unresolved",
                        fields="idReadable,customFields(name,value(fullName,login))", limit=3000)
    c = Counter()
    for it in issues:
        c[vname(cf_map(it).get("Assignee")) or "(unassigned)"] += 1
    owners = c.most_common(25)
    maxn = owners[0][1] if owners else 0
    by_owner = [[who, n, bar(n, maxn)] for who, n in owners]
    return {"project": project, "open": len(issues), "by_owner": by_owner}

def reassign(ctx, from_user, to_user, project="", comment="", commit=False, instance_wide=False):
    if not project and not instance_wide:
        raise YTError(None, "reassign needs a project scope (high blast radius otherwise). "
                            "Pass a project, or set instance_wide=True / --instance-wide to override.")
    scope = f"project: {project} " if project else ""
    issues = get_issues(ctx, f"{scope}#Unresolved Assignee: {from_user}", fields="idReadable,summary", limit=500)
    ids = [it["idReadable"] for it in issues]
    out = {"from_user": from_user, "to_user": to_user, "ids": ids, "count": len(ids),
           "preview": [{"id": it["idReadable"], "summary": (it.get("summary") or "")[:60]} for it in issues[:30]],
           "more": max(0, len(ids) - 30), "committed": bool(commit)}
    if commit and ids:
        POST(ctx, "/api/commands?fields=issues(idReadable)",
             {"query": f"for {to_user}", "issues": [{"idReadable": i} for i in ids],
              "comment": comment or f"Reassigned from {from_user} during team changes."})
        out["reassigned"] = len(ids)
    return out

# ---------- writes (preview by default) ----------
def create(ctx, project, summary, description="", fields=None, commit=False):
    payload = {"project": {"id": project_id(ctx, project)}, "summary": summary}
    if description:
        payload["description"] = description
    cfs = build_cf(ctx, project, fields or {})
    if cfs:
        payload["customFields"] = cfs
    out = {"label": f"create issue in {project}", "payload": payload, "committed": bool(commit)}
    if commit:
        r = POST(ctx, "/api/issues?fields=idReadable,summary", payload)
        out["created"] = {"idReadable": r.get("idReadable"), "summary": r.get("summary")}
    return out

def update(ctx, issue, summary="", description="", fields=None, commit=False):
    short = issue.split("-")[0]; payload = {}
    if summary:
        payload["summary"] = summary
    if description:
        payload["description"] = description
    cfs = build_cf(ctx, short, fields or {})
    if cfs:
        payload["customFields"] = cfs
    if not payload:
        raise YTError(None, "nothing to update")
    out = {"label": f"update {issue}", "payload": payload, "committed": bool(commit)}
    if commit:
        out["updated"] = POST(ctx, f"/api/issues/{issue}?fields=idReadable", payload).get("idReadable")
    return out

def comment(ctx, issue, text, commit=False):
    out = {"label": f"comment on {issue}", "payload": {"text": text}, "committed": bool(commit)}
    if commit:
        POST(ctx, f"/api/issues/{issue}/comments?fields=id", {"text": text})
        out["commented"] = issue
    return out

def log_time(ctx, issue, time_str, text="", type="", commit=False):
    payload = {"duration": {"minutes": parse_period(time_str)}}
    if text:
        payload["text"] = text
    if type:
        payload["type"] = {"name": type}
    out = {"label": f"log {time_str} on {issue}", "payload": payload, "committed": bool(commit)}
    if commit:
        POST(ctx, f"/api/issues/{issue}/timeTracking/workItems?fields=id,duration(presentation)", payload)
        out["logged"] = {"issue": issue, "time": time_str}
    return out

def run_command(ctx, issues, query, comment="", commit=False):
    """Apply a YouTrack command (e.g. 'state Testing assignee jsmith') to issues.
    Preview validates via /commands/assist (non-mutating); commit applies."""
    issue_list = [{"idReadable": i.strip()} for i in issues.split(",") if i.strip()]
    ids = [i["idReadable"] for i in issue_list]
    if not commit:
        r = POST(ctx, "/api/commands/assist?fields=commands(description,error),query",
                 {"query": query, "issues": issue_list})
        parsed = [{"ok": not c.get("error"), "description": re.sub("<[^>]+>", "", c.get("description", ""))}
                  for c in r.get("commands", [])]
        return {"label": f"command on {', '.join(ids)}", "query": query, "issues": ids,
                "committed": False, "parsed": parsed}
    body = {"query": query, "issues": issue_list}
    if comment:
        body["comment"] = comment
    POST(ctx, "/api/commands?fields=issues(idReadable)", body)
    return {"label": f"command on {', '.join(ids)}", "query": query, "issues": ids,
            "committed": True, "applied": query}

def attach(ctx, issue, file_name, data, commit=False):
    """Attach raw bytes `data` as `file_name` to `issue`. The shell is responsible
    for reading the bytes (local path on the CLI, base64 over HTTP)."""
    out = {"label": f"attach {file_name} to {issue}", "committed": bool(commit)}
    if commit:
        boundary = "----ytb" + uuid.uuid4().hex
        ctype = mimetypes.guess_type(file_name)[0] or "application/octet-stream"
        body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{file_name}\"\r\n"
                f"Content-Type: {ctype}\r\n\r\n").encode() + data + f"\r\n--{boundary}--\r\n".encode()
        _req(ctx, "POST", f"/api/issues/{issue}/attachments?fields=id,name", raw=body,
             content_type=f"multipart/form-data; boundary={boundary}")
        out["attached"] = file_name
    return out

# ---------- knowledge base & breadth ----------
def articles(ctx, query="", limit=40):
    arts = GET(ctx, "/api/articles?fields=idReadable,summary,project(shortName)&$top=400")
    if query:
        ql = query.lower()
        arts = [x for x in arts if ql in (x.get("summary") or "").lower()]
    return {"total": len(arts), "query": query, "articles": arts[:limit]}

def article(ctx, aid):
    return GET(ctx, f"/api/articles/{aid}?fields=idReadable,summary,content,project(shortName),reporter(login)")

def article_create(ctx, project, summary, content="", commit=False):
    payload = {"summary": summary, "content": content, "project": {"id": project_id(ctx, project)}}
    out = {"label": f"create KB article in {project}", "payload": payload, "committed": bool(commit)}
    if commit:
        r = POST(ctx, "/api/articles?fields=idReadable,summary", payload)
        out["created"] = {"idReadable": r.get("idReadable"), "summary": r.get("summary")}
    return out

def tags(ctx):
    return GET(ctx, "/api/tags?fields=name,owner(login)&$top=300")

def saved(ctx):
    return GET(ctx, "/api/savedQueries?fields=name,query,owner(login)&$top=100")
