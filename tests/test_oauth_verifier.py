"""Unit tests for the OAuth access-token verifier (`mcp/server.py`).

These cover the bug that made the connector drop mid-session: FastMCP was
verifying Hub's **id_token** on every call while deciding refreshes from the
**access token's** expiry, so once the id_token lapsed the session 401'd
forever with no refresh attempted. The fix verifies the access token live
against Hub's userinfo endpoint, putting verification and refresh on one clock.

No network: every test either sets HUB_USERINFO_URL or stubs httpx.
"""
import asyncio
import os
import sys

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "core"))
sys.path.insert(0, os.path.join(ROOT, "mcp"))

pytest.importorskip("fastmcp", reason="OAuth verifier needs FastMCP installed")
import server  # noqa: E402

USERINFO = "https://hub.example/hub/api/rest/oauth2/userinfo"
SCOPES = ["openid", "offline_access", "548fb89d-8f7b-4c60-b881-9d7d2acf72bf", "0-0-0-0-0"]

# Hub's real discovery document (support.posibolt.com, captured 2026-07-31), so the
# provider-wiring test needs no network.
HUB_DISCOVERY = {
    "issuer": "https://support.posibolt.com/hub",
    "authorization_endpoint": "https://support.posibolt.com/hub/api/rest/oauth2/auth",
    "token_endpoint": "https://support.posibolt.com/hub/api/rest/oauth2/token",
    "userinfo_endpoint": "https://support.posibolt.com/hub/api/rest/oauth2/userinfo",
    "jwks_uri": "https://support.posibolt.com/hub/api/rest/oauth2/keys",
    "scopes_supported": ["openid", "offline_access", "profile", "email", "groups"],
    "response_types_supported": ["code", "token", "id_token"],
    "grant_types_supported": ["authorization_code", "client_credentials", "password",
                              "refresh_token", "implicit"],
    "subject_types_supported": ["public"],
    "id_token_signing_alg_values_supported": ["RS256"],
    "token_endpoint_auth_methods_supported": ["client_secret_basic", "client_secret_post"],
    "claims_supported": ["sub", "name", "preferred_username", "email", "groups"],
    "service_documentation": "https://www.jetbrains.com/help/hub/Managing-Services.html",
    "request_uri_parameter_supported": False,
}


# ---------------------------------------------------------------- httpx stubs
class _FakeResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload if payload is not None else {}

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


class _FakeAsyncClient:
    """Stands in for httpx.AsyncClient; records calls and replays a script."""

    def __init__(self, script, calls):
        self._script = script
        self._calls = calls

    def __call__(self, *_args, **_kwargs):
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_exc):
        return False

    async def get(self, url, headers=None, **_kwargs):
        self._calls.append((url, (headers or {}).get("Authorization")))
        step = self._script.pop(0) if len(self._script) > 1 else self._script[0]
        if isinstance(step, Exception):
            raise step
        return step


@pytest.fixture
def stub_httpx(monkeypatch):
    """Install a scripted fake AsyncClient. Returns (install, calls)."""
    import httpx
    calls = []

    def install(*script):
        monkeypatch.setattr(httpx, "AsyncClient", _FakeAsyncClient(list(script), calls))
        return calls

    return install, calls


@pytest.fixture
def verifier_env(monkeypatch):
    """Point the verifier at a fixed userinfo URL and clear tuning overrides."""
    monkeypatch.setenv("HUB_USERINFO_URL", USERINFO)
    for name in ("OAUTH_VERIFY_VIA_USERINFO", "OAUTH_USERINFO_CACHE_SECONDS",
                 "OAUTH_USERINFO_GRACE_SECONDS", "OAUTH_USERINFO_CACHE_MAX_ENTRIES",
                 "OAUTH_USERINFO_TIMEOUT_SECONDS"):
        monkeypatch.delenv(name, raising=False)


def _make_verifier():
    v = server._make_hub_token_verifier("https://ignored/.well-known/openid-configuration",
                                        "client-abc", SCOPES)
    assert v is not None
    return v


# ------------------------------------------------------------------ _env_flag
def test_env_flag_defaults_and_falsey_values(monkeypatch):
    monkeypatch.delenv("SOME_FLAG", raising=False)
    assert server._env_flag("SOME_FLAG", True) is True
    assert server._env_flag("SOME_FLAG", False) is False
    for falsey in ("0", "false", "FALSE", "no", "off", " off "):
        monkeypatch.setenv("SOME_FLAG", falsey)
        assert server._env_flag("SOME_FLAG", True) is False
    for truthy in ("1", "true", "yes", "on"):
        monkeypatch.setenv("SOME_FLAG", truthy)
        assert server._env_flag("SOME_FLAG", False) is True
    # Blank must not read as False — that would silently disable the fix.
    monkeypatch.setenv("SOME_FLAG", "   ")
    assert server._env_flag("SOME_FLAG", True) is True


# -------------------------------------------------------- _discover_userinfo_url
def test_discover_prefers_explicit_override(monkeypatch):
    monkeypatch.setenv("HUB_USERINFO_URL", USERINFO)
    assert server._discover_userinfo_url("https://unused/config") == USERINFO


def test_discover_reads_endpoint_from_discovery(monkeypatch):
    import httpx
    monkeypatch.delenv("HUB_USERINFO_URL", raising=False)
    monkeypatch.setattr(httpx, "get", lambda *a, **k: _FakeResponse(200, HUB_DISCOVERY))
    assert server._discover_userinfo_url("https://hub/config") == HUB_DISCOVERY["userinfo_endpoint"]


def test_discover_returns_none_when_endpoint_absent(monkeypatch):
    """No userinfo_endpoint must NOT be guessed at: a wrong URL would 4xx every
    call and lock every user out. Returning None keeps the old id_token path."""
    import httpx
    monkeypatch.delenv("HUB_USERINFO_URL", raising=False)
    stripped = {k: v for k, v in HUB_DISCOVERY.items() if k != "userinfo_endpoint"}
    monkeypatch.setattr(httpx, "get", lambda *a, **k: _FakeResponse(200, stripped))
    assert server._discover_userinfo_url("https://hub/config") is None


def test_discover_returns_none_on_network_failure(monkeypatch):
    import httpx
    monkeypatch.delenv("HUB_USERINFO_URL", raising=False)

    def boom(*_a, **_k):
        raise RuntimeError("dns is down")

    monkeypatch.setattr(httpx, "get", boom)
    assert server._discover_userinfo_url("https://hub/config") is None


# ------------------------------------------------------ verifier construction
def test_verifier_disabled_by_env(monkeypatch, verifier_env):
    monkeypatch.setenv("OAUTH_VERIFY_VIA_USERINFO", "0")
    assert server._make_hub_token_verifier("https://hub/config", "cid", SCOPES) is None


def test_verifier_carries_full_scope_list(verifier_env):
    """OAuthProxy seeds `_default_scope_str` (what it asks Hub for) from
    token_verifier.required_scopes. Drop the YouTrack service UUID here and Hub
    mints a token YouTrack REST rejects with 403."""
    assert _make_verifier().required_scopes == SCOPES


# ------------------------------------------------------------- verify_token
def test_valid_token_returns_upstream_access_token(verifier_env, stub_httpx):
    install, _ = stub_httpx
    calls = install(_FakeResponse(200, {"sub": "u-1", "email": "a@b.c"}))
    verified = asyncio.run(_make_verifier().verify_token("hub-access-token"))

    assert verified is not None
    # _resolve_ctx forwards AccessToken.token to YouTrack, so it MUST be the Hub
    # access token that was verified — not the id_token, not a rewritten value.
    assert verified.token == "hub-access-token"
    assert verified.subject == "u-1"
    assert verified.scopes == SCOPES
    assert verified.claims["email"] == "a@b.c"
    assert calls == [(USERINFO, "Bearer hub-access-token")]


def test_result_is_cached_within_ttl(verifier_env, stub_httpx):
    install, _ = stub_httpx
    calls = install(_FakeResponse(200, {"sub": "u-1"}))
    v = _make_verifier()

    async def twice():
        return await v.verify_token("t"), await v.verify_token("t")

    first, second = asyncio.run(twice())
    assert first is not None and second is not None
    assert len(calls) == 1, "second call must be served from cache, not re-hit Hub"


def test_expired_ttl_revalidates(monkeypatch, verifier_env, stub_httpx):
    monkeypatch.setenv("OAUTH_USERINFO_CACHE_SECONDS", "1")
    install, _ = stub_httpx
    calls = install(_FakeResponse(200, {"sub": "u-1"}), _FakeResponse(200, {"sub": "u-1"}))
    v = _make_verifier()
    real_time = server.time.time
    monkeypatch.setattr(server.time, "time", lambda: real_time())

    async def go():
        await v.verify_token("t")
        monkeypatch.setattr(server.time, "time", lambda: real_time() + 5)
        return await v.verify_token("t")

    assert asyncio.run(go()) is not None
    assert len(calls) == 2, "a stale cache entry must be re-verified against Hub"


@pytest.mark.parametrize("status", [401, 403])
def test_rejected_token_returns_none(verifier_env, stub_httpx, status):
    """The one definitive rejection. Returning None is what lets FastMCP's
    transparent refresh run (needs_refresh is true at the same moment)."""
    install, _ = stub_httpx
    install(_FakeResponse(status, {}))
    assert asyncio.run(_make_verifier().verify_token("dead-token")) is None


def test_rejection_evicts_cache_so_refreshed_token_is_rechecked(verifier_env, stub_httpx):
    install, _ = stub_httpx
    calls = install(_FakeResponse(200, {"sub": "u-1"}), _FakeResponse(401, {}),
                    _FakeResponse(200, {"sub": "u-1"}))
    v = _make_verifier()

    async def go():
        ok = await v.verify_token("t")
        v._cache.clear()                       # force a live re-check
        dead = await v.verify_token("t")
        return ok, dead

    ok, dead = asyncio.run(go())
    assert ok is not None and dead is None
    assert v._cache == {}, "a 401 must not leave a positive entry behind"


def test_hub_outage_rides_out_on_recent_success(verifier_env, stub_httpx):
    """A Hub blip must not log everyone out — that is the bug, not the fix."""
    install, _ = stub_httpx
    install(_FakeResponse(200, {"sub": "u-1"}), RuntimeError("connection reset"))
    v = _make_verifier()

    async def go():
        first = await v.verify_token("t")
        v._cache["_stale"] = v._cache[list(v._cache)[0]]   # keep a copy
        # Age the entry past the TTL but well inside the grace window.
        key, (obj, _at) = list(v._cache.items())[0]
        v._cache[key] = (obj, server.time.time() - 600)
        return first, await v.verify_token("t")

    first, during_outage = asyncio.run(go())
    assert first is not None
    assert during_outage is not None
    assert during_outage.token == "t"


def test_outage_without_recent_success_rejects(verifier_env, stub_httpx):
    """Fail closed: never hand out access we could not verify at all."""
    install, _ = stub_httpx
    install(RuntimeError("connection reset"))
    assert asyncio.run(_make_verifier().verify_token("t")) is None


def test_grace_window_expiry_rejects(monkeypatch, verifier_env, stub_httpx):
    monkeypatch.setenv("OAUTH_USERINFO_GRACE_SECONDS", "60")
    install, _ = stub_httpx
    install(_FakeResponse(200, {"sub": "u-1"}), RuntimeError("still down"))
    v = _make_verifier()

    async def go():
        await v.verify_token("t")
        key, (obj, _at) = list(v._cache.items())[0]
        v._cache[key] = (obj, server.time.time() - 3600)   # far outside grace
        return await v.verify_token("t")

    assert asyncio.run(go()) is None


def test_endpoint_error_is_not_a_user_rejection(verifier_env, stub_httpx):
    """404/5xx describe the endpoint, not the user, so an established session
    survives on cache rather than being kicked."""
    install, _ = stub_httpx
    install(_FakeResponse(200, {"sub": "u-1"}), _FakeResponse(503, {}))
    v = _make_verifier()

    async def go():
        await v.verify_token("t")
        key, (obj, _at) = list(v._cache.items())[0]
        v._cache[key] = (obj, server.time.time() - 600)    # stale, inside grace
        return await v.verify_token("t")

    assert asyncio.run(go()) is not None


def test_endpoint_error_without_cache_rejects(verifier_env, stub_httpx):
    install, _ = stub_httpx
    install(_FakeResponse(404, {}))
    assert asyncio.run(_make_verifier().verify_token("t")) is None


def test_non_json_userinfo_still_verifies(verifier_env, stub_httpx):
    """A 200 with an unparseable body is still Hub saying the token is good."""
    class _Bad(_FakeResponse):
        def json(self):
            raise ValueError("not json")

    install, _ = stub_httpx
    install(_Bad(200))
    verified = asyncio.run(_make_verifier().verify_token("t"))
    assert verified is not None
    assert verified.token == "t"
    assert verified.subject is None


def test_cache_is_bounded(monkeypatch, verifier_env, stub_httpx):
    monkeypatch.setenv("OAUTH_USERINFO_CACHE_MAX_ENTRIES", "3")
    install, _ = stub_httpx
    install(_FakeResponse(200, {"sub": "u"}))
    v = _make_verifier()

    async def go():
        for i in range(10):
            await v.verify_token(f"token-{i}")

    asyncio.run(go())
    assert len(v._cache) <= 3, "unbounded cache would leak one entry per token forever"


def test_distinct_tokens_are_not_confused(verifier_env, stub_httpx):
    install, _ = stub_httpx
    install(_FakeResponse(200, {"sub": "alice"}), _FakeResponse(200, {"sub": "bob"}))
    v = _make_verifier()

    async def go():
        return await v.verify_token("alice-token"), await v.verify_token("bob-token")

    alice, bob = asyncio.run(go())
    assert alice.subject == "alice" and bob.subject == "bob"
    assert alice.token == "alice-token" and bob.token == "bob-token"


# ------------------------------------------------------------ provider wiring
@pytest.fixture
def oauth_env(monkeypatch):
    monkeypatch.setenv("HUB_CLIENT_ID", "positrack-chatgpt")
    monkeypatch.setenv("HUB_CLIENT_SECRET", "shhh")
    monkeypatch.setenv("OAUTH_PUBLIC_URL", "https://positrack.example")
    monkeypatch.setenv("HUB_SCOPES", " ".join(SCOPES))
    monkeypatch.setenv("HUB_USERINFO_URL", USERINFO)
    # Keep the OAuth store out of the way — /data is not mounted in CI anyway.
    monkeypatch.setenv("OAUTH_CLIENT_STORE_DIR", "/nonexistent/oauth-clients")
    for name in ("OAUTH_VERIFY_VIA_USERINFO", "FASTMCP_JWT_SIGNING_KEY"):
        monkeypatch.delenv(name, raising=False)


def _stub_discovery(monkeypatch):
    """Feed OIDCProxy Hub's real discovery document without touching the network."""
    from fastmcp.server.auth.oidc_proxy import OIDCConfiguration
    monkeypatch.setattr(
        OIDCConfiguration, "get_oidc_configuration",
        classmethod(lambda cls, config_url, **kw: cls.model_validate(dict(HUB_DISCOVERY))))


def test_provider_uses_userinfo_verifier_and_keeps_upstream_scopes(monkeypatch, oauth_env):
    """The regression that would break YouTrack access: `_default_scope_str` is what
    Positrack asks Hub for, and OAuthProxy seeds it from the verifier's
    required_scopes. It must still carry the YouTrack service UUID."""
    _stub_discovery(monkeypatch)
    provider = server._build_oauth_provider()

    assert provider is not None
    assert provider._verify_id_token is False, "id_token verification is the bug"
    assert provider._default_scope_str == " ".join(SCOPES)
    # Downstream gate stays relaxed, or every /cmcp call 403s insufficient_scope.
    assert provider.required_scopes == []
    assert type(provider._token_validator).__name__ == "HubUserinfoVerifier"


def test_provider_falls_back_to_id_token_when_userinfo_unavailable(monkeypatch, oauth_env):
    """Kill switch / no userinfo endpoint: behave exactly as before the fix,
    including the scope restoration that path depends on."""
    monkeypatch.setenv("OAUTH_VERIFY_VIA_USERINFO", "0")
    _stub_discovery(monkeypatch)
    provider = server._build_oauth_provider()

    assert provider is not None
    assert provider._verify_id_token is True
    assert provider._default_scope_str == " ".join(SCOPES)
    assert provider.required_scopes == []


def test_no_oauth_config_means_no_provider(monkeypatch):
    for name in ("HUB_CLIENT_ID", "HUB_CLIENT_SECRET", "OAUTH_PUBLIC_URL"):
        monkeypatch.delenv(name, raising=False)
    assert server._build_oauth_provider() is None
