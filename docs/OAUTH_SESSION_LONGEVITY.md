# Positrack connector: daily re-authentication — causes, fixes, and what must happen server-side

**Audience:** Product Owner / whoever holds Railway + Posibolt Hub admin
**Status:** Causes A, B and C are all **closed and verified in production**
(boot log checked 2026-08-19, see §9). The §3 security item is **closed** —
`OAUTH_STORE_ENCRYPTION_KEY` is set and the store is encrypted at rest.
**A new failure, Cause D, is OPEN and live: Hub is rejecting upstream refresh
tokens and users are dropping mid-session — see §9.**
**Symptom:** originally, users had to sign in again roughly every morning. After the
2026-07-28 deploy the symptom changed rather than disappeared: sessions now drop
**part-way through a working session**, with earlier calls in the same session having
already succeeded (§8).

> **Read §1 with the update boxes.** This brief was written before anyone had access
> to the Railway boot log or Hub's admin pages. Both were checked on 2026-07-28 and
> two of its assumptions turned out to be wrong. The corrections are inline rather
> than silently edited away, because the original reasoning is what a future reader
> will otherwise repeat.
>
> **§8 is the current work.** Causes A and B are history; if you are here because the
> connector just disconnected, start at §8.

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
> it uncovered was real — it has since been fixed (§3, closed 2026-08-19).

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
  and Positrack already requests both (`mcp/server.py:795`, `mcp/server.py:834`).

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
| Session token no longer copies Hub's expiry; defaults to **30 days**, tunable via `OAUTH_ACCESS_TOKEN_TTL_SECONDS` | `mcp/server.py:833` | Addresses Cause A |
| Hub token is renewed 60s *before* it lapses instead of at the instant of expiry, so an in-flight request can't race it | `mcp/server.py:836` | Removes a sporadic "call failed, please reconnect" class of error |
| The no-volume warning now states that **user tokens**, not just registrations, are lost on restart | `mcp/server.py:575` | Makes Cause B visible in the boot log instead of silent |
| Stored tokens can be encrypted at rest with `OAUTH_STORE_ENCRYPTION_KEY` | `mcp/server.py:588` | Closes a side issue found during the work — see §3 (key now set; closed 2026-08-19) |
| Bad/missing encryption key degrades to working-but-unencrypted rather than losing persistence | `mcp/server.py:599` | A key typo can't reintroduce the daily logout |

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

## 3. A security issue found along the way — **CLOSED 2026-08-19**

This was originally filed as conditional on adopting a volume. The volume turned out
to be **already mounted**, so the condition is met and this is a current exposure, not
a hypothetical one. It predates PR #47; the new boot-log warning is what surfaced it.

Persisting tokens to the volume writes them **in plaintext**. That is a downgrade from
the framework's own default, which encrypts even its throwaway store. Anyone with
access to the volume's contents or a snapshot of it is holding live Hub access **and
refresh** tokens that act with those users' YouTrack permissions.

The boot log states the current mode explicitly. It **used** to read:

```
OAuth storage: persistent at /data/oauth-clients but UNENCRYPTED
(tokens in plaintext on the volume) — set OAUTH_STORE_ENCRYPTION_KEY to encrypt at rest.
```

**Resolved.** `OAUTH_STORE_ENCRYPTION_KEY` was subsequently set on the Railway
service, and the boot log verified on 2026-08-19 now reads:

```
OAuth storage: persistent + encrypted at /data/oauth-clients (survives redeploys)
```

The key is valid — the code falls back to plaintext with a warning on a malformed
Fernet key, and no such warning is present. **Do not set or rotate this variable
again**: rotating it invalidates every stored session and forces all ~50 users to
re-authenticate for no benefit.

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
3. **Secrets and settings live in Railway, not the repository.** *Still true; this is
   why §3 could only be closed by a Railway change, not a merge.* The encryption key
   and signing key are environment
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
| 3 | **Set `OAUTH_STORE_ENCRYPTION_KEY` to a Fernet key** | Railway admin | **DONE** — verified set 2026-08-19; boot log reads `persistent + encrypted at /data/oauth-clients`. **Do not set or rotate it again** — that invalidates every stored session and costs all ~50 users a sign-in for no benefit |
| 4 | Confirm `FASTMCP_JWT_SIGNING_KEY` is set and will not be rotated casually | Railway admin | **DONE** — confirmed present on 2026-08-19 by listing Railway variable *names* only (no values read). Still must not be rotated casually: it logs everyone out once |
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

> **Correction (2026-07-31) — the revocation bullet below is now out of date, in the
> safe direction.** The Cause C fix (§8) replaced the local JWKS check with a live
> call to Hub's **userinfo** endpoint on every request, cached for
> `OAUTH_USERINFO_CACHE_SECONDS` (default 5 minutes). So revocation now lands within
> **that** window — minutes — instead of within one Hub access-token lifetime. The
> "no introspection endpoint" remark stands, but it turned out not to matter: userinfo
> answers the same question and Hub does publish it. The bullet is kept because it
> still describes the behaviour whenever `OAUTH_VERIFY_VIA_USERINFO=0`, and because it
> records the reasoning that made 30 days defensible in the first place.

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

## 8. Cause C — the connector still dropped mid-session after the fix (2026-07-31)

**Status:** **DEPLOYED AND VERIFIED.** Merged as `b9af2ae` (PR #55, 2026-08-06) and
live in production — the boot log on 2026-08-19 confirms the access-token path is
active. The line below said "not yet deployed" for two weeks after it shipped; that
was stale, not accurate.
Unlike Causes A and B this one is entirely in our code — no Railway or Hub change is
required.

### What was reported

Three days after the 2026-07-28 deploy, the connector was still disconnecting — but
with a different signature from the original "every morning" pattern:

- Tool calls returned *"The user's connection to this connector was invalidated. The
  user needs to reconnect it."*
- The failure happened **part-way through a session, after earlier YouTrack calls in
  that same session had already succeeded** — so it was not a session-start problem.
- Other connectors (Zoho Desk/Projects/Mail) kept working, so it was specific to
  Positrack rather than a client-wide fault.
- Reconnecting fixed it instantly, and it had happened at least twice.

### Root cause: verification and refresh were reading two different clocks

Hub's access tokens are opaque, not JWTs, so they cannot be checked by signature. The
server worked around that with `verify_id_token=True`, which tells FastMCP to validate
the **id_token** on every call instead. But FastMCP decides *whether to refresh* from
the **access token's** expiry. In `OAuthProxy.load_access_token` (fastmcp 3.4.4):

```python
validated = await self._token_validator.verify_token(verification_token)   # the id_token
needs_refresh = upstream_token_set.refresh_token and (
    upstream_token_set.expires_at <= time.time() + self._token_expiry_threshold_seconds
)                                                                          # the ACCESS token
should_refresh = needs_refresh and (not validated or ...)
```

Those are two different expiry clocks on two different tokens. Once the id_token's own
`exp` passed while the access token still looked fresh, `validated` was false but
`needs_refresh` was false too — so **no refresh was attempted and the call returned
401**, which the client surfaces as "reconnect". It did not recover on its own.

It is worse when Hub omits `id_token` from its refresh response, as many IdPs do.
`_try_transparent_refresh` merges the refresh response over `raw_token_data`, so the
stored id_token is only replaced if a new one comes back. If it never does, the
original id_token is the one verified forever, and the session cannot outlive it no
matter how many times the access token is renewed.

Either way **the real ceiling on a session was Hub's id_token lifetime** — which is
why the 30-day session token from Cause A did not extend sessions as expected. Cause A
was still real and still worth fixing; it was simply masking this. Before the fix the
session died on Hub's schedule anyway, so the id_token trap never got the chance to
show itself. Raising the session to 30 days made it the dominant failure, and changed
the symptom from "every morning" to "mid-session".

### The fix

Verify the **access token** — the same token the tools forward to YouTrack and the same
token FastMCP refreshes — live against Hub's OIDC **userinfo** endpoint, via a custom
`token_verifier` (`_make_hub_token_verifier` in `mcp/server.py`), with
`verify_id_token` turned off. Verification and refresh then read one clock: when the
access token expires, userinfo answers 401 and `needs_refresh` is true at the same
moment, so the transparent refresh runs exactly as designed.

Hub publishes **no** `introspection_endpoint`, so userinfo is the available live check.
It does publish `userinfo_endpoint`
(`https://support.posibolt.com/hub/api/rest/oauth2/userinfo`).

Because a network call per MCP call would be wasteful, successful verifications are
cached for `OAUTH_USERINFO_CACHE_SECONDS`. Two deliberate properties of that cache:

- **The TTL is the revocation window.** This is a genuine security *improvement* over
  the local JWKS check described in §6: a user disabled in Hub now stops working within
  ~5 minutes instead of within a whole Hub access-token lifetime.
- **A Hub outage must not log everyone out.** Only a `401`/`403` from Hub counts as a
  rejection. A timeout, connection error, `404` or `5xx` is treated as inconclusive,
  and an already-verified session keeps working on its cached result for up to
  `OAUTH_USERINFO_GRACE_SECONDS` (1 hour). With no recent verification to fall back on
  it still fails closed.

| Env | Default | What it does |
|---|---|---|
| `OAUTH_VERIFY_VIA_USERINFO` | `1` (on) | Kill switch. `0` reverts to id_token verification — i.e. back to this bug |
| `OAUTH_USERINFO_CACHE_SECONDS` | `300` | How long a successful verification is reused. **Also the revocation window** |
| `OAUTH_USERINFO_GRACE_SECONDS` | `3600` | How long an established session survives Hub being unreachable |
| `OAUTH_USERINFO_TIMEOUT_SECONDS` | `10` | Per-request timeout when calling userinfo |
| `OAUTH_USERINFO_CACHE_MAX_ENTRIES` | `2048` | Bound on the cache |
| `HUB_USERINFO_URL` | *(discovered)* | Override, if Hub's discovery document is ever wrong |

If Hub's discovery document advertises no `userinfo_endpoint`, the server logs a
warning and keeps the old id_token path rather than **guessing** a URL — a wrong URL
would answer every verification with a 4xx and lock every user out.

### Verification performed

- 24 unit tests (`tests/test_oauth_verifier.py`) covering the valid/rejected/outage/
  endpoint-error paths, cache TTL and bounding, and the two provider wirings.
- The real server booted against Hub's **live** discovery document: the provider comes
  up with `HubUserinfoVerifier`, `verify_id_token=False`, the 30-day session lifetime
  and 60s refresh margin intact, all endpoints mounted, and — the regression that
  would have broken YouTrack access — the upstream scope string still carrying the
  YouTrack service UUID.
- A live probe confirmed Hub's userinfo endpoint answers **401** to a bogus bearer
  token, which is the rejection signal the verifier depends on.

One wiring trap worth recording, caught by the tests rather than in production:
OIDCProxy **refuses** `required_scopes` when a custom `token_verifier` is supplied and
reads the scopes off the verifier instead. Since those scopes are what Positrack
requests from Hub (`_default_scope_str`), the verifier has to carry the full
`HUB_SCOPES` list or Hub mints a token YouTrack REST rejects with 403.

**Not verified:** real-world session length after deploy. That needs a connected user
and enough elapsed time to pass the point where sessions previously dropped.

### What needs to happen

| # | Action | Owner |
|---|---|---|
| 1 | Review and merge | Engineering |
| 2 | Redeploy and check the boot log for `OAuth verify: access tokens verified live against …` | Engineering |
| 3 | Confirm with an affected user that a session now survives past the point it used to drop | Product Owner |

Everyone signs in once more after this deploy, then sessions should hold. Note this is
independent of the `OAUTH_STORE_ENCRYPTION_KEY` item in §3, which has since been
closed — that key is now set, and **must not be rotated** casually, as doing so costs
every user a fresh sign-in.

### Also checked

FastMCP **3.4.5** (open dependabot PR #54) changes **nothing** in `oauth_proxy/proxy.py`
or `oidc_proxy.py` — the two files are byte-identical to 3.4.4. Upgrading is not a fix
for this, and this fix does not depend on it.

---

## 9. Cause D — Hub rejects the upstream refresh token (2026-08-19) — **OPEN**

**Status:** live in production, root cause **not yet confirmed**. One plausible
explanation was investigated and **disproved** (below), so this is genuinely open —
do not act on the disproved theory.

### What the Railway log shows

Read from the running service on 2026-08-19 (timestamps UTC):

```
05:27–05:40Z   POST /cmcp -> 200 OK  x25          sessions working normally
08:04:56Z      ERROR Upstream token refresh failed: invalid_token (status=401)
                                                              proxy.py:1489
08:05–08:27Z   POST /cmcp -> 401 x11,  POST /token -> 401
```

Hub is refusing the **refresh token** Positrack presents on the user's behalf. This
is a different mechanism from Cause C: there, no refresh was *attempted*; here one is
attempted and the upstream rejects it. The user-visible symptom is the same
("reconnect this connector"), which is why it is easy to mistake for a Cause C
regression.

### Disproved: the fastmcp 3.4.5 -> 3.4.7 bump

The running deploy is `fa0816f` — Dependabot PR #76, merged and auto-deployed
2026-08-18 11:16Z. The first 401 follows 22 minutes later, and `mcp/README.md`
explicitly warns this dependency is version-sensitive. Rollback looked obvious.

It does not hold up. Diffing the two wheels (`fastmcp` is a metapackage; the code is
in `fastmcp-slim`) shows only three changed files, and the **entire** change to
`server/auth/oauth_proxy/proxy.py` is:

```python
- token_endpoint_url = f"{self.base_url}/token"      # -> https://…app//token
+ token_endpoint_url = self.token_endpoint_url       # -> https://…app/token
```

That is a **bug fix** for the CIMD `private_key_jwt` audience — it corrects a
double-slash in the token endpoint URL. It governs how a **downstream** client
(claude.ai connects via CIMD; the AS metadata advertises
`client_id_metadata_document_supported: true`) authenticates *to Positrack*. It has
no bearing on how Positrack authenticates *to Hub*, which is the leg that is failing.

**Rolling back to 3.4.5 would reintroduce the double-slash bug and most likely not
fix this.** The timing correlation is real but appears to be coincidence — a redeploy
restarts the container, and any refresh due around then surfaces at once.

### Leading hypothesis (unconfirmed)

Hub may issue **single-use / rotating** refresh tokens. If two tool calls refresh
concurrently, one rotation wins and invalidates the other's token, yielding exactly
`invalid_token`. With ~50 users and MCP clients that fire tool calls in parallel, such
a race is likely. §5 step 7 recorded Hub's refresh tokens as ~90-day with
`Last Used: Never` on 2026-07-28, so plain expiry does not explain an 2026-08-19
failure.

### Ruled out: Hub-side redirect-URI / client misconfiguration (2026-08-19)

The Hub admin UI for the `positrack-chatgpt` service renders its **Redirect URIs**
and **Base URLs** fields as empty. **This is a rendering artifact, not the
configuration** — the same page also renders Hub's "Oh-oh... Something went seriously
wrong" banner and an unsupported-browser warning, so its field values cannot be
trusted. Do not "fix" those fields on the strength of what the UI shows.

Verified instead by probing Hub's authorize endpoint directly, with a control
(`client_id` is the service id `f0ffcb02-…`, which is not a secret):

```
GET /hub/api/rest/oauth2/auth?...&redirect_uri=https://positrack.up.railway.app/auth/callback
  -> 303 Location: /hub/auth/login…            ACCEPTED

GET /hub/api/rest/oauth2/auth?...&redirect_uri=https://example.invalid/nope
  -> 303 Location: /hub/auth/oauth/error…      REJECTED
```

Hub accepts the real callback and rejects a bogus one, so the redirect URI is
correctly registered and the client is intact. Cause D is **not** a Hub client
misconfiguration. This probe is safe to repeat — it is read-only and stops at Hub's
login page.

### What would settle it

| # | Action | Owner |
|---|---|---|
| 1 | On the Hub "Positrack" service, check whether refresh tokens are **single-use / rotating**, and whether the token list shows mass invalidation | Hub admin |
| 2 | Stand up a **staging** Railway service against the same Hub, so refresh failures can be reproduced without disturbing the 50 production users | Engineering |
| 3 | Extend CI to exercise the OAuth handshake + a refresh cycle — today it runs only pytest, the sync gate and `py_compile`, so nothing in this area is covered | Engineering |

Railway's log window only reaches back to the last container boot, so evidence from
before 2026-08-18 11:17Z is no longer available. Capture logs promptly on the next
occurrence.

### Guard added as a result

Dependabot no longer bumps `fastmcp` or `py-key-value-aio`
(`.github/dependabot.yml`). CI cannot catch a regression in either, so an automatic
bump merges green under branch protection and Railway deploys it straight to
production — which is how #76 reached users unreviewed. Bump both by hand, after
reading the upstream diff for `server/auth/oauth_proxy/` and running the
dual-transport smoke test in `mcp/README.md`.

---

## 10. References

- Connector setup as documented today: `docs/INSTALL_CLAUDE.md:6`, `docs/INSTALL_CHATGPT.md`
- OAuth proxy implementation: `mcp/server.py:556` (token store), `mcp/server.py:644`
  (access-token verifier, Cause C), `mcp/server.py:766` (provider)
- Verifier tests: `tests/test_oauth_verifier.py`
- Auth model overview: `mcp/README.md` → "Session longevity"
- The upstream refresh/verify logic this all hinges on: `fastmcp/server/auth/oauth_proxy/proxy.py`
  → `OAuthProxy.load_access_token` and `_try_transparent_refresh` (fastmcp 3.4.4)
- Hub OAuth capabilities: `https://support.posibolt.com/hub/.well-known/openid-configuration`
- Positrack's advertised OAuth metadata: `https://positrack.up.railway.app/.well-known/oauth-authorization-server`
