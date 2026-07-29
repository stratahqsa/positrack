# Positrack connector: daily re-authentication — causes, fixes, and what must happen server-side

**Audience:** Product Owner / whoever holds Railway + Posibolt Hub admin
**Status:** **merged and deployed 2026-07-28** (PR #47). Cause A confirmed and fixed;
Cause B investigated and found not to apply — the volume was already mounted. One
security item remains open, see §3.
**Symptom:** users of the Positrack connector (Claude, ChatGPT) must sign in again
roughly every morning.

> **Read §1 with the update boxes.** This brief was written before anyone had access
> to the Railway boot log or Hub's admin pages. Both were checked on 2026-07-28 and
> two of its assumptions turned out to be wrong. The corrections are inline rather
> than silently edited away, because the original reasoning is what a future reader
> will otherwise repeat.

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

### Cause B — the token store is wiped on every restart — **DID NOT APPLY**

> **Correction (2026-07-28).** This was wrong. A Railway volume (`positrack-volume`)
> was **already mounted** at `/data`. The boot log after the deploy reads
> `OAuth storage: persistent at /data/oauth-clients`, and the deploy history shows
> redeploys 12 hours, 1 day and 3 days before the fix with no corresponding wave of
> re-authentications. The store was durable the whole time, so Cause B was never
> contributing to the daily logout. Cause A accounts for the symptom on its own.
>
> The reasoning below is retained because it is still an accurate description of what
> happens **if** the volume is ever removed, and because the plaintext-at-rest problem
> it uncovered is real and still open (§3).

Positrack keeps each user's Hub tokens in a store on disk. If that store lands
**inside the running container**, which has no durable filesystem, every redeploy,
restart, or host move erases it, and **every connected user is logged out at once** —
no matter how long their token was supposed to last.

The code targets a durable location (`/data/oauth-clients`) and silently falls back to
the throwaway one when no storage volume is mounted. The previous warning message
understated that fallback: it said only client *registrations* would be lost, when in
fact the **Hub access and refresh tokens** are in the same store.

### Ruled out

- **Signing-key instability.** When `FASTMCP_JWT_SIGNING_KEY` is unset the framework
  derives it deterministically from the Hub client secret, so it is stable across
  restarts. Not a contributor.
- **Hub not supporting renewal.** Hub advertises the `refresh_token` grant and the
  `offline_access` scope (`https://support.posibolt.com/hub/.well-known/openid-configuration`),
  and Positrack already requests both (`mcp/server.py:611`, `mcp/server.py:631`).

  **Confirmed on 2026-07-28** from Hub → Users → *Account Security* → *Refresh Tokens*:
  six live refresh tokens are recorded for client **Positrack ChatGPT**, requested
  28–29 Jun 2026 and expiring 26–27 Sep 2026 (a ~90-day life). Hub is issuing them.

  Their **`Last Used: Never`** column is the clearest single piece of evidence for
  Cause A: Positrack never once exercised the refresh path. The session token expired
  on Hub's schedule and the user was pushed through a fresh browser login instead of
  the server quietly renewing behind them — which is also why several were minted on
  the same day. This is what the fix in §2 changes.

  Because a refresh token exists, FastMCP's "cap the session at the upstream
  `expires_in`" safeguard does **not** engage, and the 30-day setting takes full
  effect. Hub's ~90-day refresh-token expiry is the real ceiling, comfortably above it.

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

**Deployed 2026-07-28.** Merged as `1b64d8b`; Railway auto-deployed the merge commit
and reported *Deployment successful*. Post-deploy checks: CI green on master (183
passed, 7 skipped), `/health` returns 200, and
`/.well-known/oauth-authorization-server` still advertises the `/authorize`, `/token`
and `/register` endpoints with all four scopes, so the OAuth surface survived the
change.

**Not verified:** real-world session length. That needs a connected user and a full
day to elapse — confirm with an affected user the morning after the deploy.

---

## 3. A security issue found along the way — **OPEN, live in production**

This was originally filed as conditional on adopting a volume. The volume turned out
to be **already mounted**, so the condition is met and this is a current exposure, not
a hypothetical one. It predates PR #47; the new boot-log warning is what surfaced it.

Persisting tokens to the volume writes them **in plaintext**. That is a downgrade from
the framework's own default, which encrypts even its throwaway store. Anyone with
access to the volume's contents or a snapshot of it is holding live Hub access **and
refresh** tokens that act with those users' YouTrack permissions.

The boot log states the current mode explicitly:

```
OAuth storage: persistent at /data/oauth-clients but UNENCRYPTED
(tokens in plaintext on the volume) — set OAUTH_STORE_ENCRYPTION_KEY to encrypt at rest.
```

The fix is a **one-line environment variable** (`OAUTH_STORE_ENCRYPTION_KEY`, §5 step
3). Note that setting it invalidates the existing plaintext entries, so everyone signs
in once more — cheapest to do while sessions are already resetting after a deploy
rather than as a separate disruption later.

---

## 4. What the code fix could and could not settle

Written before deployment, this section listed three things code alone could not
resolve. Two are now closed by inspection; one remains true in general.

1. **The durable store is infrastructure, not code.** *Closed — already satisfied.*
   No code can make a container's filesystem survive a redeploy; that needs a Railway
   volume mounted at `/data`. One was already mounted (`positrack-volume`), so the
   store has been durable all along. If it is ever detached, sessions revert to
   lasting only until the next restart.
2. **Hub has the final say on lifetime.** *Closed — Hub cooperates.* The framework
   caps the session at Hub's access-token expiry whenever Hub issues no refresh token,
   deliberately, so a long session can never outlive real access. Hub **does** issue
   refresh tokens to this client (§1, *Ruled out*), so the cap does not engage and the
   30-day setting stands.
3. **Secrets and settings live in Railway, not the repository.** *Still true, and the
   reason §3 is still open.* The encryption key and signing key are environment
   variables by design; committing them would be the bug. Committed code also has no
   effect until the service redeploys.

The diagnostic gap this section originally described — not knowing whether a nightly
restart (Cause B) or a ~24-hour Hub token (Cause A) drove the "every morning" pattern
— **is now resolved in favour of Cause A**, on two independent pieces of evidence: the
volume was mounted (so restarts were not clearing sessions), and Hub's refresh tokens
for this client show `Last Used: Never` (so the session was dying rather than
renewing).

---

## 5. What needs to happen server-side

| # | Action | Owner | Status |
|---|---|---|---|
| 1 | Review and merge the code change | Engineering | **Done** — PR #47 merged as `1b64d8b`, CI green, Railway auto-deployed successfully |
| 2 | Mount a Railway volume at `/data` | Railway admin | **Not needed — already mounted.** `positrack-volume` was in place before this work; the boot log confirms `persistent at /data/oauth-clients`. The earlier "requested position: skip it" was answering a question that was already settled |
| 3 | **Set `OAUTH_STORE_ENCRYPTION_KEY` to a Fernet key** | Railway admin | **OPEN — the only outstanding item.** Mandatory now that the volume is confirmed in use (§3); tokens are in plaintext on disk until it is set. Generate with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`, add it under Railway → Variables. Costs one extra sign-in for everyone |
| 4 | Confirm `FASTMCP_JWT_SIGNING_KEY` is set and will not be rotated casually | Railway admin | **Unconfirmed** — not inspected, to avoid reading production secrets. Rotating it logs everyone out once. Worth checking alongside step 3 |
| 5 | Redeploy, then read the boot log | Engineering | **Done** — boot line reads `persistent at /data/oauth-clients but UNENCRYPTED`, i.e. storage good, encryption pending step 3 |
| 6 | Check the deploy/restart history for a nightly pattern | Railway admin | **Done** — no nightly pattern; redeploys were ~daily-to-3-daily and tied to merges. Cause B excluded |
| 7 | On the Hub "Positrack" service, confirm **refresh tokens are issued** and check the **access-token TTL** | Hub admin | **Done** — refresh tokens confirmed issued (~90-day expiry), `Last Used: Never`. No Hub-side change required |
| 8 | Decide the acceptable session length | Product Owner | **Defaulted to 30 days** and now live. Revisit against §6 if a tighter window is wanted |

**Expected user impact of the rollout:** everyone signs in once more after the deploy,
then stays signed in for 30 days. If a re-login is still required the next morning,
the deploy did not take effect — re-read the boot log before looking further.

---

## 6. Decision for the Product Owner: 30-day sessions

A 30-day session means a lost or compromised laptop keeps working access for longer
than a one-day session would. Two things bound that risk, and they are the reason
30 days is a defensible default rather than a shortcut:

- **Revocation is bounded by Hub's own token lifetime, not by the 30 days.** The
  session token is a reference, not a bearer of standing rights — but the per-call
  check is a *local* signature-and-expiry validation of the Hub token against Hub's
  public keys (`JWTVerifier` over the JWKS endpoint), **not** a live "is this user
  still active?" call to Hub. So disabling a user in Hub does not cut them off on
  their very next request. It cuts them off when the Hub access token Positrack holds
  reaches expiry and the silent renewal is refused — i.e. **within one Hub
  access-token lifetime** (~24 hours if Hub's TTL is about a day). Lengthening the
  session to 30 days does **not** lengthen that window; it is set entirely by Hub.
  If a tighter revocation window is required, the practical lever is lowering Hub's
  own access-token TTL — which works directly against the longer session, so it is a
  genuine trade rather than a free win. (Switching to an introspection-based verifier
  that asks Hub on every call would be the cleaner answer, but Hub's discovery
  document publishes **no introspection endpoint**, so that route is not available
  without Hub-side work.)
- **Permissions are unchanged.** A user acts with their own YouTrack permissions and
  nothing more; a longer session grants no additional reach.

Shorter is a one-value change (`OAUTH_ACCESS_TOKEN_TTL_SECONDS`) if a tighter window
is preferred — e.g. `604800` for 7 days. Anything at or below Hub's own token
lifetime returns the daily-login behaviour, so that is the floor.

---

## 7. The permanent-token alternative

Not needed as a workaround now that the fix is deployed, but worth knowing it exists
and is a **separate authentication path** — this is what the *Permanent Tokens*
section of a user's Hub *Account Security* page lists, and it is easy to mistake for
the OAuth access token discussed everywhere else in this document. Individuals can
bypass OAuth entirely using the header-authenticated endpoint with a **permanent
YouTrack token**:

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
