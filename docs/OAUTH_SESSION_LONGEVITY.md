# Positrack connector: daily re-authentication — causes, fixes, and what must happen server-side

**Audience:** Product Owner / whoever holds Railway + Posibolt Hub admin
**Status:** code fix written and verified locally, **not deployed** — deploying it is
not sufficient on its own (see §4)
**Symptom:** users of the Positrack connector (Claude, ChatGPT) must sign in again
roughly every morning.

---

## 1. What is actually happening

The connector at `https://positrack.up.railway.app/cmcp` authenticates over OAuth
against Posibolt Hub. Positrack does not hold a password — it proxies Hub, and the
Hub token it receives is what calls YouTrack on the user's behalf.

Two **independent** defects each force a full browser re-login. Fixing one and not
the other leaves the symptom in place.

### Cause A — the session token inherited Hub's short expiry

The MCP framework (FastMCP 3.4.4) by default gives the connector a token whose
lifetime is copied from Hub's own access-token lifetime. If Hub's access token lives
about a day, the connector's session also dies about a day later, and the user is
sent through the whole sign-in flow again.

The framework supports decoupling the two: it can issue a long-lived session token
and quietly renew the Hub token behind it. That option was never set.

> Verbatim from the FastMCP 3.4.4 source documentation:
> *"By default (None) the FastMCP access token mirrors the upstream access token
> lifetime… The FastMCP JWT is a reference token — `load_access_token` re-validates
> the upstream token on every request and transparently refreshes it when expired."*

### Cause B — the token store is wiped on every restart

Positrack keeps each user's Hub tokens in a store on disk. That store currently
lands **inside the running container**, which has no durable filesystem. Every
redeploy, restart, or host move erases it, and **every connected user is logged out
at once** — no matter how long their token was supposed to last.

The code already tries to use a durable location (`/data/oauth-clients`), but when no
storage volume is mounted it silently falls back to the throwaway one. The previous
warning message understated this: it said only client *registrations* would be lost,
when in fact the **Hub access and refresh tokens** are in the same store.

### Ruled out

- **Signing-key instability.** When `FASTMCP_JWT_SIGNING_KEY` is unset the framework
  derives it deterministically from the Hub client secret, so it is stable across
  restarts. Not a contributor.
- **Hub not supporting renewal.** Hub advertises the `refresh_token` grant and the
  `offline_access` scope (`https://support.posibolt.com/hub/.well-known/openid-configuration`),
  and Positrack already requests both (`mcp/server.py:611`, `mcp/server.py:631`). The
  capability is there; see §5 for the one Hub-side thing still to confirm.

---

## 2. What has already been fixed in code

Changed files: `mcp/server.py`, `mcp/README.md`, `docs/INSTALL_CHATGPT.md`, `CHANGELOG.md`.

| Fix | Where | Effect |
|---|---|---|
| Session token no longer copies Hub's expiry; defaults to **30 days**, tunable via `OAUTH_ACCESS_TOKEN_TTL_SECONDS` | `mcp/server.py:634` | Addresses Cause A |
| Hub token is renewed 60s *before* it lapses instead of at the instant of expiry, so an in-flight request can't race it | `mcp/server.py:637` | Removes a sporadic "call failed, please reconnect" class of error |
| The no-volume warning now states that **user tokens**, not just registrations, are lost on restart | `mcp/server.py:553` | Makes Cause B visible in the boot log instead of silent |
| Stored tokens can be encrypted at rest with `OAUTH_STORE_ENCRYPTION_KEY` | `mcp/server.py:566` | Closes a side issue found during the work — see §3 |
| Bad/missing encryption key degrades to working-but-unencrypted rather than losing persistence | `mcp/server.py:576` | A key typo can't reintroduce the daily logout |

**Verification performed:** the pinned `fastmcp==3.4.4` was installed and the real
server code booted against Hub's live discovery document. The provider builds with a
30-day session lifetime and 60s renewal margin, all endpoints (`/mcp`, `/sse`,
`/health`, the OAuth routes) still mount, and all four storage paths behave correctly
(no volume → throwaway fallback; volume → persistent; volume + key → encrypted;
volume + bad key → persistent, unencrypted, warned).

**Not verified:** real-world session length after deployment. That cannot be tested
without the production Railway environment and a Hub login.

---

## 3. A security issue found along the way

This section applies **only if the volume in §5 step 2 is adopted.** Nothing below is
outstanding while the store stays ephemeral.

Persisting tokens to a volume, as the code intends, writes them **in plaintext**.
That is a downgrade from the framework's own default, which encrypts its throwaway
store. Anyone with access to the volume's contents or a snapshot of it would be
holding live Hub tokens that act with those users' YouTrack permissions.

Encryption at rest is now supported and is a **one-line environment variable**
(`OAUTH_STORE_ENCRYPTION_KEY`). It should be set at the same time the volume is
mounted, not after. This is not optional hygiene if the volume is going into
production.

---

## 4. Why this cannot be solved in code alone

Three reasons, none of which a code change can route around:

1. **The durable store is infrastructure, not code.** No code can make a container's
   filesystem survive a redeploy; that needs a **Railway volume mounted at `/data`**.
   Without one, sessions last until the next restart or redeploy instead of the full
   30 days, and everyone signs in again at that point. Whether that is acceptable is a
   product decision, not a technical blocker — see §5, step 2.
2. **Hub has the final say on lifetime.** The framework caps the session at Hub's own
   access-token expiry whenever Hub issues no refresh token — deliberately, so a long
   session can never outlive real access. If Hub is not handing Positrack a refresh
   token, the 30-day setting changes nothing and the fix must be applied **on the Hub
   service** instead (§5).
3. **Secrets and settings live in Railway, not the repository.** The encryption key
   and signing key are environment variables by design; committing them would be the
   bug. And the committed code has no effect until the service is redeployed.

There is also a diagnostic gap only production access closes: **we do not yet know
which of the two causes is the dominant one for the "every morning" pattern.** A
nightly platform restart (Cause B) and a ~24-hour Hub token (Cause A) produce an
identical user experience. The Railway boot log and deploy history resolve it in
minutes; from outside the deployment they are indistinguishable.

---

## 5. What needs to happen server-side

| # | Action | Owner | Notes |
|---|---|---|---|
| 1 | Review and merge the code change | Engineering | 4 files; behaviour is unchanged when the new env vars are unset, except for longer sessions |
| 2 | *(Optional)* Mount a Railway volume at `/data` | Railway admin | Service → Settings → Volumes. Buys full 30-day sessions across restarts; skipping it means everyone re-authenticates whenever the service redeploys. **Requested position: skip it** — a login after a restart is acceptable, so this is deferred, not required. Small persistent-disk cost if adopted later |
| 3 | Set `OAUTH_STORE_ENCRYPTION_KEY` to a Fernet key | Railway admin | **Only relevant if step 2 is adopted**, and then mandatory — see §3. Generate: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| 4 | Confirm `FASTMCP_JWT_SIGNING_KEY` is set and will not be rotated casually | Railway admin | Rotating it logs everyone out once |
| 5 | Redeploy, then read the boot log | Engineering | It now prints which storage mode is live: `persistent + encrypted at …` is the good line; any `not a writable mount` warning means step 2 did not take |
| 6 | Check the deploy/restart history for a nightly pattern | Railway admin | Confirms whether Cause B was the real driver |
| 7 | On the Hub "Positrack" service, check the **access-token time-to-live** and that **refresh tokens are issued** (`offline_access` granted) | Hub admin | If Hub issues no refresh token, raising this TTL is the *only* lever that works — no Positrack setting can exceed it |
| 8 | Decide the acceptable session length | Product Owner | Default proposed: 30 days. See §6 |

**Expected user impact of the rollout:** everyone signs in once more after the
deploy, then stays signed in. If a re-login is still required the next morning,
step 7 is the remaining cause.

---

## 6. Decision for the Product Owner: 30-day sessions

A 30-day session means a lost or compromised laptop keeps working access for longer
than a one-day session would. Two things bound that risk, and they are the reason
30 days is a defensible default rather than a shortcut:

- **Revocation stays immediate.** The session token is a reference, not a bearer of
  standing rights: every single call re-validates against Hub. Disabling a user in
  Hub kills their Positrack access on their next request, regardless of remaining
  session time.
- **Permissions are unchanged.** A user acts with their own YouTrack permissions and
  nothing more; a longer session grants no additional reach.

Shorter is a one-value change (`OAUTH_ACCESS_TOKEN_TTL_SECONDS`) if a tighter window
is preferred — e.g. `604800` for 7 days. Anything at or below Hub's own token
lifetime returns the daily-login behaviour, so that is the floor.

---

## 7. Interim workaround, available today

Individuals who need this fixed before the deploy can bypass OAuth entirely by
using the header-authenticated endpoint with a **permanent YouTrack token**:

```
claude mcp add --transport http positrack https://positrack.up.railway.app/mcp --header "Authorization: Bearer perm-..."
```

This is per-device, never expires, and does not touch the OAuth path. Trade-offs:
the token is stored in plaintext in the user's local Claude configuration, it carries
that user's full YouTrack permissions until manually revoked in YouTrack, and it must
be set up on each device. The claude.ai Positrack connector should be disconnected
afterwards to avoid two copies of the same toolset. This is a workaround for
individuals, **not** a substitute for §5 — most users will not do this, and ChatGPT
users cannot (that client cannot send custom headers, which is why the OAuth
endpoint exists at all).

---

## 8. References

- Connector setup as documented today: `docs/INSTALL_CLAUDE.md:6`, `docs/INSTALL_CHATGPT.md`
- OAuth proxy implementation: `mcp/server.py:534` (token store), `mcp/server.py:624` (provider)
- Auth model overview: `mcp/README.md` → "Session longevity"
- Hub OAuth capabilities: `https://support.posibolt.com/hub/.well-known/openid-configuration`
- Positrack's advertised OAuth metadata: `https://positrack.up.railway.app/.well-known/oauth-authorization-server`
