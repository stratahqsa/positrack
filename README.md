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

**Live MCP server:** `https://positrack.up.railway.app/mcp` (streamable HTTP) · health: `/health`

### Step 1 — Get your YouTrack token (everyone does this once)

Each user authenticates with **their own** token — it carries only *your* permissions, which
is the whole safety model. Never share it or paste it into the skill/repo.

1. Log in to **https://support.posibolt.com** with **your own** user.
2. Click your **avatar** in the **bottom-left** menu, then click **Profile**.
3. Open the **Account Security** tab.
4. Under permanent tokens, click **New token…**, give it a name (e.g. `Positrack`), leave the
   scope as **YouTrack**, and save.
5. **Copy the token immediately** — it starts with `perm-` and is shown **only once**. If you
   lose it, just generate a new one.

Keep it somewhere private (a password manager). You'll paste it into whichever tool you use
below. Rotate it if it's ever exposed; revoke it from this same screen when you leave.

### Step 2 — Connect your tool

- **Claude (skill — richest):** `/plugin marketplace add stratahqsa/positrack` then
  `/plugin install positrack@groworx`. → [docs/INSTALL_CLAUDE.md](docs/INSTALL_CLAUDE.md)
- **ChatGPT (Plus, full read+write):** a Custom GPT Action (`docs/chatgpt-action-openapi.yaml`)
  or the Developer-Mode MCP connector. → [docs/INSTALL_CHATGPT.md](docs/INSTALL_CHATGPT.md)
- **Gemini CLI (live):**
  `gemini mcp add --transport http --header "Authorization: Bearer <token>" positrack https://positrack.up.railway.app/mcp`
  → [docs/INSTALL_GEMINI.md](docs/INSTALL_GEMINI.md)
- **CLI (local):** `export YT_TOKEN=perm-… && python3 cli/yt.py whoami`

See [docs/MAINTENANCE.md](docs/MAINTENANCE.md) for the engine-sync gate, redeploys, and token rotation.

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
