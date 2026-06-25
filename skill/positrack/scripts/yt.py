#!/usr/bin/env python3
"""
yt.py - YouTrack assistant client (stdlib only; nothing hardcoded per project).

Transport + helpers for the youtrack-assistant skill. The assistant translates
plain English into YouTrack queries / field values and calls these subcommands.
Projects, fields, states and enum values are ALL discovered live from the
instance — there is no baked-in project list. Read commands are safe; writes
(create/update/comment/attach) preview by default and require --commit to apply.

Auth: the caller's OWN permanent token, from $YT_TOKEN, the file in $YT_ENV, or
/tmp/yt.env (KEY=VALUE). Base URL: profile -> $YT_BASE -> https://support.posibolt.com
Per-user context lives in ~/.config/youtrack-assistant/profile.json (or $YT_PROFILE).

`python3 yt.py --help` or `python3 yt.py <command> --help`.
"""
import argparse, json, os, re, sys, time, urllib.request, urllib.parse, urllib.error, mimetypes, uuid

PROFILE_PATH = os.environ.get("YT_PROFILE",
                              os.path.expanduser("~/.config/youtrack-assistant/profile.json"))

def load_profile():
    try:
        return json.load(open(PROFILE_PATH))
    except Exception:
        return {}

PROFILE = load_profile()
BASE = (PROFILE.get("base") or os.environ.get("YT_BASE") or "https://support.posibolt.com").rstrip("/")

# ---------- auth + transport ----------
def get_token():
    t = os.environ.get("YT_TOKEN")
    if t:
        return t.strip()
    path = os.environ.get("YT_ENV", "/tmp/yt.env")
    if os.path.exists(path):
        for line in open(path):
            line = line.strip()
            if line.startswith("YT_TOKEN"):
                return line.split("=", 1)[1].strip()
            if line and "=" not in line and line.startswith("perm-"):
                return line
    sys.exit("ERROR: no token. Set $YT_TOKEN or put 'YT_TOKEN=perm-...' in /tmp/yt.env "
             "(chmod 600). Generate one in YouTrack: profile menu -> Account Security -> "
             "New permanent token (scope: YouTrack).")

def _req(method, path, body=None, raw=None, content_type=None, soft=False):
    headers = {"Authorization": "Bearer " + get_token(), "Accept": "application/json"}
    data = None
    if raw is not None:
        data = raw
        if content_type:
            headers["Content-Type"] = content_type
    elif body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            txt = r.read().decode()
            return json.loads(txt) if txt else {}
    except urllib.error.HTTPError as e:
        if soft:                      # caller wants to try a fallback instead of failing
            return None
        body = e.read().decode()[:400]
        friendly = {
            401: "your token is invalid or expired — regenerate a YouTrack permanent token (Account Security).",
            403: "your token doesn't have permission for this (it acts with YOUR YouTrack rights). "
                 "An admin token, or the item's owner, may be required — this is expected, not a bug.",
            404: "not found — double-check the issue/project/article ID.",
            429: "rate-limited by YouTrack — wait a moment and retry.",
        }.get(e.code)
        sys.exit(f"YouTrack {e.code}: {friendly or body}")
    except urllib.error.URLError as e:
        sys.exit(f"Network error reaching {BASE}: {e.reason}. Check the base URL / connectivity.")

def GET(path):  return _req("GET", path)
def POST(path, body): return _req("POST", path, body=body)

# ---------- dynamic discovery (cached for the session) ----------
_PCACHE = "/tmp/yt_projects.json"
def projects():
    try:
        if time.time() - os.path.getmtime(_PCACHE) < 1800:
            return json.load(open(_PCACHE))
    except Exception:
        pass
    ps = _req("GET", "/api/admin/projects?fields=id,shortName,name,archived,leader(login)&$top=300", soft=True)
    if ps is None:
        # non-admin fallback: agile boards expose projects (id+shortName) without admin rights
        ags = GET("/api/agiles?fields=projects(id,shortName,name)&$top=200")
        seen = {}
        for ag in ags:
            for p in (ag.get("projects") or []):
                if p.get("shortName"):
                    seen[p["shortName"]] = p
        ps = list(seen.values())
    json.dump(ps, open(_PCACHE, "w"))
    return ps

def project_id(short):
    short = short.upper()
    for p in projects():
        if (p.get("shortName") or "").upper() == short:
            return p["id"]
    sys.exit(f"ERROR: project '{short}' not found. Run `yt.py projects` to list.")

_TYPE_FROM_CFTYPE = {  # reverse-map issue customField $type -> fieldType id (for non-admin fallback)
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

def field_schema(short):
    """{field_name: fieldType_id} for a project, discovered live.
    Admin path is precise; non-admin tokens fall back to inferring types from a sample issue."""
    pid = project_id(short)
    fs = _req("GET", f"/api/admin/projects/{pid}/customFields?fields=field(name,fieldType(id))&$top=200", soft=True)
    if fs is not None:
        return {f["field"]["name"]: f["field"]["fieldType"]["id"] for f in fs if f.get("field")}
    # fallback: read one issue's customFields and infer each field's type from its $type
    sample = get_issues(f"project: {short}", fields="customFields(name,$type)", limit=1)
    out = {}
    if sample:
        for c in sample[0].get("customFields", []):
            out[c["name"]] = _TYPE_FROM_CFTYPE.get(c.get("$type"), "string")
    return out

def field_values(short, field):
    """Allowed enum/state values for a field in a project (for validation/preview)."""
    pid = project_id(short)
    fs = GET(f"/api/admin/projects/{pid}/customFields"
             f"?fields=field(name),bundle(values(name,archived))&$top=200")
    for f in fs:
        if (f.get("field") or {}).get("name") == field:
            return [v["name"] for v in ((f.get("bundle") or {}).get("values") or []) if not v.get("archived")]
    return []

# ---------- issue I/O ----------
ISSUE_FIELDS = ("idReadable,summary,created,resolved,updated,"
                "reporter(login,fullName),project(shortName),"
                "customFields(name,value(name,login,fullName,minutes,presentation,text))")

def get_issues(query, fields=ISSUE_FIELDS, top=200, limit=None):
    out, skip = [], 0
    while True:
        page = GET(f"/api/issues?query={urllib.parse.quote(query)}"
                   f"&fields={urllib.parse.quote(fields)}&$top={top}&$skip={skip}")
        out.extend(page)
        if len(page) < top or (limit and len(out) >= limit):
            break
        skip += len(page)
    return out[:limit] if limit else out

def count(query):
    for _ in range(40):
        c = POST("/api/issuesGetter/count?fields=count", {"query": query}).get("count", -1)
        if c != -1:
            return c
        time.sleep(0.3)
    return -1

def cf_map(it): return {c["name"]: c.get("value") for c in it.get("customFields", [])}
def vname(v):
    if v is None: return ""
    if isinstance(v, list): return ", ".join(vname(x) for x in v)
    if isinstance(v, dict):
        return v.get("name") or v.get("fullName") or v.get("login") or v.get("presentation") or v.get("text") or ""
    return str(v)

DAY = 86400000
def days_since(ms): return round((time.time()*1000 - ms)/DAY, 1) if ms else None

# ---------- period parse + typed write payloads ----------
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
    Sprint transitions, prefer the Commands API (`yt.py cmd`) — it respects the
    project's state-machine workflow, which a raw field set can violate."""
    base = ftype.split("[")[0]; multi = ftype.endswith("[*]")
    parts = [x.strip() for x in str(value).split(",")] if multi else value
    # named-value families (single/multi share a value shape)
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

# ---------- output helpers ----------
def md_table(rows, headers):
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join(["---"]*len(headers)) + "|"]
    for r in rows:
        out.append("| " + " | ".join(str(c).replace("\n"," ").replace("|","\\|")[:80] for c in r) + " |")
    return "\n".join(out)

def issue_rows(issues, cols):
    rows = []
    for it in issues:
        d = cf_map(it); row = []
        for c in cols:
            if c == "id": row.append(it.get("idReadable",""))
            elif c == "summary": row.append((it.get("summary") or "")[:70])
            elif c == "project": row.append((it.get("project") or {}).get("shortName") or (it.get("idReadable","").split("-")[0]))
            elif c == "age": row.append(days_since(it.get("created")))
            else: row.append(vname(d.get(c)))
        rows.append(row)
    return rows

def ctx_scope(args):
    """Build a leading scope clause from --project/--location, falling back to profile."""
    proj = getattr(args, "project", "") or ""
    loc = getattr(args, "location", "") or ""
    clause = ""
    if proj:
        clause += f"project: {proj} "
    if loc:
        clause += (f"Location: {{{loc}}} " if " " in loc else f"Location: {loc} ")
    return clause

# ---------- commands: identity & context ----------
def cmd_whoami(a):
    print(json.dumps(GET("/api/users/me?fields=login,fullName,email"), indent=2))

def cmd_profile(a):
    print(json.dumps(PROFILE, indent=2) if PROFILE else "(no profile set — run `yt.py setup ...`)")

def cmd_setup(a):
    me = GET("/api/users/me?fields=login,fullName,email")
    prof = dict(PROFILE)
    prof["login"] = me.get("login"); prof["fullName"] = me.get("fullName")
    if a.location: prof["location"] = a.location
    if a.projects: prof["projects"] = [p.strip() for p in a.projects.split(",") if p.strip()]
    if a.role: prof["role"] = a.role
    if a.base: prof["base"] = a.base.rstrip("/")
    os.makedirs(os.path.dirname(PROFILE_PATH), exist_ok=True)
    json.dump(prof, open(PROFILE_PATH, "w"), indent=2)
    print(f"Saved profile to {PROFILE_PATH}:\n" + json.dumps(prof, indent=2))

def cmd_projects(a):
    rows = [[p["shortName"], p["id"], "yes" if p.get("archived") else "", p["name"]]
            for p in sorted(projects(), key=lambda x: x.get("shortName") or "")]
    print(md_table(rows, ["Short", "ID", "Archived", "Name"]))

def cmd_describe(a):
    if not a.project:
        return cmd_projects(a)
    fs = field_schema(a.project)
    print(f"# {a.project} fields\n")
    print(md_table([[n, t] for n, t in sorted(fs.items())], ["Field", "Type"]))
    # show values for the key enum/state fields
    for key in ("State", "Type", "TaskType", "Priority", "Location", "Category", "Team"):
        if key in fs:
            vals = field_values(a.project, key)
            if vals: print(f"\n**{key}** values: {', '.join(vals)}")

# ---------- commands: read ----------
def cmd_count(a): print(count(a.query))

def cmd_search(a):
    cols = a.columns.split(",") if a.columns else ["id", "project", "summary", "State", "Assignee"]
    q = (ctx_scope(a) + a.query).strip()
    issues = get_issues(q, limit=a.limit)
    if a.json:
        print(json.dumps(issues, indent=1)); return
    print(f"# {len(issues)} issue(s) — {q}\n")
    print(md_table(issue_rows(issues, cols), cols))

def cmd_get(a):
    iid = a.issue
    base = GET(f"/api/issues/{iid}?fields={urllib.parse.quote(ISSUE_FIELDS)}")
    links = GET(f"/api/issues/{iid}/links?fields=direction,linkType(name,sourceToTarget,targetToSource),"
                f"issues(idReadable,summary,resolved)")
    comments = GET(f"/api/issues/{iid}/comments?fields=text,created,author(login)&$top=8")
    d = cf_map(base)
    est = (d.get("Estimate") or {}).get("minutes") if isinstance(d.get("Estimate"), dict) else None
    spent = (d.get("Spent time") or {}).get("minutes") if isinstance(d.get("Spent time"), dict) else None
    print(f"# {base.get('idReadable')} — {base.get('summary')}\n")
    print(f"- project: {(base.get('project') or {}).get('shortName','')}   reporter: {vname(base.get('reporter'))}")
    print(f"- created: {days_since(base.get('created'))}d ago   "
          f"last update: {days_since(base.get('updated'))}d ago   "
          f"resolved: {'yes' if base.get('resolved') else 'no'}")
    if est or spent:
        print(f"- estimate: {est or '—'} min   spent: {spent or '—'} min")
    for k, v in d.items():
        if vname(v): print(f"- {k}: {vname(v)}")
    if links:
        print("\n## Links")
        for l in links:
            rel = (l.get("linkType") or {}).get("name", "")
            for li in (l.get("issues") or []):
                st = "resolved" if li.get("resolved") else "open"
                print(f"- {rel} [{l.get('direction')}]: {li.get('idReadable')} ({st}) {li.get('summary','')[:50]}")
    if comments:
        print("\n## Recent comments")
        for c in comments[-5:]:
            print(f"- {(c.get('author') or {}).get('login','?')}: {(c.get('text') or '')[:160]}")

def cmd_report(a):
    scope = ctx_scope(a)
    proj = a.project or (PROFILE.get("projects") or [None])[0]
    days = a.days
    if a.type == "health":
        targets = [proj] if proj else [p["shortName"] for p in projects() if not p.get("archived")]
        rows = []
        for s in targets:
            rows.append([s, count(f"project: {s}"), count(f"project: {s} #Unresolved"),
                         count(f"project: {s} #Unresolved has: -{{Estimate}}"),
                         count(f"project: {s} #Unresolved #Unassigned"),
                         count(f"project: {s} #Unresolved updated: * .. {{minus 30d}}")])
        print("# Board health\n")
        print(md_table(rows, ["Proj", "Total", "Open", "Open-unest", "Open-unassg", "Stale>30d"]))
    elif a.type == "activity":
        s = scope.strip()
        label = s or "(whole instance)"
        created = count(f"{s} created: {{minus {days}d}} .. Today".strip())
        resolved = count(f"{s} resolved date: {{minus {days}d}} .. Today".strip())
        updated = count(f"{s} updated: {{minus {days}d}} .. Today".strip())
        print(f"# Activity (last {days}d) — {label}\n")
        print(md_table([[created, resolved, updated]], ["Created", "Resolved", "Updated"]))
        print("\n## Resolved in window")
        cmd_search(argparse.Namespace(query=f"resolved date: {{minus {days}d}} .. Today sort by: updated desc",
                   project=a.project, location=a.location, columns="id,project,summary,Assignee", limit=25, json=False))
        print("\n## Newly created in window")
        cmd_search(argparse.Namespace(query=f"created: {{minus {days}d}} .. Today sort by: created desc",
                   project=a.project, location=a.location, columns="id,project,summary,State,Assignee", limit=25, json=False))
    elif a.type == "briefing":
        if not proj: sys.exit("briefing needs --project (or a default project in your profile)")
        print(f"# Weekly briefing — {proj} (last {days}d)\n")
        print(md_table([[
            count(f"project: {proj} resolved date: {{minus {days}d}} .. Today"),
            count(f"project: {proj} created: {{minus {days}d}} .. Today"),
            count(f"project: {proj} #Unresolved"),
        ]], ["Resolved", "Created", "Still open"]))
        print("\n## Process outliers")
        fs = field_schema(proj); states = field_values(proj, "State")
        brace = lambda v: "{%s}" % v if " " in v else v
        outliers = [("Open & unassigned", f"project: {proj} #Unresolved #Unassigned"),
                    ("Stale > 30d (open)", f"project: {proj} #Unresolved updated: * .. {{minus 30d}}")]
        if "Estimate" in fs:
            outliers.insert(0, ("Open & unestimated", f"project: {proj} #Unresolved has: -{{Estimate}}"))
        blocked = [s for s in states if re.search(r"block|hold", s, re.I)]
        reopen  = [s for s in states if re.search(r"re.?open", s, re.I)]
        if blocked:
            outliers.append(("Blocked / On-hold", f"project: {proj} State: " + ", ".join(brace(b) for b in blocked)))
        if reopen:
            outliers.append(("Reopened", f"project: {proj} State: " + ", ".join(brace(r) for r in reopen)))
        print(md_table([[name, count(q)] for name, q in outliers], ["Outlier", "Count"]))
        print("\n## Oldest open items")
        cmd_search(argparse.Namespace(query="#Unresolved sort by: created asc", project=proj, location="",
                   columns="id,summary,State,Assignee,age", limit=12, json=False))
    else:
        # stale / unestimated / unassigned / epics / mywork / sprint
        qmap = {
            "stale":       f"#Unresolved updated: * .. {{minus {days}d}} sort by: updated asc",
            "unestimated": "#Unresolved has: -{Estimate} sort by: created asc",
            "unassigned":  "#Unresolved #Unassigned sort by: created asc",
            "epics":       "Type: Epic, TaskType: EPIC sort by: State",
            "mywork":      "#Unresolved for: me sort by: updated desc",
            "sprint":      f"Sprints: {{{a.sprint}}} sort by: State" if a.sprint else None,
        }
        q = qmap.get(a.type)
        if q is None: sys.exit("sprint report needs --sprint NAME")
        cmd_search(argparse.Namespace(query=q, project=a.project, location=a.location,
                   columns="id,project,summary,State,Assignee", limit=a.limit, json=False))

# ---------- commands: write (preview by default) ----------
def _build_cf(short, field_args):
    if not field_args: return []
    fs = field_schema(short); entries = []
    for fa in field_args:
        if "=" not in fa: sys.exit(f"--field expects NAME=VALUE, got {fa}")
        name, value = fa.split("=", 1); name = name.strip()
        if name not in fs:
            sys.exit(f"field '{name}' not in {short}. Fields: {', '.join(sorted(fs))}")
        entries.append(cf_entry(name, fs[name], value))
    return entries

def _preview(label, payload, commit):
    print(f"## {label} {'(COMMIT)' if commit else '(PREVIEW — add --commit to apply)'}")
    print("```json"); print(json.dumps(payload, indent=1)); print("```")

def cmd_create(a):
    payload = {"project": {"id": project_id(a.project)}, "summary": a.summary}
    if a.description: payload["description"] = a.description
    cfs = _build_cf(a.project, a.field)
    if cfs: payload["customFields"] = cfs
    _preview(f"create issue in {a.project}", payload, a.commit)
    if a.commit:
        r = POST("/api/issues?fields=idReadable,summary", payload)
        print(f"\nCREATED: {r.get('idReadable')} — {r.get('summary')}")

def cmd_update(a):
    short = a.issue.split("-")[0]; payload = {}
    if a.summary: payload["summary"] = a.summary
    if a.description: payload["description"] = a.description
    cfs = _build_cf(short, a.field)
    if cfs: payload["customFields"] = cfs
    if not payload: sys.exit("nothing to update")
    _preview(f"update {a.issue}", payload, a.commit)
    if a.commit:
        print(f"\nUPDATED: {POST(f'/api/issues/{a.issue}?fields=idReadable', payload).get('idReadable')}")

def cmd_comment(a):
    _preview(f"comment on {a.issue}", {"text": a.text}, a.commit)
    if a.commit:
        POST(f"/api/issues/{a.issue}/comments?fields=id", {"text": a.text})
        print(f"\nCOMMENTED on {a.issue}")

def cmd_attach(a):
    if not os.path.exists(a.file): sys.exit(f"file not found: {a.file}")
    print(f"## attach {os.path.basename(a.file)} to {a.issue} "
          f"{'(COMMIT)' if a.commit else '(PREVIEW — add --commit to apply)'}")
    if not a.commit: return
    boundary = "----ytb" + uuid.uuid4().hex
    ctype = mimetypes.guess_type(a.file)[0] or "application/octet-stream"
    fname = os.path.basename(a.file)
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{fname}\"\r\n"
            f"Content-Type: {ctype}\r\n\r\n").encode() + open(a.file, "rb").read() + \
           f"\r\n--{boundary}--\r\n".encode()
    _req("POST", f"/api/issues/{a.issue}/attachments?fields=id,name", raw=body,
         content_type=f"multipart/form-data; boundary={boundary}")
    print(f"\nATTACHED {fname} to {a.issue}")

# ---------- commands API: state/assignee/priority/sprint/tag (respects workflow) ----------
def cmd_cmd(a):
    """Apply a YouTrack command (e.g. 'state Testing assignee jsmith') to one or
    more issues. Preview validates via /commands/assist (non-mutating); --commit applies."""
    issues = [{"idReadable": i.strip()} for i in a.issues.split(",") if i.strip()]
    if not a.commit:
        r = POST("/api/commands/assist?fields=commands(description,error),query",
                 {"query": a.query, "issues": issues})
        print(f"## command on {', '.join(i['idReadable'] for i in issues)} "
              f"(PREVIEW — add --commit to apply)")
        for c in r.get("commands", []):
            mark = "ERROR" if c.get("error") else "OK"
            print(f"  [{mark}] {re.sub('<[^>]+>', '', c.get('description',''))}")
        return
    body = {"query": a.query, "issues": issues}
    if a.comment: body["comment"] = a.comment
    POST("/api/commands?fields=issues(idReadable)", body)
    print(f"APPLIED `{a.query}` to {', '.join(i['idReadable'] for i in issues)}")

def cmd_log(a):
    payload = {"duration": {"minutes": parse_period(a.time)}}
    if a.text: payload["text"] = a.text
    if a.type: payload["type"] = {"name": a.type}
    _preview(f"log {a.time} on {a.issue}", payload, a.commit)
    if a.commit:
        POST(f"/api/issues/{a.issue}/timeTracking/workItems?fields=id,duration(presentation)", payload)
        print(f"\nLOGGED {a.time} on {a.issue}")

def cmd_history(a):
    cats = "IssueCreatedCategory,CustomFieldCategory,LinksCategory,SprintCategory"
    acts = GET(f"/api/issues/{a.issue}/activities?categories={cats}"
               f"&fields=timestamp,author(login),field(name),"
               f"added(name,presentation,login),removed(name,presentation,login)&$top={a.limit}")
    import datetime
    print(f"# History — {a.issue}\n")
    def fmt(xs):
        if not isinstance(xs, list): return ""
        return ", ".join(x.get("name") or x.get("presentation") or x.get("login")
                         for x in xs if isinstance(x, dict) and (x.get("name") or x.get("presentation") or x.get("login")))
    for e in acts:
        ts = e.get("timestamp"); d = datetime.datetime.utcfromtimestamp(ts/1000).strftime("%Y-%m-%d") if ts else "?"
        fld = (e.get("field") or {}).get("name", "")
        a_, r_ = fmt(e.get("added")), fmt(e.get("removed"))
        who = (e.get("author") or {}).get("login", "?")
        change = f"{r_} → {a_}" if (a_ or r_) else "created"
        print(f"- {d}  {who}  {fld}: {change}")

def cmd_boards(a):
    ags = GET("/api/agiles?fields=name,projects(shortName),"
              "sprints(name,isDefault,archived,start,finish)&$top=100")
    want = (a.project or "").upper()
    print("# Agile boards & live sprints\n")
    for ag in ags:
        codes = [p.get("shortName", "") for p in (ag.get("projects") or [])]
        if want and want not in [c.upper() for c in codes]:
            continue
        live = [s["name"] for s in (ag.get("sprints") or []) if not s.get("archived")]
        print(f"- **{ag['name']}** ({', '.join(codes)}) — sprints: {', '.join(live) or '—'}")

# ---------- people & restructure continuity ----------
def banned_logins():
    return [u["login"] for u in GET("/api/users?fields=login,banned&$top=400") if u.get("banned")]

def cmd_users(a):
    us = GET("/api/users?fields=login,fullName,banned,online,email&$top=400")
    if a.banned: us = [u for u in us if u.get("banned")]
    if a.active: us = [u for u in us if not u.get("banned")]
    if a.grep:
        g = a.grep.lower()
        us = [u for u in us if g in ((u.get("login") or "") + (u.get("fullName") or "")).lower()]
    rows = [[u.get("login"), u.get("fullName"), "DEACTIVATED" if u.get("banned") else "active"]
            for u in us[:a.limit]]
    print(f"# {len(us)} user(s)\n")
    print(md_table(rows, ["login", "name", "status"]))

def cmd_orphans(a):
    """Open work that will be stranded by departures: assigned to deactivated users."""
    banned = banned_logins()
    scope = f"project: {a.project} " if a.project else ""
    print(f"# Orphan risk{f' in {a.project}' if a.project else ''} (open work that needs a new owner)\n")
    if banned:
        bq = "Assignee: " + ", ".join(banned)
        n = count(f"{scope}#Unresolved {bq}")
        print(f"**Open issues assigned to {len(banned)} deactivated user(s): {n}**\n")
        if n:
            cmd_search(argparse.Namespace(query=f"#Unresolved {bq} sort by: updated desc",
                       project=a.project, location="", columns="id,project,summary,State,Assignee",
                       limit=a.limit, json=False))
    unassg = count(f"{scope}#Unresolved #Unassigned")
    print(f"\n**Plus currently unassigned open: {unassg}** "
          f"(use `report unassigned{f' --project '+a.project if a.project else ''}` to list)")

def cmd_reassign(a):
    """Bulk-move a departing person's open work to a new owner — preview, then --commit."""
    scope = f"project: {a.project} " if a.project else ""
    issues = get_issues(f"{scope}#Unresolved Assignee: {a.from_user}", fields="idReadable,summary", limit=500)
    ids = [it["idReadable"] for it in issues]
    print(f"## reassign {len(ids)} open issue(s) from `{a.from_user}` → `{a.to_user}`"
          f"{' (COMMIT)' if a.commit else ' (PREVIEW — add --commit to apply)'}\n")
    for it in issues[:30]:
        print(f"  - {it['idReadable']}  {(it.get('summary') or '')[:60]}")
    if len(ids) > 30: print(f"  … and {len(ids)-30} more")
    if not ids:
        print("  (nothing open assigned to that user)"); return
    if a.commit:
        POST("/api/commands?fields=issues(idReadable)",
             {"query": f"for {a.to_user}", "issues": [{"idReadable": i} for i in ids],
              "comment": a.comment or f"Reassigned from {a.from_user} during team changes."})
        print(f"\nREASSIGNED {len(ids)} issue(s) to {a.to_user}")

def cmd_load(a):
    proj = a.project or (PROFILE.get("projects") or [None])[0]
    if not proj: sys.exit("load needs --project (or a default project in your profile)")
    issues = get_issues(f"project: {proj} #Unresolved",
                        fields="idReadable,customFields(name,value(fullName,login))", limit=3000)
    from collections import Counter
    c = Counter()
    for it in issues:
        c[vname(cf_map(it).get("Assignee")) or "(unassigned)"] += 1
    print(f"# Open-work concentration — {proj} ({len(issues)} open)\n")
    print(md_table([[who, n] for who, n in c.most_common(25)], ["Owner", "Open issues"]))

# ---------- knowledge base & breadth ("the map") ----------
def cmd_articles(a):
    arts = GET("/api/articles?fields=idReadable,summary,project(shortName)&$top=400")
    if a.query:
        ql = a.query.lower(); arts = [x for x in arts if ql in (x.get("summary") or "").lower()]
    print(f"# {len(arts)} knowledge-base article(s)" + (f" matching '{a.query}'" if a.query else "") + "\n")
    print(md_table([[x.get("idReadable"), (x.get("project") or {}).get("shortName"), (x.get("summary") or "")[:70]]
                    for x in arts[:a.limit]], ["Article", "Project", "Title"]))

def cmd_article(a):
    art = GET(f"/api/articles/{a.id}?fields=idReadable,summary,content,project(shortName),reporter(login)")
    print(f"# {art.get('idReadable')} — {art.get('summary')}  ({(art.get('project') or {}).get('shortName')})\n")
    print(art.get("content") or "(no content)")

def cmd_article_create(a):
    payload = {"summary": a.summary, "content": a.content, "project": {"id": project_id(a.project)}}
    _preview(f"create KB article in {a.project}", payload, a.commit)
    if a.commit:
        r = POST("/api/articles?fields=idReadable,summary", payload)
        print(f"\nCREATED article {r.get('idReadable')} — {r.get('summary')}")

def cmd_tags(a):
    ts = GET("/api/tags?fields=name,owner(login)&$top=300")
    print(md_table([[t.get("name"), (t.get("owner") or {}).get("login", "")] for t in ts], ["Tag", "Owner"]))

def cmd_saved(a):
    sq = GET("/api/savedQueries?fields=name,query,owner(login)&$top=100")
    print(md_table([[s.get("name"), (s.get("query") or "")[:50], (s.get("owner") or {}).get("login", "")]
                    for s in sq], ["Saved query", "Query", "Owner"]))

# ---------- arg parsing ----------
def main():
    p = argparse.ArgumentParser(description="YouTrack assistant client")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("whoami").set_defaults(fn=cmd_whoami)
    sub.add_parser("profile").set_defaults(fn=cmd_profile)
    sub.add_parser("projects").set_defaults(fn=cmd_projects)

    s = sub.add_parser("setup")
    s.add_argument("--location", default=""); s.add_argument("--projects", default="")
    s.add_argument("--role", default=""); s.add_argument("--base", default=""); s.set_defaults(fn=cmd_setup)

    s = sub.add_parser("describe"); s.add_argument("--project", default=""); s.set_defaults(fn=cmd_describe)
    s = sub.add_parser("count"); s.add_argument("query"); s.set_defaults(fn=cmd_count)

    s = sub.add_parser("search"); s.add_argument("query")
    s.add_argument("--project", default=""); s.add_argument("--location", default="")
    s.add_argument("--columns", default=""); s.add_argument("--limit", type=int, default=50)
    s.add_argument("--json", action="store_true"); s.set_defaults(fn=cmd_search)

    s = sub.add_parser("get"); s.add_argument("issue"); s.set_defaults(fn=cmd_get)

    s = sub.add_parser("report")
    s.add_argument("type", choices=["health","activity","briefing","stale","unestimated",
                                    "unassigned","epics","mywork","sprint"])
    s.add_argument("--project", default=""); s.add_argument("--location", default="")
    s.add_argument("--days", type=int, default=7); s.add_argument("--sprint", default="")
    s.add_argument("--limit", type=int, default=50); s.set_defaults(fn=cmd_report)

    s = sub.add_parser("create"); s.add_argument("--project", required=True)
    s.add_argument("--summary", required=True); s.add_argument("--description", default="")
    s.add_argument("--field", action="append", default=[]); s.add_argument("--commit", action="store_true")
    s.set_defaults(fn=cmd_create)

    s = sub.add_parser("update"); s.add_argument("issue")
    s.add_argument("--summary", default=""); s.add_argument("--description", default="")
    s.add_argument("--field", action="append", default=[]); s.add_argument("--commit", action="store_true")
    s.set_defaults(fn=cmd_update)

    s = sub.add_parser("cmd"); s.add_argument("issues"); s.add_argument("query")
    s.add_argument("--comment", default=""); s.add_argument("--commit", action="store_true")
    s.set_defaults(fn=cmd_cmd)

    s = sub.add_parser("log"); s.add_argument("issue"); s.add_argument("time")
    s.add_argument("--text", default=""); s.add_argument("--type", default="")
    s.add_argument("--commit", action="store_true"); s.set_defaults(fn=cmd_log)

    s = sub.add_parser("history"); s.add_argument("issue")
    s.add_argument("--limit", type=int, default=20); s.set_defaults(fn=cmd_history)

    s = sub.add_parser("boards"); s.add_argument("--project", default=""); s.set_defaults(fn=cmd_boards)

    s = sub.add_parser("users")
    s.add_argument("--banned", action="store_true"); s.add_argument("--active", action="store_true")
    s.add_argument("--grep", default=""); s.add_argument("--limit", type=int, default=400); s.set_defaults(fn=cmd_users)

    s = sub.add_parser("orphans"); s.add_argument("--project", default="")
    s.add_argument("--limit", type=int, default=50); s.set_defaults(fn=cmd_orphans)

    s = sub.add_parser("reassign"); s.add_argument("from_user"); s.add_argument("to_user")
    s.add_argument("--project", default=""); s.add_argument("--comment", default="")
    s.add_argument("--commit", action="store_true"); s.set_defaults(fn=cmd_reassign)

    s = sub.add_parser("load"); s.add_argument("--project", default=""); s.set_defaults(fn=cmd_load)

    s = sub.add_parser("articles"); s.add_argument("--query", default="")
    s.add_argument("--limit", type=int, default=40); s.set_defaults(fn=cmd_articles)

    s = sub.add_parser("article"); s.add_argument("id"); s.set_defaults(fn=cmd_article)

    s = sub.add_parser("article-create"); s.add_argument("--project", required=True)
    s.add_argument("--summary", required=True); s.add_argument("--content", default="")
    s.add_argument("--commit", action="store_true"); s.set_defaults(fn=cmd_article_create)

    sub.add_parser("tags").set_defaults(fn=cmd_tags)
    sub.add_parser("saved").set_defaults(fn=cmd_saved)

    s = sub.add_parser("comment"); s.add_argument("issue"); s.add_argument("text")
    s.add_argument("--commit", action="store_true"); s.set_defaults(fn=cmd_comment)

    s = sub.add_parser("attach"); s.add_argument("issue"); s.add_argument("file")
    s.add_argument("--commit", action="store_true"); s.set_defaults(fn=cmd_attach)

    a = p.parse_args(); a.fn(a)

if __name__ == "__main__":
    main()
