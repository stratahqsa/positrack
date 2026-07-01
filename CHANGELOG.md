# Changelog

All notable changes to Positrack are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/); versioning is [SemVer](https://semver.org/).

## [Unreleased]

### Added
- **True logged-time by person** — new `yt_worklog` tool, `yt_report timespent`, and
  CLI `worklog` command. Reads YouTrack work items (`/api/workItems`) and attributes
  time to who LOGGED each entry, not the issue's current assignee — fixing
  time-by-person reports that misattributed work after reassignments and epic-level
  Spent-time rollups. Scope by project / location / sprint / author and an optional
  `since`/`until` window; `group_by` author|type|project|issue; chart-ready bars.
- Workflow-propagated time is excluded by default: "Propagated from Bug …" work
  items (which copy a bug's time onto its parent story/epic and double-count it) are
  dropped so only DIRECT logged time is reported, and the excluded amount is
  disclosed. Override with `include_propagated` / `--include-propagated`, or drop
  additional work-item types with `exclude_types` / `--exclude-types`.

## [1.0.0] - 2026-06-26

### Added
- Initial Positrack repo: one shared engine (`core/ytcore.py`) feeding two channels —
  the `positrack` Claude Agent Skill and a cross-platform FastMCP server.
- CLI (`cli/yt.py`) with full behavioural parity to the original `yt.py` engine.
- FastMCP server (`mcp/server.py`) over stdio + streamable HTTP + SSE, exposing all
  read/write `yt_*` tools with per-user header auth and preview→commit write safety.
- Claude plugin marketplace manifest, skill packager, Railway Dockerfile, and
  install/maintenance docs for Claude, ChatGPT, and Gemini.
