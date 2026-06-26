# Changelog

All notable changes to Positrack are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/); versioning is [SemVer](https://semver.org/).

## [1.0.0] - 2026-06-26

### Added
- Initial Positrack repo: one shared engine (`core/ytcore.py`) feeding two channels —
  the `positrack` Claude Agent Skill and a cross-platform FastMCP server.
- CLI (`cli/yt.py`) with full behavioural parity to the original `yt.py` engine.
- FastMCP server (`mcp/server.py`) over stdio + streamable HTTP + SSE, exposing all
  read/write `yt_*` tools with per-user header auth and preview→commit write safety.
- Claude plugin marketplace manifest, skill packager, Railway Dockerfile, and
  install/maintenance docs for Claude, ChatGPT, and Gemini.
