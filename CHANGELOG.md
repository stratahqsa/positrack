# Changelog

All notable changes to Positrack are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/); versioning is [SemVer](https://semver.org/).

## [Unreleased]

### Added

- New "time spent by person" reporting that reads YouTrack's per-entry work items (each with its own author, issue, and date) instead of grouping the issue-level "Spent time" rollup by current Assignee — fixing misattribution after reassignments and epic-level double-counting. Available as a `yt_worklog` MCP tool, `yt_report timespent`, and CLI `worklog` command. Workflow-propagated time (work items whose text reads "Propagated from Bug …") is excluded by default with the excluded amount disclosed, and can be re-included via `include_propagated`/`--include-propagated` or filtered by work-item type via `exclude_types`/`--exclude-types`.
- OAuth (OIDCProxy) connector at `/cmcp` so ChatGPT's Developer Mode connector can log in per-user via Posibolt Hub and forward Hub's access token to YouTrack. The existing `/mcp` and `/sse` endpoints (Claude, Gemini CLI) keep working with raw bearer tokens, and OAuth stays disabled unless `HUB_CLIENT_ID`/`HUB_CLIENT_SECRET`/`OAUTH_PUBLIC_URL` are set.
- `report myday` (CLI `myday`, MCP `yt_report type=myday`) showing the caller's open work, stale items needing a status update, and in-progress issues via `for: me`, plus a "self-updating board" workflow where the assistant drafts status/time-log updates for stale or completed work for batch approval and can generate a standup from `myday`.
- `report hygiene` (CLI/MCP) that scores each project's board cleanliness 0-100% (share of open issues touched in the last 30 days) and lists stale/unassigned/unestimated issues, plus a `setup --briefing` option to save a per-leader plain-English briefing recipe in their profile.
- Unicode bar charts in report output: `report health` shows an Open-issues bar per project and `load` shows a workload bar per owner, with MCP/skill instructions nudging clients to lead with a chart.
- A screenshot-walkthrough user manual (`docs/MANUAL.md`) covering the token-free OAuth connector setup for ChatGPT and Claude, Gemini's CLI-only limitation, default visual behavior, write safety, and a troubleshooting table.
- A step-by-step "Get your YouTrack token" walkthrough in the README so new users can self-serve a permanent token.

### Changed

- MCP server instructions now always call YouTrack tools instead of claiming the connector is unavailable or falling back to web search, and discover each project's real field values via `yt_describe` before building queries — wrapping multi-word values in `{braces}` (e.g. `Scope: {PHASE 1}`) and retrying on "value not used for field" errors — fixing plain-English asks like "epics to be taken up in Phase 1" and "list epics in PXB1" that previously returned empty or were routed to web search.
- A visual is now the default presentation for any data-bearing answer (counts, lists, breakdowns, workload, trends, hygiene, briefings), not just health/load/activity reports — with per-client guidance for real charts on rich clients (Claude artifacts, ChatGPT's chart tool) and inline Unicode bars on terminal clients (Gemini CLI).
- Installation docs (`docs/INSTALL_CHATGPT.md`, `docs/INSTALL_CLAUDE.md`) now steer users toward the OAuth connector over the legacy Actions path.

### Fixed

- ChatGPT could connect via OAuth but saw zero tools because the OIDCProxy enforced the full upstream scope set (including YouTrack/Hub service UUIDs) on every downstream `/cmcp` call, while Hub only echoes standard OIDC scopes in the issued token — so every authenticated call was rejected with 403 insufficient_scope. Downstream scope enforcement is now cleared while the required scopes are still requested upstream from Hub.
- OAuth client registrations (DCR) now persist to a mounted volume (`OAUTH_CLIENT_STORE_DIR`, default `/data/oauth-clients`) instead of living only in memory, so ChatGPT/Claude connectors no longer break with "Client Not Registered" after a Railway redeploy. Falls back to in-memory storage automatically when no writable volume is mounted.
- `report health` no longer aborts with a raw "YouTrack 400" when a project lacks an Estimate field (the cell degrades to "—" via `count_soft()`), and reports now show a friendly, actionable message on HTTP 400.
- `yt_reassign`/`reassign` now require an explicit project scope unless `--instance-wide`/`instance_wide=True` is passed, preventing accidental instance-wide reassignments.

### Internal

- Added CI (GitHub Actions: `check_sync` gate + pytest on Python 3.12, plus a 3.9 byte-compile check of the stdlib engine), Dependabot for the `/mcp` pip stack and GitHub Actions versions, and contribution scaffolding (`CONTRIBUTING.md`, PR/issue templates); later bumped `actions/checkout` v4→v5 and `actions/setup-python` v5→v6 off the deprecated Node 20 runtime.

## [1.0.0] - 2026-06-26

### Added
- Initial Positrack repo: one shared engine (`core/ytcore.py`) feeding two channels —
  the `positrack` Claude Agent Skill and a cross-platform FastMCP server.
- CLI (`cli/yt.py`) with full behavioural parity to the original `yt.py` engine.
- FastMCP server (`mcp/server.py`) over stdio + streamable HTTP + SSE, exposing all
  read/write `yt_*` tools with per-user header auth and preview→commit write safety.
- Claude plugin marketplace manifest, skill packager, Railway Dockerfile, and
  install/maintenance docs for Claude, ChatGPT, and Gemini.
