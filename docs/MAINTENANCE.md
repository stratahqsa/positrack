# Positrack maintenance

How to keep Positrack healthy: one engine, one skill, one MCP server — all from
this repo. Read this before editing core code, repackaging the skill, or
redeploying the server.

## 1. Single source of truth

**This Git repo is the source of truth.** The engine lives in `core/ytcore.py`.
It is **vendored** (copied) into the skill so the packaged skill is
self-contained:

- `core/ytcore.py` — the real engine
- `skill/positrack/scripts/ytcore.py` — a vendored copy (must match)
- `cli/yt.py` → vendored to `skill/positrack/scripts/yt.py`

These copies **must stay in sync.** `scripts/check_sync.sh` is a **hard gate** —
`package_skill.sh` refuses to build on any drift.

After editing `core/ytcore.py` or `cli/yt.py`, re-vendor immediately:

```bash
cp core/ytcore.py skill/positrack/scripts/ytcore.py
cp cli/yt.py      skill/positrack/scripts/yt.py
bash scripts/check_sync.sh        # must pass before anything else
```

Never hand-edit the vendored copies — edit `core/`/`cli/` and re-copy.

## 2. Re-package the skill

After any skill or engine change, rebuild the archive:

```bash
bash scripts/package_skill.sh     # runs check_sync, then zips → dist/positrack.skill
```

The build refuses to run on sync drift (see §1). Then ship it:

- Share `dist/positrack.skill` directly, or
- Push to the marketplace repo so users pull it with `/plugin update`.

## 3. Redeploy the MCP server

The server deploys to **Railway**. Redeploy by pushing to the repo — Railway
rebuilds automatically.

- **Dockerfile:** `mcp/Dockerfile`, built from the **repo root** (the image needs
  `core/` next to `mcp/`).
- **Env:** set `YT_BASE=https://support.posibolt.com` only. **Never** set a
  `YT_TOKEN` — tokens are per-user and ride in the request header.
- Railway injects `$PORT`; the server binds it automatically.

The FastMCP version is **pinned** in `mcp/requirements.txt`. The dual-transport
mount (`/mcp` + `/sse`) and `/health` route are version-sensitive, so re-run the
smoke test after **any** FastMCP bump:

```bash
curl -fsS https://positrack.up.railway.app/health                 # {"status":"ok",...}
curl -fsS -X POST https://positrack.up.railway.app/mcp \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Authorization: Bearer perm-...' \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'   # streamable HTTP (recommended)
curl -fsS https://positrack.up.railway.app/sse -H 'Authorization: Bearer perm-...'  # SSE alive
```

Streamable HTTP at `/mcp` is the recommended connect URL; `/sse` is kept for
older connector paths.

## 4. Tokens

Every user authenticates with **their own** YouTrack permanent token (starts
`perm-`), created in YouTrack → profile avatar → **Account Security** →
**New permanent token** (scope: YouTrack). Tokens are never shared, embedded, or
logged; permissions follow the token, so a `403` is **expected** (an admin/lead
token may be needed), not a bug.

Token hygiene:

- **Rotate on a schedule** — have users regenerate their token periodically and
  update `/tmp/yt.env` / their connector header.
- **Revoke immediately when someone leaves** (deactivate their YouTrack account /
  revoke their token), then **catch their stranded open work**:

```bash
python3 cli/yt.py orphans --project IS     # CLI: open work owned by deactivated/unassigned users
```

or call `yt_orphans` via the MCP. Reassign anything stuck with `yt reassign`
(preview first, then `--commit`).

## 5. Versioning

Bump the version in **all three** places for every release, then tag:

- `.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`
- `CHANGELOG.md` (add the release entry)

```bash
git tag v1.x.y
git push --tags
```

Keep the three version numbers identical — mismatches confuse `/plugin update`.

## 6. Two-minute smoke test (before shipping)

Run this against a live token before releasing a skill or server change:

```bash
python3 cli/yt.py whoami                                  # 1. auth works
python3 cli/yt.py search "#Unresolved" --project IS       # 2. one read
python3 cli/yt.py report health --project IS              # 3. one report
python3 cli/yt.py cmd IS-184 "state Testing"              # 4. a write PREVIEW (no --commit)
```

The write must return a **preview** and change nothing (no `--commit` / no
`commit=true`). If all four behave, ship.

## 7. Support

When a user is confused, point them at **`references/outlier_cases.md`** first —
it documents the edge cases that trip people up:

- deactivated / banned users and their stranded work,
- permission-limited tokens (the expected `403`),
- states like **"Completed" that aren't flagged as resolved**,
- archived/empty projects, multi-value fields, empty results.

Most "is this broken?" questions are really one of these.

## 8. YouTrack's official MCP

JetBrains ships an official **YouTrack Remote MCP server** (2025.3+). Positrack
isn't a duplicate — it adds the assistant layer (plain-English routing,
capture-nudging), **preview→commit safety on every write**, location/briefing
reports, and self-hosted reach, all from the **same engine** that powers the CLI
and the skill. Keep both in mind when scoping new features.

## CI service account (`secrets.YT_TOKEN`)

`secrets.YT_TOKEN` drives the hourly **Snapshot** workflow (which feeds the POSX
Reports dashboard) and the **Release schedule** workflow. Both are **read-only**:
`scripts/snapshot.py` calls only `get_issues`, `report`, `boards`, `effort_report`,
`work_item_pool` and `whoami` — there is no write anywhere in that path.

**It must be a dedicated service account, never a person's own token.**

> **Why this is not theoretical.** On 2026-08-18 this secret held a maintainer's
> personal *admin* token. They deleted it during ordinary token hygiene and the hourly
> snapshot failed with `BLOCKED on YouTrack 401` for roughly ten hours before anyone
> noticed — the dashboard just quietly went stale. A personal token also means the job
> runs with that person's full admin rights to do a job that only reads.

### The account

| | |
|---|---|
| Login | `positrack-ci` (any dedicated login; it must not be a human's) |
| Roles | **`Issue Reader` + `Observer`** — *both are required* |
| Token | Its own permanent token, scope `YouTrack`, stored only in `secrets.YT_TOKEN` |

**Why both roles** — neither is sufficient alone, which is easy to get wrong:

| Role | Grants | Missing on its own |
|---|---|---|
| `Issue Reader` | `READ_ISSUE`, `READ_REPORT`, `READ_COMMENT`, `READ_ARTICLE` | `jetbrains.jetpass.user-read-basic` → assignee names cannot be resolved |
| `Observer` | `user-read-basic`, `READ_COMMENT`, `project-read-basic` | `READ_ISSUE` → cannot read issues at all |

**Time tracking:** the snapshot reads work items (`work_item_pool`,
`timespent_from_items`). Neither role above lists an explicit work-item read
permission, so if the Effort report or time-by-person comes back empty after a
rotation, grant the time-tracking read permission and re-run. Start least-privilege
and widen only on evidence.

### Rotating it

1. In YouTrack, signed in **as the service account**: avatar → Account Security →
   New permanent token, scope `YouTrack`.
2. Set the secret without the value passing through a shell history or a chat:
   ```bash
   gh secret set YT_TOKEN --repo stratahqsa/positrack
   ```
   (it prompts for the value)
3. Verify before walking away — a bad token fails in ~20s, a healthy run takes ~5 min:
   ```bash
   gh workflow run snapshot.yml
   gh run list --workflow=snapshot.yml --limit 3
   ```
   A failure prints `BLOCKED on YouTrack 401: your token is invalid or expired`.

Personal tokens can then be rotated or revoked freely — including right after an
accidental paste — without taking the dashboard down.
