#!/usr/bin/env python3
"""
yt.py — Positrack CLI. A thin shell over the shared engine `ytcore`.

This file owns PRESENTATION only: argument parsing, markdown formatting, the
preview renderer, profile/token/base resolution, a local projects cache, and the
single error renderer that reproduces the engine's historical `sys.exit` text
(stream + exit code). All data/transport logic lives in `ytcore`.

Auth: the caller's OWN permanent token, from $YT_TOKEN, the file in $YT_ENV, or
/tmp/yt.env (KEY=VALUE). Base URL: profile -> $YT_BASE -> https://support.posibolt.com
Per-user context lives in ~/.config/youtrack-assistant/profile.json (or $YT_PROFILE).

`python3 yt.py --help` or `python3 yt.py <command> --help`.
"""
import argparse, json, os, sys, time

# Import the shared engine whether we live in cli/ (engine in ../core/) or in the
# vendored skill scripts/ dir (engine alongside us). Keeps this file byte-identical
# in both locations so the engine-sync gate stays honest.
_HERE = os.path.dirname(os.path.abspath(__file__))
for _p in (_HERE, os.path.join(os.path.dirname(_HERE), "core")):
    if os.path.isfile(os.path.join(_p, "ytcore.py")):
        sys.path.insert(0, _p)
        break
import ytcore as core

# ---------- profile / auth / base (shell concerns; never in core) ----------
PROFILE_PATH = os.environ.get("YT_PROFILE",
                              os.path.expanduser("~/.config/youtrack-assistant/profile.json"))

def load_profile():
    try:
        return json.load(open(PROFILE_PATH))
    except Exception:
        return {}

PROFILE = load_profile()

def base_url():
    return (PROFILE.get("base") or os.environ.get("YT_BASE") or core.DEFAULT_BASE).rstrip("/")

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
    raise core.YTError(None, "ERROR: no token. Set $YT_TOKEN or put 'YT_TOKEN=perm-...' in /tmp/yt.env "
                             "(chmod 600). Generate one in YouTrack: profile menu -> Account Security -> "
                             "New permanent token (scope: YouTrack).")

# Local projects cache — a single-user CLI convenience, never shared into core.
_PCACHE = os.environ.get("YT_PCACHE", "/tmp/yt_projects.json")

def cli_projects(ctx):
    try:
        if time.time() - os.path.getmtime(_PCACHE) < 1800:
            return json.load(open(_PCACHE))
    except Exception:
        pass
    ps = core.projects(ctx)
    try:
        json.dump(ps, open(_PCACHE, "w"))
    except Exception:
        pass
    return ps

# ---------- presentation helpers ----------
def md_table(rows, headers):
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join(["---"]*len(headers)) + "|"]
    for r in rows:
        out.append("| " + " | ".join(str(c).replace("\n", " ").replace("|", "\\|")[:80] for c in r) + " |")
    return "\n".join(out)

def issue_rows(issues, cols):
    rows = []
    for it in issues:
        d = core.cf_map(it); row = []
        for c in cols:
            if c == "id": row.append(it.get("idReadable", ""))
            elif c == "summary": row.append((it.get("summary") or "")[:70])
            elif c == "project": row.append((it.get("project") or {}).get("shortName") or (it.get("idReadable", "").split("-")[0]))
            elif c == "age": row.append(core.days_since(it.get("created")))
            else: row.append(core.vname(d.get(c)))
        rows.append(row)
    return rows

def _preview(label, payload, commit):
    print(f"## {label} {'(COMMIT)' if commit else '(PREVIEW — add --commit to apply)'}")
    print("```json"); print(json.dumps(payload, indent=1)); print("```")

def parse_fields(field_args):
    """--field NAME=VALUE -> {name: value}. Arg-format validation is a shell concern."""
    out = {}
    for fa in field_args:
        if "=" not in fa:
            raise core.YTError(None, f"--field expects NAME=VALUE, got {fa}")
        name, value = fa.split("=", 1)
        out[name.strip()] = value
    return out

def block_strings(blocks):
    """Flatten engine report 'blocks' into the exact sequence of print arguments,
    so `print("\\n".join(...))` reproduces the historical byte-for-byte output."""
    out = []
    for b in blocks:
        k = b["kind"]
        if k == "raw":
            out.append(b["s"])
        elif k == "table":
            out.append(md_table(b["rows"], b["headers"]))
        elif k == "search":
            out.append(f"# {len(b['issues'])} issue(s) — {b['query']}\n")
            out.append(md_table(issue_rows(b["issues"], b["columns"]), b["columns"]))
    return out

# ---------- commands ----------
def cmd_whoami(ctx, a):
    print(json.dumps(core.whoami(ctx), indent=2))

def cmd_profile(a):
    print(json.dumps(PROFILE, indent=2) if PROFILE else "(no profile set — run `yt.py setup ...`)")

def cmd_setup(ctx, a):
    me = core.whoami(ctx)
    prof = dict(PROFILE)
    prof["login"] = me.get("login"); prof["fullName"] = me.get("fullName")
    if a.location: prof["location"] = a.location
    if a.projects: prof["projects"] = [p.strip() for p in a.projects.split(",") if p.strip()]
    if a.role: prof["role"] = a.role
    if a.base: prof["base"] = a.base.rstrip("/")
    if a.briefing: prof["briefing"] = a.briefing
    os.makedirs(os.path.dirname(PROFILE_PATH), exist_ok=True)
    json.dump(prof, open(PROFILE_PATH, "w"), indent=2)
    print(f"Saved profile to {PROFILE_PATH}:\n" + json.dumps(prof, indent=2))

def cmd_projects(ctx, a):
    rows = [[p["shortName"], p["id"], "yes" if p.get("archived") else "", p["name"]]
            for p in sorted(cli_projects(ctx), key=lambda x: x.get("shortName") or "")]
    print(md_table(rows, ["Short", "ID", "Archived", "Name"]))

def cmd_describe(ctx, a):
    if not a.project:
        return cmd_projects(ctx, a)
    d = core.describe(ctx, a.project)
    print(f"# {a.project} fields\n")
    print(md_table([[n, t] for n, t in sorted(d["fields"].items())], ["Field", "Type"]))
    for key in ("State", "Type", "TaskType", "Priority", "Location", "Category", "Team"):
        if key in d["values"]:
            print(f"\n**{key}** values: {', '.join(d['values'][key])}")

def cmd_count(ctx, a):
    print(core.count(ctx, a.query))

def cmd_search(ctx, a):
    cols = a.columns.split(",") if a.columns else ["id", "project", "summary", "State", "Assignee"]
    q = core.search_query(a.query, a.project, a.location)
    issues = core.search(ctx, a.query, a.project, a.location, limit=a.limit)
    if a.json:
        print(json.dumps(issues, indent=1)); return
    print(f"# {len(issues)} issue(s) — {q}\n")
    print(md_table(issue_rows(issues, cols), cols))

def cmd_get(ctx, a):
    r = core.get_issue(ctx, a.issue)
    base, links, comments = r["base"], r["links"], r["comments"]
    d = core.cf_map(base)
    est = (d.get("Estimate") or {}).get("minutes") if isinstance(d.get("Estimate"), dict) else None
    spent = (d.get("Spent time") or {}).get("minutes") if isinstance(d.get("Spent time"), dict) else None
    print(f"# {base.get('idReadable')} — {base.get('summary')}\n")
    print(f"- project: {(base.get('project') or {}).get('shortName','')}   reporter: {core.vname(base.get('reporter'))}")
    print(f"- created: {core.days_since(base.get('created'))}d ago   "
          f"last update: {core.days_since(base.get('updated'))}d ago   "
          f"resolved: {'yes' if base.get('resolved') else 'no'}")
    if est or spent:
        print(f"- estimate: {est or '—'} min   spent: {spent or '—'} min")
    for k, v in d.items():
        if core.vname(v): print(f"- {k}: {core.vname(v)}")
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

def cmd_report(ctx, a):
    if a.type in ("health", "briefing"):
        proj = a.project or (PROFILE.get("projects") or [None])[0] or ""
    else:
        proj = a.project
    blocks = core.report(ctx, a.type, project=proj, location=a.location,
                         days=a.days, sprint=a.sprint, limit=a.limit)
    print("\n".join(block_strings(blocks)))

def cmd_create(ctx, a):
    fields = parse_fields(a.field)
    r = core.create(ctx, a.project, a.summary, a.description, fields, a.commit)
    _preview(r["label"], r["payload"], a.commit)
    if a.commit:
        c = r["created"]; print(f"\nCREATED: {c['idReadable']} — {c['summary']}")

def cmd_update(ctx, a):
    fields = parse_fields(a.field)
    r = core.update(ctx, a.issue, a.summary, a.description, fields, a.commit)
    _preview(r["label"], r["payload"], a.commit)
    if a.commit:
        print(f"\nUPDATED: {r['updated']}")

def cmd_comment(ctx, a):
    r = core.comment(ctx, a.issue, a.text, a.commit)
    _preview(r["label"], r["payload"], a.commit)
    if a.commit:
        print(f"\nCOMMENTED on {a.issue}")

def cmd_attach(ctx, a):
    if not os.path.exists(a.file):
        raise core.YTError(None, f"file not found: {a.file}")
    fname = os.path.basename(a.file)
    print(f"## attach {fname} to {a.issue} "
          f"{'(COMMIT)' if a.commit else '(PREVIEW — add --commit to apply)'}")
    if not a.commit:
        return
    data = open(a.file, "rb").read()
    core.attach(ctx, a.issue, fname, data, commit=True)
    print(f"\nATTACHED {fname} to {a.issue}")

def cmd_cmd(ctx, a):
    r = core.run_command(ctx, a.issues, a.query, a.comment, a.commit)
    ids = ", ".join(r["issues"])
    if not a.commit:
        print(f"## command on {ids} (PREVIEW — add --commit to apply)")
        for c in r["parsed"]:
            print(f"  [{'OK' if c['ok'] else 'ERROR'}] {c['description']}")
        return
    print(f"APPLIED `{a.query}` to {ids}")

def cmd_log(ctx, a):
    r = core.log_time(ctx, a.issue, a.time, a.text, a.type, a.commit)
    _preview(r["label"], r["payload"], a.commit)
    if a.commit:
        print(f"\nLOGGED {a.time} on {a.issue}")

def cmd_history(ctx, a):
    print(f"# History — {a.issue}\n")
    for e in core.history(ctx, a.issue, a.limit):
        change = f"{e['removed']} → {e['added']}" if (e["added"] or e["removed"]) else "created"
        print(f"- {e['date']}  {e['who']}  {e['field']}: {change}")

def cmd_boards(ctx, a):
    print("# Agile boards & live sprints\n")
    for b in core.boards(ctx, a.project):
        print(f"- **{b['name']}** ({', '.join(b['projects'])}) — sprints: {', '.join(b['sprints']) or '—'}")

def cmd_users(ctx, a):
    r = core.users(ctx, a.banned, a.active, a.grep, a.limit)
    rows = [[u.get("login"), u.get("fullName"), "DEACTIVATED" if u.get("banned") else "active"]
            for u in r["users"]]
    print(f"# {r['total']} user(s)\n")
    print(md_table(rows, ["login", "name", "status"]))

def cmd_orphans(ctx, a):
    print("\n".join(block_strings(core.orphans(ctx, a.project, a.limit))))

def cmd_reassign(ctx, a):
    r = core.reassign(ctx, a.from_user, a.to_user, a.project, a.comment, a.commit, a.instance_wide)
    print(f"## reassign {r['count']} open issue(s) from `{a.from_user}` → `{a.to_user}`"
          f"{' (COMMIT)' if a.commit else ' (PREVIEW — add --commit to apply)'}\n")
    for it in r["preview"]:
        print(f"  - {it['id']}  {it['summary']}")
    if r["more"]:
        print(f"  … and {r['more']} more")
    if not r["ids"]:
        print("  (nothing open assigned to that user)"); return
    if a.commit:
        print(f"\nREASSIGNED {r['count']} issue(s) to {a.to_user}")

def cmd_load(ctx, a):
    proj = a.project or (PROFILE.get("projects") or [None])[0]
    r = core.load(ctx, proj or "")
    print(f"# Open-work concentration — {r['project']} ({r['open']} open)\n")
    print(md_table([[who, n, b] for who, n, b in r["by_owner"]], ["Owner", "Open issues", "Load ▕"]))

def cmd_worklog(ctx, a):
    ex_types = [t.strip() for t in (a.exclude_types or "").split(",") if t.strip()]
    r = core.time_spent(ctx, query=a.query, project=a.project, location=a.location,
                        sprint=a.sprint, author=a.author, start=a.since, end=a.until,
                        group_by=a.group_by, exclude_propagated=not a.include_propagated,
                        exclude_types=ex_types)
    label = (f"sprint {a.sprint}" if a.sprint else None) or (a.project or a.location or "(whole instance)")
    win = ""
    if r.get("window"):
        win = f"  [{r['window'].get('start') or '…'} .. {r['window'].get('end') or '…'}]"
    print(f"# Time spent by {r['group_by']} — {label}{win}  ({r['count']} entries · {r['total']} total)\n")
    ex = r.get("excluded")
    if ex:
        print(f"_excluded {ex['total']} of propagated 'Propagated from Bug' time ({ex['entries']} entries)_\n")
    rows = [[g["key"], g["entries"], g["issues"], g["presentation"], g["bar"]] for g in r["groups"]]
    print(md_table(rows, [r["group_by"].capitalize(), "Entries", "Issues", "Time", "▕"]))

def cmd_articles(ctx, a):
    r = core.articles(ctx, a.query, a.limit)
    print(f"# {r['total']} knowledge-base article(s)" + (f" matching '{a.query}'" if a.query else "") + "\n")
    print(md_table([[x.get("idReadable"), (x.get("project") or {}).get("shortName"), (x.get("summary") or "")[:70]]
                    for x in r["articles"]], ["Article", "Project", "Title"]))

def cmd_article(ctx, a):
    art = core.article(ctx, a.id)
    print(f"# {art.get('idReadable')} — {art.get('summary')}  ({(art.get('project') or {}).get('shortName')})\n")
    print(art.get("content") or "(no content)")

def cmd_article_create(ctx, a):
    r = core.article_create(ctx, a.project, a.summary, a.content, a.commit)
    _preview(r["label"], r["payload"], a.commit)
    if a.commit:
        c = r["created"]; print(f"\nCREATED article {c['idReadable']} — {c['summary']}")

def cmd_tags(ctx, a):
    ts = core.tags(ctx)
    print(md_table([[t.get("name"), (t.get("owner") or {}).get("login", "")] for t in ts], ["Tag", "Owner"]))

def cmd_saved(ctx, a):
    sq = core.saved(ctx)
    print(md_table([[s.get("name"), (s.get("query") or "")[:50], (s.get("owner") or {}).get("login", "")]
                    for s in sq], ["Saved query", "Query", "Owner"]))

# ---------- arg parsing ----------
def build_parser():
    p = argparse.ArgumentParser(description="Positrack CLI — YouTrack assistant client")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("whoami").set_defaults(fn=cmd_whoami)
    sub.add_parser("profile").set_defaults(fn=cmd_profile)
    sub.add_parser("projects").set_defaults(fn=cmd_projects)

    s = sub.add_parser("setup")
    s.add_argument("--location", default=""); s.add_argument("--projects", default="")
    s.add_argument("--role", default=""); s.add_argument("--base", default="")
    s.add_argument("--briefing", default="", help="plain-English recipe for your custom briefing")
    s.set_defaults(fn=cmd_setup)

    s = sub.add_parser("describe"); s.add_argument("--project", default=""); s.set_defaults(fn=cmd_describe)
    s = sub.add_parser("count"); s.add_argument("query"); s.set_defaults(fn=cmd_count)

    s = sub.add_parser("search"); s.add_argument("query")
    s.add_argument("--project", default=""); s.add_argument("--location", default="")
    s.add_argument("--columns", default=""); s.add_argument("--limit", type=int, default=50)
    s.add_argument("--json", action="store_true"); s.set_defaults(fn=cmd_search)

    s = sub.add_parser("get"); s.add_argument("issue"); s.set_defaults(fn=cmd_get)

    s = sub.add_parser("report")
    s.add_argument("type", choices=["health", "activity", "briefing", "stale", "unestimated",
                                    "unassigned", "epics", "mywork", "sprint", "myday", "hygiene",
                                    "timespent"])
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
    s.add_argument("--instance-wide", dest="instance_wide", action="store_true")
    s.add_argument("--commit", action="store_true"); s.set_defaults(fn=cmd_reassign)

    s = sub.add_parser("load"); s.add_argument("--project", default=""); s.set_defaults(fn=cmd_load)

    s = sub.add_parser("worklog")
    s.add_argument("--query", default=""); s.add_argument("--project", default="")
    s.add_argument("--location", default=""); s.add_argument("--sprint", default="")
    s.add_argument("--author", default=""); s.add_argument("--since", default="")
    s.add_argument("--until", default="")
    s.add_argument("--group-by", dest="group_by", default="author",
                   choices=["author", "type", "project", "issue"])
    s.add_argument("--include-propagated", dest="include_propagated", action="store_true",
                   help="count workflow-propagated entries (default: exclude them, direct time only)")
    s.add_argument("--exclude-types", dest="exclude_types", default="",
                   help="comma-separated work-item type names to also drop")
    s.set_defaults(fn=cmd_worklog)

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
    return p

# Commands that do not touch the network (and so need no token).
_NO_TOKEN = {"profile"}

def main():
    a = build_parser().parse_args()
    try:
        if a.cmd in _NO_TOKEN:
            a.fn(a)
        else:
            ctx = core.Ctx(get_token(), base_url())
            a.fn(ctx, a)
    except core.YTError as e:
        if e.status_code is None:
            sys.exit(e.friendly_message)
        sys.exit(f"YouTrack {e.status_code}: {e.friendly_message}")

if __name__ == "__main__":
    main()
