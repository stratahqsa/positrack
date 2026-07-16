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
    if fs:
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

# ---------- effort report constants (Suhail's PXB1 Phase-1 recipe; pure) ----------
# A man-day is 8h; every estimate/spend rollup is reported in man-days off this.
MAN_DAY = 480
# Case-insensitive substring match against a State name marks an issue "done".
DONE_STATES = ("done", "fixed", "verified", "closed", "won't fix", "duplicate", "obsolete")
# The reporting baseline: epics resolved after this land in the Done section, and
# a Scope PHASE 1->PHASE 2 change after this marks an epic as P2-backlog.
EFFORT_CUTOFF_DEFAULT = "2026-06-29T10:30:00.000Z"

def iso_to_ms(iso):
    """Parse an ISO-8601 UTC timestamp ('...Z', optional fractional seconds) to
    epoch milliseconds. Stdlib + 3.9-safe (no datetime.fromisoformat 'Z' support)."""
    if not iso:
        return None
    s = str(iso).strip()
    fmt = "%Y-%m-%dT%H:%M:%S.%fZ" if "." in s else "%Y-%m-%dT%H:%M:%SZ"
    dt = datetime.datetime.strptime(s, fmt).replace(tzinfo=datetime.timezone.utc)
    return int(dt.timestamp() * 1000)

def is_done_state(state):
    """True if a State name (epic or story) is a terminal/done state."""
    s = (state or "").lower()
    return any(d in s for d in DONE_STATES)

def parse_period(s):
    if s is None: return None
    s = str(s).strip()
    if s.isdigit(): return int(s)
    total = 0
    for num, unit in re.findall(r"(\d+)\s*([wdhm])", s.lower()):
        total += int(num) * {"w": 2400, "d": 480, "h": 60, "m": 1}[unit]
    return total or None

def fmt_minutes(m):
    """Render a minute total as 'Hh Mm' (e.g. 110 -> '1h 50m'), matching how
    YouTrack presents Spent time. Used for true-logged-time sums where the API
    gives raw minutes but no presentation string."""
    m = int(m or 0)
    return f"{m // 60}h {m % 60}m"

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

# ---------- effort report (ported from Suhail's PXB1 Phase-1 recipe; pure core) ----------
# The engine port of the browser recipe in PXB1_Phase1_Report_Context.md. Every
# rule below mirrors that oracle exactly so the ported numbers reproduce the report:
#   * epics discovered by `TaskType: EPIC` (custom field) — NOT `type: Epic`
#   * stories via Subtask/OUTWARD links off each epic
#   * DONE / PENDING / MIXED / NO_STORIES per State
#   * estimate rollup = Server+UI+Testing over PENDING Phase-1 stories, with an
#     epic-level fallback ONLY for epics with no stories at all (NO_STORIES)
#   * P2 backlog via activity history (Scope PHASE 1->PHASE 2 after the cutoff)
#   * true spend from a work-item sweep attributed story->epic (NOT the Spent-time
#     rollup, which — verified live — is not backed by work items on the epic)
_EST_FIELDS = ("Server Estimation", "UI Estimation", "Testing Estimation")

def _cf_named(issue, name):
    """The raw `value` of a customField by name on a recipe-shaped issue dict."""
    for cf in (issue.get("customFields") or []):
        if cf.get("name") == name:
            return cf.get("value")
    return None

def _cf_minutes(issue, name):
    """`value.minutes` of a period customField, or 0."""
    v = _cf_named(issue, name)
    return int(v["minutes"]) if isinstance(v, dict) and v.get("minutes") else 0

def _cf_str(issue, name):
    """`value.name` of an enum/state customField (e.g. State, Scope), or ''."""
    v = _cf_named(issue, name)
    if isinstance(v, dict):
        return v.get("name") or ""
    return v or ""

def _epic_stories(epic):
    """Extract the Subtask/OUTWARD child stories of a recipe-shaped epic dict as a
    list of normalized story dicts (id, summary, state, scope, assignee, est)."""
    stories = []
    for lk in (epic.get("links") or []):
        if (lk.get("linkType") or {}).get("name") == "Subtask" and lk.get("direction") == "OUTWARD":
            for s in (lk.get("issues") or []):
                stories.append({
                    "id": s.get("idReadable") or "",
                    "summary": s.get("summary") or "",
                    "state": _cf_str(s, "State"),
                    "scope": _cf_str(s, "Scope"),
                    "type": _cf_str(s, "TaskType"),
                    "priority": _cf_str(s, "Priority"),
                    "assignee": _cf_str(s, "Assignee"),
                    "created": s.get("created"),
                    "est": {"server": _cf_minutes(s, "Server Estimation"),
                            "ui": _cf_minutes(s, "UI Estimation"),
                            "testing": _cf_minutes(s, "Testing Estimation")},
                })
    return stories

def categorize_epic(epic):
    """PURE port of recipe Step 4. Given one recipe-shaped epic dict (idReadable,
    summary, created, resolved, assignee(name), customFields, links), return a
    categorized record: category (DONE/PENDING/MIXED/NO_STORIES), the pending-P1
    estimate rollup {server,ui,testing} with epic-level fallback, the missing-est
    flag, and the child story list. No network."""
    stories = _epic_stories(epic)
    # Scope-leakage signals (v15 parity): stories deferred to Phase 2 under a P1 epic,
    # plus how many P1 stories are still pending. Derived from child scopes/states we
    # already fetched — no extra calls. A P1 epic with P2 stories is being partially
    # deferred ("hollowed out"), which the tower should surface as a watch item.
    p2_stories = sum(1 for s in stories if "PHASE 2" in (s.get("scope") or "").upper())
    p1_pending = sum(1 for s in stories
                     if "PHASE 2" not in (s.get("scope") or "").upper()
                     and not is_done_state(s.get("state")))
    epic_state = _cf_str(epic, "State")
    epic_est = {"server": _cf_minutes(epic, "Server Estimation"),
                "ui": _cf_minutes(epic, "UI Estimation"),
                "testing": _cf_minutes(epic, "Testing Estimation")}
    rollup_all = {"server": 0, "ui": 0, "testing": 0}
    for s in stories:
        rollup_all["server"] += s["est"]["server"]
        rollup_all["ui"] += s["est"]["ui"]
        rollup_all["testing"] += s["est"]["testing"]
    rec = {"id": epic.get("idReadable"), "summary": epic.get("summary") or "",
           "created": epic.get("created"), "resolved": epic.get("resolved"),
           "assignee": _cf_str(epic, "Assignee"),
           "priority": _cf_str(epic, "Priority"), "module": _cf_str(epic, "Module"),
           "p2_stories": p2_stories, "p1_pending": p1_pending, "has_p2": p2_stories > 0,
           "epic_state": epic_state, "stories": stories, "rollup_all": rollup_all,
           "epic_est": epic_est}
    if is_done_state(epic_state):
        rec["category"] = "DONE"
        rec["rollup"] = {"server": 0, "ui": 0, "testing": 0}
        rec["missing_est"] = False
        return rec
    done_s = [s for s in stories if is_done_state(s["state"])]
    pend_s = [s for s in stories if not is_done_state(s["state"])]
    # pending & (no scope OR Phase-1) stories drive the estimate rollup
    p1p = [s for s in pend_s if (not s["scope"]) or ("PHASE 1" in s["scope"].upper())]
    rollup = {"server": sum(s["est"]["server"] for s in p1p),
              "ui": sum(s["est"]["ui"] for s in p1p),
              "testing": sum(s["est"]["testing"] for s in p1p)}
    # epic-level fallback: ONLY when the epic has no stories at all (NO_STORIES) —
    # that's the sole case where the epic's own Estimation fields are the only
    # numbers that exist. Epics WITH stories keep the pending-P1 rollup as-is,
    # including real zeros (e.g. a backend-only pending story genuinely has UI=0).
    # This used to apply per-field to every epic, so it also fired whenever a
    # single component happened to be 0 despite real pending stories existing, or
    # whenever an epic's only pending stories were out-of-phase (Phase 2, so p1p
    # was empty even though the epic has stories) — silently substituting the
    # epic's own Estimation fields, which are often stale totals across ALL of the
    # epic's stories (done included), into what's supposed to be a pending-only
    # remaining-effort number (verified live against PXB1-513 and PXB1-414).
    if not stories:
        if rollup["server"] == 0 and epic_est["server"] > 0:
            rollup["server"] = epic_est["server"]
        if rollup["ui"] == 0 and epic_est["ui"] > 0:
            rollup["ui"] = epic_est["ui"]
        if rollup["testing"] == 0 and epic_est["testing"] > 0:
            rollup["testing"] = epic_est["testing"]
    rec["rollup"] = rollup
    if not stories:
        rec["category"] = "NO_STORIES"
    elif not done_s:
        rec["category"] = "PENDING"
    else:
        rec["category"] = "MIXED"
    # missing-estimate flag: (Dev=0 AND UI=0) OR QA=0 — only meaningful for open work
    rec["missing_est"] = (rollup["server"] == 0 and rollup["ui"] == 0) or (rollup["testing"] == 0)
    return rec

def _scope_changed_p1_to_p2(activities, cutoff_ms):
    """PURE port of recipe Step 6's filter: True if the CustomFieldCategory activity
    list contains a Scope change removing 'PHASE 1' and adding 'PHASE 2' after the
    cutoff. Returns (matched, latest_change_ms). No network."""
    latest = None
    for a in (activities or []):
        if (a.get("field") or {}).get("name") != "Scope":
            continue
        ts = a.get("timestamp") or 0
        if ts <= cutoff_ms:
            continue
        removed = a.get("removed") or []
        added = a.get("added") or []
        if any((x or {}).get("name") == "PHASE 1" for x in removed) and \
           any((x or {}).get("name") == "PHASE 2" for x in added):
            if latest is None or ts > latest:
                latest = ts
    return (latest is not None), latest

def _build_story_epic_map(cats):
    """PURE: {story_id -> epic_id} from categorized epics' Subtask/OUTWARD children.
    First writer wins if a story is (unusually) linked under two epics."""
    m = {}
    for rec in cats:
        eid = rec["id"]
        for s in rec["stories"]:
            sid = s["id"]
            if sid and sid not in m:
                m[sid] = eid
    return m

def _attribute_spend(items, story_epic_map, epic_ids, bug_parent_map=None):
    """PURE (Consensus Rev #2): bucket normalized work-item minutes to epics.
      * time logged directly on an epic  -> that epic
      * time on a child story of an epic -> the story's epic (via story_epic_map)
      * time on a child bug of a story   -> its story's epic (bug_parent_map walks
        one more link level: bug_id -> parent story/epic id, then re-resolved)
    Returns {epic_id -> minutes} plus 'unattributed' minutes we could not place
    (kept visible, never silently dropped). No network."""
    epic_set = set(epic_ids)
    bug_parent_map = bug_parent_map or {}
    spend = {}
    unattributed = 0
    for it in items:
        iid = it.get("issue") or ""
        mins = it.get("minutes") or 0
        if not iid or not mins:
            continue
        target = None
        if iid in epic_set:
            target = iid                       # logged on the epic itself
        elif iid in story_epic_map:
            target = story_epic_map[iid]       # logged on a child story
        else:
            # one more link level: a bug whose parent is a story (or the epic)
            parent = bug_parent_map.get(iid)
            if parent in epic_set:
                target = parent
            elif parent in story_epic_map:
                target = story_epic_map[parent]
        if target is not None:
            spend[target] = spend.get(target, 0) + mins
        else:
            unattributed += mins
    return spend, unattributed

def _md(minutes):
    """Minutes -> man-days rounded to one decimal (for report totals)."""
    return round((minutes or 0) / float(MAN_DAY), 1)

def _child_parent_map(ctx, parent_ids, chunk=80):
    """{child_id -> parent_id} for the OUTWARD Subtask children (bugs/sub-tasks) of
    `parent_ids` (the epics + their stories), via a CHUNKED `issue ID:` bulk query so
    one paged fetch resolves every bug's parent instead of one GET per bug. Chunked to
    stay under the request-URI length limit. This is the Rev #2 'one more link level':
    a bug's time is placed on its story's epic without dropping it or an N+1 sweep."""
    out = {}
    ids = [i for i in parent_ids if i]
    for start in range(0, len(ids), chunk):
        batch = ids[start:start + chunk]
        q = "issue ID: " + ", ".join(batch)
        issues = get_issues(ctx, q, fields="idReadable,links(direction,linkType(name),issues(idReadable))",
                            top=300)
        for it in issues:
            pid = it.get("idReadable")
            for lk in (it.get("links") or []):
                if (lk.get("linkType") or {}).get("name") == "Subtask" and lk.get("direction") == "OUTWARD":
                    for c in (lk.get("issues") or []):
                        cid = c.get("idReadable")
                        if cid and cid not in out:
                            out[cid] = pid
    return out

def effort_report(ctx, project="PXB1", scope="PHASE 1",
                  cutoff_iso=EFFORT_CUTOFF_DEFAULT, exclude_ids=("PXB1-3295",)):
    """Port of Suhail's PXB1 Phase-1 Effort Report onto the engine (stdlib only).

    Discovers every open in-scope epic PLUS epics resolved after `cutoff_iso`,
    categorizes them (DONE/PENDING/MIXED/NO_STORIES) from their Subtask/OUTWARD
    stories, rolls up Server+UI+Testing estimation over the pending in-scope stories
    (with an epic-level fallback), computes the P2 backlog from Scope-change activity
    history, and attributes TRUE logged time (a single phase-wide work-item sweep,
    joined story->epic) with an overshoot flag.

    Returns structured data — sections + per-section totals + a grand total — so any
    shell (CLI/MCP/web) can render it:
      {
        "project", "scope", "cutoff_iso", "cutoff_ms", "man_day", "excluded_ids",
        "counts": {done, pending, mixed, no_stories, p2_backlog},
        "sections": {
           "done":       [epic, ...],   # resolved after cutoff
           "pending":    [epic, ...],
           "mixed":      [epic, ...],
           "no_stories": [epic, ...],
           "p2_backlog": [{id, summary, assignee, created, changed_at}, ...],
        },
        "totals": {                      # man-days per field + total, per section
           "pending"/"mixed"/"no_stories"/"done"/"grand_total": {
              server, ui, testing, total, spent, overshoot?  # minutes
           }, ... plus *_md man-day mirrors on grand_total
        },
        "spend": {"scope_query", "total_minutes", "unattributed_minutes", "excluded"},
      }
    Each epic record carries: id, summary, assignee, created, resolved, category,
    rollup {server,ui,testing} (minutes), total (minutes), spent (minutes),
    overshoot (bool), missing_est (bool), stories [...]. Grand Total counts PENDING +
    MIXED + NO_STORIES only (Done and P2 are separate, excluded from the grand total)."""
    exclude = set(exclude_ids or ())
    cutoff_ms = iso_to_ms(cutoff_iso)
    br = "{%s}" % scope if " " in scope else scope   # Scope: {PHASE 1}

    # --- discover epics: open in-scope + resolved-after-cutoff (recipe Q1 + Q2) ---
    cutoff_date = (datetime.datetime.utcfromtimestamp(cutoff_ms / 1000).strftime("%Y-%m-%d")
                   if cutoff_ms else "")
    q_open = "project: %s TaskType: EPIC Scope: %s #Unresolved" % (project, br)
    q_done = "project: %s TaskType: EPIC Scope: %s resolved date: %s .. today" % (project, br, cutoff_date)
    open_epics = get_issues(ctx, q_open, fields="idReadable", top=300)
    done_epics = get_issues(ctx, q_done, fields="idReadable,resolved", top=300)
    seen, epic_ids = set(), []
    for e in list(open_epics) + list(done_epics):
        iid = e.get("idReadable")
        if iid and iid not in seen and iid not in exclude:
            seen.add(iid)
            epic_ids.append(iid)

    # --- fetch full epic data (recipe Step 3 field set) ---
    epic_sf = ("idReadable,summary,created,resolved,assignee(name),"
               "customFields(name,value(name,minutes,presentation)),"
               "links(direction,linkType(name),issues(idReadable,summary,created,"
               "assignee(name),customFields(name,value(name,minutes))))")
    cats = []
    for iid in epic_ids:
        raw = GET(ctx, "/api/issues/%s?fields=%s" % (iid, urllib.parse.quote(epic_sf)))
        cats.append(categorize_epic(raw))

    # --- true spend: ONE phase-wide work-item sweep, joined story->epic (Rev #2) ---
    # The issue-level 'Spent time' rollup is NOT backed by work items on the epic
    # (verified live: an epic can show Spent time yet have zero direct work items —
    # the workflow propagates a child bug's time up), so we sweep work items and
    # attribute them ourselves. Bugs live one link level below the stories, so their
    # time would be dropped unless we resolve bug->story: one CHUNKED bulk link fetch
    # over the epics+stories builds that {bug -> parent} map (no N+1).
    story_epic_map = _build_story_epic_map(cats)
    sweep = time_spent(ctx, project=project, group_by="issue", with_items=True, top=1000)
    items = sweep.get("items", [])
    bug_parent_map = _child_parent_map(ctx, epic_ids + list(story_epic_map.keys()))
    spend_by_epic, unattributed = _attribute_spend(items, story_epic_map, epic_ids, bug_parent_map)

    # --- assemble per-epic totals + overshoot ---
    for rec in cats:
        r = rec["rollup"]
        rec["total"] = r["server"] + r["ui"] + r["testing"]
        rec["spent"] = spend_by_epic.get(rec["id"], 0)
        rec["overshoot"] = rec["total"] > 0 and rec["spent"] > rec["total"]

    done = [r for r in cats if r["category"] == "DONE"]
    pending = [r for r in cats if r["category"] == "PENDING"]
    mixed = [r for r in cats if r["category"] == "MIXED"]
    no_stories = [r for r in cats if r["category"] == "NO_STORIES"]

    # --- P2 backlog: Scope PHASE 1->PHASE 2 after cutoff, via activity history ---
    # Candidates are the current open PHASE 2 epics; the PHASE 1->PHASE 2 direction and
    # the after-cutoff timing are enforced by _scope_changed_p1_to_p2 on each activity.
    p2_candidates = get_issues(ctx, "project: %s TaskType: EPIC Scope: {PHASE 2} #Unresolved" % project,
                               fields="idReadable", top=300)
    p2_backlog = []
    for e in p2_candidates:
        pid = e.get("idReadable")
        if not pid or pid in exclude:
            continue
        act = GET(ctx, "/api/issues/%s/activities?categories=CustomFieldCategory"
                       "&fields=timestamp,added(name),removed(name),field(name)" % pid)
        matched, changed_at = _scope_changed_p1_to_p2(act if isinstance(act, list) else [], cutoff_ms)
        if matched:
            meta = GET(ctx, "/api/issues/%s?fields=idReadable,summary,created,customFields(name,value(name))" % pid)
            p2_backlog.append({"id": pid, "summary": meta.get("summary") or "",
                               "assignee": _cf_str(meta, "Assignee"),
                               "created": meta.get("created"), "changed_at": changed_at})

    def _sum_section(recs):
        s = {"server": 0, "ui": 0, "testing": 0, "total": 0, "spent": 0}
        for r in recs:
            s["server"] += r["rollup"]["server"]
            s["ui"] += r["rollup"]["ui"]
            s["testing"] += r["rollup"]["testing"]
            s["total"] += r["total"]
            s["spent"] += r["spent"]
        return s

    t_pending = _sum_section(pending)
    t_mixed = _sum_section(mixed)
    t_ns = _sum_section(no_stories)
    t_done = _sum_section(done)
    grand = {k: t_pending[k] + t_mixed[k] + t_ns[k] for k in t_pending}   # open work only
    grand.update({"server_md": _md(grand["server"]), "ui_md": _md(grand["ui"]),
                  "testing_md": _md(grand["testing"]), "total_md": _md(grand["total"]),
                  "spent_md": _md(grand["spent"])})

    return {
        "project": project, "scope": scope, "cutoff_iso": cutoff_iso, "cutoff_ms": cutoff_ms,
        "man_day": MAN_DAY, "excluded_ids": sorted(exclude),
        "counts": {"done": len(done), "pending": len(pending), "mixed": len(mixed),
                   "no_stories": len(no_stories), "p2_backlog": len(p2_backlog),
                   "epics_discovered": len(epic_ids)},
        "sections": {"done": done, "pending": pending, "mixed": mixed,
                     "no_stories": no_stories, "p2_backlog": p2_backlog},
        "totals": {"pending": t_pending, "mixed": t_mixed, "no_stories": t_ns,
                   "done": t_done, "grand_total": grand},
        "spend": {"scope_query": sweep.get("scope"), "total_minutes": sweep.get("total_minutes", 0),
                  "unattributed_minutes": unattributed, "excluded": sweep.get("excluded")},
    }

def _effort_blocks(rep):
    """Render an effort_report result into report()-style blocks (headings + tables)
    so the CLI/MCP shells format it exactly like every other report."""
    md = lambda m: _md(m)
    c = rep["counts"]; g = rep["totals"]["grand_total"]
    blocks = [{"kind": "raw", "s": "# %s Effort Report — Scope %s (as of %s)\n"
               % (rep["project"], rep["scope"], rep["cutoff_iso"])},
              {"kind": "raw", "s": ("_%d epics discovered · Done %d · Pending %d · Mixed %d · "
                                    "No-stories %d · P2-backlog %d. Man-day = %d min. "
                                    "Grand Total = Pending+Mixed+No-stories only._\n"
                                    % (c["epics_discovered"], c["done"], c["pending"], c["mixed"],
                                       c["no_stories"], c["p2_backlog"], rep["man_day"]))}]

    def epic_rows(recs, with_flags=False, with_spent=True):
        rows = []
        for r in recs:
            row = [r["id"], (r["summary"] or "")[:44], r["assignee"] or "—",
                   md(r["rollup"]["server"]), md(r["rollup"]["ui"]), md(r["rollup"]["testing"]),
                   md(r["total"])]
            if with_spent:
                row.append(("%s ⚠" % md(r["spent"])) if r["overshoot"] else md(r["spent"]))
            if with_flags:
                row.append("MISSING" if r["missing_est"] else "")
            rows.append(row)
        return rows

    # Section 0 — Done (resolved after cutoff)
    if rep["sections"]["done"]:
        t = rep["totals"]["done"]
        blocks.append({"kind": "raw", "s": "\n## Done — resolved after cutoff (%d)" % c["done"]})
        rows = epic_rows(rep["sections"]["done"])
        rows.append(["**Total**", "", "", md(t["server"]), md(t["ui"]), md(t["testing"]),
                     md(t["total"]), md(t["spent"])])
        blocks.append({"kind": "table",
                       "headers": ["Epic", "Summary", "Assignee", "Dev", "UI", "QA", "Total", "Spent"],
                       "rows": rows})
    # Section 1 — Pending
    t = rep["totals"]["pending"]
    blocks.append({"kind": "raw", "s": "\n## Pending — no story done yet (%d)" % c["pending"]})
    rows = epic_rows(rep["sections"]["pending"], with_flags=True)
    rows.append(["**Total**", "", "", md(t["server"]), md(t["ui"]), md(t["testing"]),
                 md(t["total"]), md(t["spent"]), ""])
    blocks.append({"kind": "table",
                   "headers": ["Epic", "Summary", "Assignee", "Dev", "UI", "QA", "Total", "Spent", "Missing Est."],
                   "rows": rows})
    # Section 2 — Mixed
    t = rep["totals"]["mixed"]
    blocks.append({"kind": "raw", "s": "\n## Mixed — some done, some pending (%d)" % c["mixed"]})
    rows = epic_rows(rep["sections"]["mixed"])
    rows.append(["**Total**", "", "", md(t["server"]), md(t["ui"]), md(t["testing"]),
                 md(t["total"]), md(t["spent"])])
    blocks.append({"kind": "table",
                   "headers": ["Epic", "Summary", "Assignee", "Dev", "UI", "QA", "Total", "Spent"],
                   "rows": rows})
    # Section 3 — No stories
    blocks.append({"kind": "raw", "s": "\n## No stories — epics without linked sub-tasks (%d)" % c["no_stories"]})
    blocks.append({"kind": "table", "headers": ["Epic", "Summary", "Assignee", "Created"],
                   "rows": [[r["id"], (r["summary"] or "")[:50], r["assignee"] or "—",
                             days_since(r["created"])] for r in rep["sections"]["no_stories"]]})
    # Section 4 — P2 backlog (Epic, Summary, Assignee, Created only — per v14)
    blocks.append({"kind": "raw", "s": "\n## P2 Backlog — Scope moved PHASE 1→PHASE 2 after cutoff (%d)" % c["p2_backlog"]})
    blocks.append({"kind": "table", "headers": ["Epic", "Summary", "Assignee", "Created"],
                   "rows": [[r["id"], (r["summary"] or "")[:50], r["assignee"] or "—",
                             days_since(r["created"])] for r in rep["sections"]["p2_backlog"]]})
    # Grand total
    blocks.append({"kind": "raw", "s": ("\n**Grand Total (open work — Pending+Mixed+No-stories): "
                                        "Dev %s · UI %s · QA %s · Total %s man-days · Spent %s man-days.**"
                                        % (g["server_md"], g["ui_md"], g["testing_md"],
                                           g["total_md"], g["spent_md"]))})
    ex = rep["spend"].get("excluded")
    if ex:
        blocks.append({"kind": "raw", "s": ("_Spend is TRUE logged time from a work-item sweep "
                       "(propagated 'Propagated from Bug' copies excluded: %s). ⚠ = spend > estimate._"
                       % ex.get("total"))})
    return blocks

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
    if rtype == "timespent":
        # TRUE logged time by person — from work items, attributed to who LOGGED
        # each entry (not the issue's current assignee). Fixes reassignment and
        # epic-level misattribution that an Assignee + Spent-time rollup gets wrong.
        data = time_spent(ctx, project=project, location=location, sprint=sprint, group_by="author")
        label = (f"sprint {sprint}" if sprint else None) or (proj or location or "(whole instance)")
        rows = [[g["key"], g["entries"], g["issues"], g["presentation"], g["bar"]] for g in data["groups"]]
        rows.append(["**Total**", data["count"], "", f"**{data['total']}**", ""])
        note = ("_True logged time across %d work-item entries, attributed to who LOGGED each one "
                "(not the current assignee)._\n" % data["count"])
        ex = data.get("excluded")
        if ex:
            note += ("_Excluded %s of workflow-propagated 'Propagated from Bug' time (%d entries that copy a "
                     "bug's time onto its parent) so only DIRECT logged time counts._\n" % (ex["total"], ex["entries"]))
        return [{"kind": "raw", "s": f"# Time spent by person — {label}\n"},
                {"kind": "raw", "s": note},
                {"kind": "table", "headers": ["Person", "Entries", "Issues", "Time", "▕"], "rows": rows}]
    if rtype == "effort":
        # Suhail's PXB1 Phase-1 Effort Report, ported (project/scope/cutoff parameterized).
        rep = effort_report(ctx, project=proj or "PXB1", scope=(sprint or "PHASE 1"))
        return _effort_blocks(rep)
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

# ---------- true logged time (per-author, from work items — NOT the assignee proxy) ----------
# The issue-level "Spent time" field is a per-issue rollup keyed to nothing but the
# issue; grouping it by the current Assignee misattributes work after a reassignment
# and lumps epic-level logging onto the epic's owner. The /api/workItems endpoint
# returns each time entry with its OWN author, date and issue, so summing it gives
# the real "who logged how much" — which is what people mean by time-by-person.
WORKITEM_FIELDS = ("id,date,duration(minutes,presentation),author(login,fullName),"
                   "creator(login,fullName),type(name),text,issue(idReadable,project(shortName))")

def work_items(ctx, query="", author="", start="", end="", limit=20000, top=300):
    """Page through /api/workItems (time-tracking entries) across issues.
    `query` is an issue search query (e.g. 'project: PXB1 Sprints: {beta1-19}');
    `author` filters by who logged it (login/ringId/'me'); `start`/`end` are
    YYYY-MM-DD bounds on the entry date. Returns raw work-item dicts."""
    base = [f"fields={urllib.parse.quote(WORKITEM_FIELDS)}", f"$top={top}"]
    if query:  base.append("query=" + urllib.parse.quote(query))
    if author: base.append("author=" + urllib.parse.quote(author))
    if start:  base.append("startDate=" + urllib.parse.quote(start))
    if end:    base.append("endDate=" + urllib.parse.quote(end))
    out, skip = [], 0
    while True:
        page = GET(ctx, "/api/workItems?" + "&".join(base + [f"$skip={skip}"]))
        out.extend(page)
        if len(page) < top or (limit and len(out) >= limit):
            break
        skip += len(page)
    return out[:limit] if limit else out

def _wi_norm(w):
    """Flatten one raw work item to the fields we report on."""
    dur = w.get("duration") or {}
    iss = w.get("issue") or {}
    au = w.get("author") or {}
    return {"issue": iss.get("idReadable", ""),
            "project": (iss.get("project") or {}).get("shortName", ""),
            "login": au.get("login", ""),
            "author": au.get("fullName") or au.get("login") or "(unknown)",
            "minutes": int(dur.get("minutes") or 0),
            "type": (w.get("type") or {}).get("name", "") or "(none)",
            "date": w.get("date"),
            "text": w.get("text") or ""}

_WI_KEY = {"author": lambda it: it["author"] or "(unknown)",
           "type":    lambda it: it["type"] or "(none)",
           "project": lambda it: it["project"] or "(none)",
           "issue":   lambda it: it["issue"] or "(none)"}

def aggregate_work(items, group_by="author"):
    """Pure: roll normalized work items up by author/type/project/issue. Returns
    {group_by, count, total_minutes, total, groups:[{key,minutes,presentation,
    entries,issues,bar}]} sorted by time desc. No network."""
    keyfn = _WI_KEY.get(group_by, _WI_KEY["author"])
    agg = {}  # key -> [minutes, entries, {issues}]
    for it in items:
        e = agg.setdefault(keyfn(it), [0, 0, set()])
        e[0] += it["minutes"]; e[1] += 1; e[2].add(it["issue"])
    ordered = sorted(agg.items(), key=lambda kv: kv[1][0], reverse=True)
    maxmin = ordered[0][1][0] if ordered else 0
    groups = [{"key": k, "minutes": v[0], "presentation": fmt_minutes(v[0]),
               "entries": v[1], "issues": len(v[2]), "bar": bar(v[0], maxmin)}
              for k, v in ordered]
    total = sum(it["minutes"] for it in items)
    return {"group_by": group_by, "count": len(items), "total_minutes": total,
            "total": fmt_minutes(total), "groups": groups}

def _wi_query(query="", project="", location="", sprint=""):
    q = scope_clause(project, location)
    if sprint:
        q += "Sprints: {%s} " % sprint    # sprint names often contain spaces/dashes
    if query:
        q += query
    return q.strip()

# Some teams run a workflow that copies a bug's spent time onto its parent Story
# and Epic when the bug is fixed. Each copy is a real work item whose TEXT reads
# "Propagated from Bug PXB1-…" (its type is usually empty), so the same hours get
# counted 2-3x and inflate a person's true logged time. Exclude those by default:
# the person's direct entry on the bug itself is a separate work item and stays.
PROPAGATED_HINT = "propagat"   # marker lives in the work-item TEXT, not the type

def _is_propagated(it):
    """True if a work item is a workflow-propagated copy (its text/type carries the
    'Propagated from Bug' marker)."""
    return PROPAGATED_HINT in ((it.get("text") or "") + " " + (it.get("type") or "")).lower()

def _split_by_type(items, exclude_propagated=True, exclude_types=None):
    """Pure: partition normalized work items into (kept, dropped). Drops propagated
    copies (when exclude_propagated) plus any entry whose type exactly matches one of
    exclude_types (case-insensitive). No network."""
    names = {t.strip().lower() for t in (exclude_types or []) if t and t.strip()}
    kept, dropped = [], []
    for it in items:
        drop = (exclude_propagated and _is_propagated(it)) or ((it.get("type") or "").strip().lower() in names)
        (dropped if drop else kept).append(it)
    return kept, dropped

def time_spent(ctx, query="", project="", location="", sprint="", author="",
               start="", end="", group_by="author", limit=20000,
               exclude_propagated=True, exclude_types=None, with_items=False, top=300):
    """True logged-time breakdown. Resolves scope (project/location/sprint + free
    query) into an issue query, pulls the matching work items, and aggregates by
    `group_by` (author|type|project|issue). `start`/`end` (YYYY-MM-DD) optionally
    restrict to entries logged in a window. By default DROPS workflow-propagated
    entries (type contains 'propagat', e.g. 'Propagated from Bug') so only DIRECT
    logged time counts — pass exclude_propagated=False to include them, or
    exclude_types=[...] to drop additional named types. Set with_items=True to also
    return the kept entries. `top` is the work-item page size (raise it for a big
    phase-wide sweep so paging stays fast)."""
    scoped = _wi_query(query, project, location, sprint)
    raw = [_wi_norm(w) for w in work_items(ctx, query=scoped, author=author,
                                           start=start, end=end, limit=limit, top=top)]
    items, dropped = _split_by_type(raw, exclude_propagated, exclude_types)
    out = aggregate_work(items, group_by)
    out["scope"] = scoped
    if dropped:
        dmin = sum(it["minutes"] for it in dropped)
        out["excluded"] = {"entries": len(dropped), "minutes": dmin, "total": fmt_minutes(dmin)}
    if start or end:
        out["window"] = {"start": start or None, "end": end or None}
    if with_items:
        out["items"] = items
    return out

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
