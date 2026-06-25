# Positrack

**One engine, every assistant.** Positrack is a conversational front-end for the
Posibolt YouTrack tracker (`https://support.posibolt.com`) that works across
**Claude, ChatGPT, and Gemini** from a single source of truth.

It ships two distribution channels from **one shared core engine** (`core/ytcore.py`,
stdlib-only, nothing hardcoded — projects/fields/states are discovered live):

1. **Claude Agent Skill** (`positrack`) — installable via a plugin marketplace.
2. **Cross-platform MCP server** (FastMCP, stdio + HTTP) — so ChatGPT and Gemini can act on YouTrack too.

> Every user authenticates with **their own** YouTrack permanent token; permissions
> follow that token. No shared or embedded tokens, ever. Writes preview by default
> and only apply on explicit confirmation.

## Repository layout

| Path | What |
|---|---|
| `core/ytcore.py` | The shared engine — pure functions returning data; the single source of truth. |
| `cli/yt.py` | Thin CLI over the engine (keeps the skill working). |
| `skill/positrack/` | The Claude Agent Skill (SKILL.md + vendored engine + references). |
| `mcp/server.py` | FastMCP server wrapping the engine for ChatGPT/Gemini/Claude. |
| `.claude-plugin/marketplace.json` | Plugin marketplace manifest for `/plugin install`. |
| `docs/` | Install guides (Claude/ChatGPT/Gemini) + maintenance runbook. |
| `scripts/` | `package_skill.sh` (build `.skill`) + `check_sync.sh` (engine-sync gate). |

## Quickstart

_Filled in at v1.0.0 (see `docs/INSTALL_*.md`)._

## Which tool can do what

| Tool | Install | Can act on YouTrack? |
|---|---|---|
| **Claude** (Desktop/Code/web) | the `positrack` skill, or the MCP connector | ✅ read + write |
| **ChatGPT Plus** | custom MCP connector (Developer Mode) or a GPT Action | ✅ read + write (per-call confirm) |
| **Gemini CLI** | `gemini mcp add` against the MCP URL | ✅ read + write |
| **Gemini app** (consumer) | a knowledge-only "Gem" | ❌ knowledge only (no live calls) |

See `docs/` for the verified, per-tool setup.

## License

MIT — see [LICENSE](LICENSE).
