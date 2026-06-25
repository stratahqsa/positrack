# YouTrack query cookbook

Turn plain English into a YouTrack query for `yt.py search` / `yt.py count`.
Clauses are `field: value`, joined by spaces (AND). Works across all projects.

## Table of contents
1. Core syntax
2. Attributes & built-ins (incl. date gotchas)
3. Filtering by project / location / team / category
4. Discovering a field's allowed values (before a write)
5. Ready-made queries (the questions people ask)

---

## 1. Core syntax
- AND = space: `project: P8 #Unresolved Type: Bug`
- OR within a field = commas: `State: Open, Testing`
- Negation: `has: -{Estimate}`, `#Unassigned`, `-Type: Bug`
- Multi-word values in braces: `State: {On hold}`, `Location: {South Africa}`
- Sort: `sort by: updated desc` (also `created`, `State`, `priority`)
- Built-ins: `#Unresolved`, `#Resolved`, `#Unassigned`, `for: me`

## 2. Attributes & built-ins (date gotchas matter)
- `created: {minus 7d} .. Today` — created in last 7 days
- `updated: {minus 30d} .. Today` — updated recently
- **`resolved date: {minus 7d} .. Today`** — resolved recently. **Use
  `resolved date:`, NOT `resolved:`** (this instance rejects `resolved:`).
- Stale (untouched > 30d): `updated: * .. {minus 30d}`
- End ranges with **`Today`**, not `Now`.
- `#Unresolved` / `#Resolved` filter by resolution; `Assignee: login` or
  `#Unassigned` filter ownership.

## 3. Project / location / team / category
- One project: `project: IS` (codes: run `yt.py projects` — they include P8, IS,
  OFT, SUP, GCC, APP, DVPS, DAB, PCK, and the POS X family).
- Location (set on IS, P8, SUP, GCC, DAB): `Location: SA` (also UAE, INDIA, KSA,
  BAHRAIN, QATAR, OMAN, KUWAIT). Cross-project — great for "what's happening in SA".
- Team / Category / Branch exist on some projects — confirm with `describe`.
- Combine freely: `Location: SA Type: Shopify #Unresolved`

## 4. Discovering a field's allowed values (before a write)
- Quick: `python3 scripts/yt.py describe --project IS` lists fields + the values
  for State / Type / Priority / Location / Category / Team.
- Exact values for one field (any project) — query its bundle:
```
python3 - <<'PY'
import json,urllib.request
tok=open('/tmp/yt.env').read().split('=',1)[1].strip()
B="https://support.posibolt.com"; PID="0-67"   # IS; get IDs from `yt.py projects`
u=f"{B}/api/admin/projects/{PID}/customFields?fields=field(name),bundle(values(name,archived))&$top=200"
r=urllib.request.Request(u,headers={"Authorization":"Bearer "+tok,"Accept":"application/json"})
for f in json.load(urllib.request.urlopen(r)):
    b=f.get("bundle") or {}
    if b.get("values"): print(f["field"]["name"],"=>",[v["name"] for v in b["values"] if not v.get("archived")])
PY
```
Casing matters on writes (`On hold` ≠ `on hold`, `TESTING` ≠ `Testing`).

## 5. Ready-made queries (the questions people ask)

**"What happened this week in SA?"** → use `report activity --location SA`, or raw:
`Location: SA updated: {minus 7d} .. Today sort by: updated desc`

**"What did we resolve this week in SA?"**
`Location: SA resolved date: {minus 7d} .. Today`

**"What's open and stuck in Integration Support?"**
`project: IS #Unresolved updated: * .. {minus 30d} sort by: updated asc`

**"Open bugs in POSibolt V8 for a given client"**
`project: P8 #Unresolved Type: Bug {Client Name}: {AL MAJED}`

**"Unassigned support tickets"**
`project: SUP #Unresolved #Unassigned`

**"Everything on hold / blocked in IS"**
`project: IS State: {On hold}`

**"My open work"** → `report mywork`, or `#Unresolved for: me sort by: updated desc`

**"What landed on the board this week (any project)?"**
`created: {minus 7d} .. Today sort by: created desc`

**"Escalated helpdesk tickets"** (SUP has escalation states)
`project: SUP State: Escalated`

**"How far is ISSUE-ID / where are the risks?"** → `yt.py get ISSUE-ID` (returns
state, age, estimate-vs-spent, links, comments), then reason about progress and
risk; no single query needed.

When unsure, run `yt.py count` first to sanity-check size before listing.

---

## 6. Command strings (for `yt.py cmd`)

`yt.py cmd <issues> "<command string>"` routes through YouTrack's Commands API,
which respects the state-machine and validates before applying. Combine commands
in one string (space-separated). Common ones:

| Command | Effect |
|---|---|
| `state In Progress` | Set State (use the project's real state name) |
| `Fixed` / `state Open` | Quick state set |
| `assignee jsmith` | Assign to login `jsmith` |
| `for me` / `for Unassigned` | Assign to token owner / unassign |
| `priority Critical` | Set Priority |
| `type Bug` | Set Type |
| `tag myTag` / `remove tag myTag` | Add / remove a tag |
| `Sprints {Sprint Name}` | Add to a sprint |
| `fix version 2.1` | Set fix version |

Chain them: `cmd IS-184 "state Testing assignee jsmith priority High"`. The
preview prints YouTrack's parse with OK/ERROR per clause, so a bad login or an
illegal transition is caught before you `--commit`.

## 7. Other actions
- **Progress timeline:** `yt.py history ISSUE` — state changes, reassignments,
  links and sprint moves over time (use for "how far / how long has it sat").
- **Log time:** `yt.py log ISSUE 90m --text "..." --type Development`.
- **Boards & sprints:** `yt.py boards [--project P]` — the real agile boards and
  their live sprints (more accurate than the `Sprints:` field for "what's in the
  current sprint").
