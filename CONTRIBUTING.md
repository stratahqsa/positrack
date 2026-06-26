# Contributing to Positrack

Thanks for helping improve Positrack! Anyone can contribute — you don't need write
access. You fork, make a change on a branch, and open a pull request; a maintainer
reviews and merges it.

## The flow (fork → branch → PR → merge)

1. **Fork** this repo (top-right "Fork" on GitHub).
2. **Clone your fork** and create a branch:
   ```bash
   git clone https://github.com/<you>/positrack.git
   cd positrack
   git checkout -b fix-something
   ```
3. **Make your change** and run the checks locally (see below).
4. **Commit and push** to your fork, then open a **Pull Request** against `stratahqsa/positrack:master`.
5. **CI runs automatically.** A maintainer merges once it's green. ✅

## Run the checks before you open a PR

CI will run these on your PR, but running them locally first saves a round-trip:

```bash
# Python 3.12 recommended (the MCP server needs 3.10+; the engine itself is 3.9+)
pip install -r mcp/requirements.txt pytest

bash scripts/check_sync.sh      # engine-sync gate (see "One engine" below)
python -m pytest tests/ -q      # 20 tests; live/network tests auto-skip without YT_TOKEN
```

To run the live tests too (optional), export your own `YT_TOKEN` (and `YT_TOKEN_2` /
`YT_TEST_PROJECT` for the isolation + write tests). Never commit a token.

## The one rule that trips people up: ONE engine, vendored into the skill

All logic lives in **`core/ytcore.py`** (pure functions). `cli/yt.py` and
`mcp/server.py` are thin layers over it. The Claude skill ships **vendored copies**
of the engine at `skill/positrack/scripts/`.

**If you change `core/ytcore.py` or `cli/yt.py`, re-sync the vendored copies:**

```bash
cp core/ytcore.py skill/positrack/scripts/ytcore.py
cp cli/yt.py       skill/positrack/scripts/yt.py
bash scripts/check_sync.sh      # must print "engine sync OK"
```

CI fails if they drift. This keeps the installed skill and the deployed MCP running
the exact same code.

## Things CI (and review) will check

- **Tests pass** and `check_sync.sh` is green.
- **CLI parity:** `cli/yt.py` output must stay byte-identical to the engine's behaviour.
  If you intentionally change CLI output, update the golden snapshots in `tests/golden/`
  (regenerate with `python3 tests/test_cli_parity.py capture <original yt.py>`) and explain why.
- **Write safety preserved:** every mutating tool defaults to `commit=False` (preview);
  never remove that gate.
- **No secrets, ever:** tokens are per-user and never committed/logged. `*.env` is
  gitignored. The engine must not print, `sys.exit`, or read process-global token state
  in `core/` (the multi-tenant safety model depends on this).

## Style

- Match the surrounding code (stdlib-only engine; concise, commented where non-obvious).
- Conventional-commit-ish messages (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`).
- Keep PRs focused — one logical change per PR is easiest to review and merge.

Questions? Open an issue or ask in the PR. Welcome aboard!
