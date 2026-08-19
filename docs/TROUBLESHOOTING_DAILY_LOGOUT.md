# "Positrack logs me out every day" — diagnose it yourself

**Audience:** anyone using the Positrack connector who keeps getting asked to reconnect.
You do **not** need Railway or Hub admin rights to complete the first half of this.

**How to use this:** paste this whole file into a Claude/ChatGPT conversation and say
*"help me work through this."* It is written to give an assistant everything it needs —
the architecture, the known root cause, the exact commands, and what a good vs bad
result looks like — so you can finish without waiting on anyone.

> **The 30-second version.** In YouTrack go to your avatar → **Account Security** →
> **Refresh Tokens**. Find a row whose *Client Service* is **Positrack**.
> - `Last Used` shows a **real date** → refresh is working. Your logout has a
>   different cause; go to [Part 3](#part-3--if-refresh-is-working-but-you-still-get-logged-out).
> - `Last Used` says **Never** → refresh has never succeeded for you. Go to
>   [Part 2](#part-2--refresh-is-failing).
> - **No Positrack row at all** → you have never completed an OAuth connect. Go to
>   [Part 1](#part-1--which-path-are-you-actually-on).

---

## Background: why a logout happens at all

Positrack does not hold your password. It proxies **Posibolt Hub**, and there are
**three** tokens in play. Understanding this is most of the diagnosis:

| Token | Held by | Lifetime | What it does |
|---|---|---|---|
| FastMCP session token | your Claude/ChatGPT client | **30 days** | proves *you* to Positrack |
| Hub **access** token | Positrack, server-side | short (**> 1 hour**, roughly a day) | what actually calls YouTrack on your behalf |
| Hub **refresh** token | Positrack, server-side | ~90 days | mints a new access token when the old one expires |

Your 30-day session is only real **if the refresh works**. If refreshing fails, the
session cannot outlive the short Hub access token — so you get bounced roughly once a
day, or dropped part-way through a working session. That is the complaint this file
exists for.

---

## The known root cause (fixed **and confirmed** 2026-08-19)

For a long time, **refresh had never once succeeded for anybody**. Hub's own
Account Security page showed *every* Positrack refresh token as `Last Used: Never`,
while YouTrack Mobile tokens on the same page recorded real usage.

Hub treats the service-id "scopes" (the YouTrack service UUID, and Hub's own
`0-0-0-0-0`) as **resource access**, not as scope claims — so the access token it
issues echoes back only `openid offline_access`. FastMCP's `exchange_refresh_token`
passed the refresh token's **stored** scopes — the full requested set — straight into
the upstream refresh as `scope=…`. Hub compared the two and refused every time:

```
invalid_grant: Requested scope does not match allowed by access token
```

**The fix** (`mcp/server.py`, `_HubOIDCProxy`) overrides
`_prepare_scopes_for_upstream_refresh` to return `[]`, so no `scope` is sent on
refresh. RFC 6749 §6 defines an omitted scope as *"identical to that originally
granted"* — exactly the intent. Narrowing `HUB_SCOPES` instead does **not** work:
`/authorize` genuinely needs those UUIDs or YouTrack REST rejects the token.

**Confirmed in production the same day.** A refresh token minted *after* the deploy
recorded a real `Last Used`, while every token minted before it still reads `Never`:

```
Positrack ChatGPT   created 2026-06-28 19:39   lastUsed Never     <- pre-fix  x6
Positrack ChatGPT   created 2026-08-19 11:26   lastUsed 13:02     <- POST-FIX
```

That is the first upstream refresh that has ever succeeded for this connector.

Full write-up: [`OAUTH_SESSION_LONGEVITY.md`](./OAUTH_SESSION_LONGEVITY.md) §9.
Test: `tests/test_oauth_verifier.py::test_upstream_refresh_does_not_resend_service_scopes`.

**So the first question is always: is the server you are talking to running that fix?**

---

## Part 1 — which path are you actually on?

Three ways to reach Positrack. They fail for *completely different* reasons, so
identify yours before troubleshooting anything.

| Path | How you set it up | Can it log you out? |
|---|---|---|
| **OAuth connector** — `/cmcp` | Added a custom connector, clicked **Connect**, logged in via browser. No token. | **Yes** — this file is about you |
| **Bearer connector** — `/mcp` | Added a connector with an `Authorization: Bearer perm-…` header | **No.** No OAuth, no refresh, no expiry |
| **Skill / CLI (stdio)** | Local skill with `$YT_TOKEN` or `/tmp/yt.env` | **No.** Same reason |

If you are on the bearer or skill path and still lose access, you are **not** hitting
this bug. Almost always your permanent token was **deleted or revoked** in YouTrack →
Account Security. Generate a new one and replace it.

Check the server is alive and OAuth is switched on (no auth needed):

```bash
curl -s https://positrack.up.railway.app/health
# expect: {"status":"ok","service":"positrack-mcp"}

curl -s https://positrack.up.railway.app/.well-known/oauth-protected-resource/cmcp
# expect JSON naming the resource + authorization_servers
```

> A **401 from `/cmcp` in a browser is correct**, not a fault. It is an MCP endpoint,
> not a web page; the 401 carries the `WWW-Authenticate` header that starts the OAuth
> handshake. You will never see a login page by visiting that URL. Don't chase it.

---

## Part 2 — refresh is failing

### 2a. Confirm it from Hub, precisely

The UI is the quickest look, but this REST call is exact and repeatable. It uses
**your own** YouTrack permanent token (avatar → Account Security → New token, scope
`YouTrack`). Keep the token in a file — **never paste it into a chat**:

```bash
printf 'YT_TOKEN=perm-XXXX\n' > /tmp/yt.env && chmod 600 /tmp/yt.env
set -a; . /tmp/yt.env; set +a

ME=$(curl -s -H "Authorization: Bearer $YT_TOKEN" \
  "https://support.posibolt.com/hub/api/rest/users/me?fields=id" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")

curl -s -H "Authorization: Bearer $YT_TOKEN" \
  --get "https://support.posibolt.com/hub/api/rest/users/$ME/refreshtokens" \
  --data-urlencode 'fields=lastAccessTime,creationTime,client(name)' \
  --data-urlencode '$top=100' \
| python3 -c "
import json,sys,datetime
d=json.load(sys.stdin); items=d.get('refreshtokens',d) if isinstance(d,dict) else d
f=lambda v: datetime.datetime.utcfromtimestamp(v/1000).strftime('%Y-%m-%d %H:%M') if v else 'Never'
for t in items:
    n=(t.get('client') or {}).get('name','?')
    print(f\"{n:22} created {f(t.get('creationTime')):17} lastUsed {f(t.get('lastAccessTime'))}\")
"
```

**Reading the result:**

- Any **Positrack** row with a real `lastUsed` → **refresh works.** Go to Part 3.
- All Positrack rows `Never`, but **other** clients (e.g. YouTrack Mobile) show real
  dates → refresh is broken *for Positrack specifically*. That is this bug. Continue.
- *Every* row including other clients says `Never` → nothing has refreshed at all;
  suspect Hub-side configuration and raise it with a Hub admin.

### 2b. Is the deployed server running the fix?

```bash
curl -s https://positrack.up.railway.app/health
```

Health only proves it is up, not which build. Ask whoever holds Railway for the
**deployed commit**, and confirm it includes the `_HubOIDCProxy` scope fix (merged
2026-08-19). If the server predates it, that alone explains everything — nothing else
to investigate.

### 2c. Evidence an admin must pull

These need Railway access. Ask for **exactly** this, so nobody has to guess:

```bash
railway logs | grep -E "OAuth storage|OAuth verify|Upstream token refresh"
```

What good looks like:

```
OAuth storage: persistent + encrypted at /data/oauth-clients (survives redeploys)
OAuth verify:  access tokens verified live against …/oauth2/userinfo (cache 300s…)
```

- `…is not a writable mount; falling back to FastMCP's ephemeral store` → **no volume**.
  Every redeploy logs everyone out. Mount a Railway volume at `/data`.
- `Upstream token refresh failed: …` → capture the **full** message, including the
  wrapped continuation line. See the trap below.

### ⚠️ The log-reading trap — read this before quoting any error

Grepping the logs suggests the error is `invalid_token (status=401)`. **It is not.**
FastMCP's logger wraps long records onto a second, indented line, and the only
`(status=%d)` format string in the package is
`fastmcp/server/auth/middleware.py:176 "Auth error returned: %s (status=%d)"` — that is
the **downstream** 401 returned to your client, i.e. the *consequence*.

The real upstream reason sits on the wrapped line and reads
`invalid_grant: Requested scope does not match allowed by access token`.

An earlier investigation drew the wrong conclusion from exactly this and spent
significant effort on the wrong theory. Always reassemble the wrapped lines before
believing an error string.

---

## Part 3 — if refresh is working but you still get logged out

Then something else is ending your session. In rough order of likelihood:

1. **Your Hub account changed** — password reset, disabled, or an admin revoked your
   sessions. Check Account Security → Credentials for a recent login you don't recognise.
2. **Someone rotated a server secret.** `FASTMCP_JWT_SIGNING_KEY` or
   `OAUTH_STORE_ENCRYPTION_KEY` invalidate every stored session when changed —
   deliberately. Everyone reconnects once. If a whole team was bounced at the same
   moment, this is the usual cause.
3. **The token store isn't persistent.** See the boot-log line in 2c. Without a volume,
   every redeploy wipes it.
4. **You revoked it yourself** — deleting a refresh token or "Revoke refresh token"
   under Credentials ends that session.

If none fit, gather the evidence in the template below and open an issue.

---

## Dead ends — already investigated and disproved

Do not spend time re-walking these; each was checked with a control.

| Theory | Verdict |
|---|---|
| The `fastmcp` 3.4.5 → 3.4.7 bump broke it | **No.** The only `proxy.py` change is a CIMD `private_key_jwt` audience fix on *downstream* auth; failing tokens predate it by two months |
| Hub rotates / single-uses refresh tokens, causing a race | **No.** Rotation leaves usage behind; every token read `Never`. FastMCP also holds a per-token refresh lock |
| The Hub client's redirect URI is misconfigured | **No.** The real callback is accepted and a bogus one rejected — verified with a control probe |
| Wrong client secret or auth method | **Not testable that way.** Hub validates the refresh token *before* the client, so a wrong-secret probe returns `invalid_grant` regardless. Hub accepts both `client_secret_basic` and `client_secret_post` |
| `OAUTH_STORE_ENCRYPTION_KEY` was never set | **No.** It is set; the boot log reads `persistent + encrypted` |

> The Hub admin UI sometimes renders the service's **Redirect URIs** and **Base URLs**
> as blank while also showing its own error banner. That is a **rendering artifact**.
> Do not "fix" those fields on the strength of it — verify with the authorize probe instead.

---

## Filing a good issue

Open one at <https://github.com/stratahqsa/positrack/issues> with:

```
Path:            OAuth /cmcp  |  bearer /mcp  |  skill (stdio)
Client:          Claude desktop / claude.ai / ChatGPT / Gemini CLI
Symptom:         logged out each morning  |  dropped mid-session  |  never connects
First seen:      YYYY-MM-DD
My refresh tokens (output of the Part 2a snippet, client + created + lastUsed only):
Server /health:
Deployed commit (if known):
Railway log lines (if you have access) — FULL message incl. wrapped continuation:
```

**Never paste a token, secret, or `Authorization` header into an issue or a chat.**
Token *values* are never needed to diagnose this — only the `Last Used` column is.

---

## Contributing a fix

The repo is open; the OAuth surface lives in `mcp/server.py`.

```bash
git clone https://github.com/stratahqsa/positrack && cd positrack
pip install -r mcp/requirements.txt pytest
python -m pytest tests/ -q          # expect all green
bash scripts/check_sync.sh          # expect "engine sync OK"
```

Two things worth knowing before you change anything here:

- **`fastmcp` and `py-key-value-aio` are deliberately excluded from Dependabot**
  (`.github/dependabot.yml`). CI runs pytest, the engine-sync gate and `py_compile` —
  **none of which exercise the OAuth handshake or a token refresh.** A bad bump merges
  green and deploys straight to production. Bump them by hand, read the upstream diff
  for `server/auth/oauth_proxy/`, and run the dual-transport smoke test in
  `mcp/README.md`.
- **A test that cannot fail is worse than no test.** A 100%-broken refresh survived
  months of green builds. If you add a test here, verify it goes **red** when you
  deliberately break the thing it guards, before you trust it.

**Known gaps — good first contributions:**
1. CI coverage for the OAuth handshake and a full refresh cycle.
2. A staging service against the same Hub, so refresh can be exercised without
   disturbing production users.
3. Surface the upstream refresh error on a single log line so the wrapping trap above
   stops catching people.
