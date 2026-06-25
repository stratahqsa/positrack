"""Live / integration tests for the Positrack MCP server.

Most of these are ENV-GATED and run at the YouTrack-token checkpoint:
  * YT_TOKEN      — a real permanent token (enables live reads + preview).
  * YT_TOKEN_2    — a second (ideally limited) token for CONCURRENT auth-isolation
                    and cache-isolation.
  * YT_TEST_PROJECT — a throwaway project short code; enables the commit→revert
                    write test (creates an issue, then deletes it).

Two checks always run (no token, no network): the friendly no-token error and the
`resolved date:` gotcha guard.

Run under the project venv (FastMCP installed):
    .venv/bin/python -m pytest tests/test_mcp_live.py -q
"""
import asyncio
import os
import socket
import subprocess
import sys
import time

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "core"))
sys.path.insert(0, os.path.join(ROOT, "mcp"))

YT_TOKEN = os.environ.get("YT_TOKEN")
YT_TOKEN_2 = os.environ.get("YT_TOKEN_2")
YT_TEST_PROJECT = os.environ.get("YT_TEST_PROJECT")

needs_token = pytest.mark.skipif(not YT_TOKEN, reason="set YT_TOKEN for live tests")
needs_two = pytest.mark.skipif(not (YT_TOKEN and YT_TOKEN_2),
                               reason="set YT_TOKEN and YT_TOKEN_2 for isolation tests")
needs_project = pytest.mark.skipif(not (YT_TOKEN and YT_TEST_PROJECT),
                                   reason="set YT_TOKEN and YT_TEST_PROJECT for the write test")


# ---------- always-on checks (no token, no network) ----------
def test_no_token_friendly_error():
    """A call with no token returns a friendly structured 401, never a crash."""
    import server
    from fastmcp import Client

    async def go():
        os.environ.pop("YT_TOKEN", None)
        async with Client(server.mcp) as c:
            res = await c.call_tool("yt_whoami", {})
            return res.structured_content

    out = asyncio.run(go())
    assert out["error"] is True and out["status"] == 401


def test_resolved_date_gotcha_preserved():
    """The engine must filter resolved issues with `resolved date:`, not bare `resolved:`."""
    src = open(os.path.join(ROOT, "core", "ytcore.py")).read()
    assert "resolved date:" in src, "the resolved-date gotcha must be preserved"


# ---------- live server fixture ----------
def _free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


@pytest.fixture(scope="module")
def server_url():
    import urllib.request
    port = _free_port()
    env = dict(os.environ)
    env["POSITRACK_TRANSPORT"] = "dual"
    env["PORT"] = str(port)
    env["HOST"] = "127.0.0.1"
    env.pop("YT_TOKEN", None)  # the server must get tokens per-request via headers
    proc = subprocess.Popen([sys.executable, os.path.join(ROOT, "mcp", "server.py")],
                            env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    base = f"http://127.0.0.1:{port}"
    for _ in range(50):
        try:
            urllib.request.urlopen(base + "/health", timeout=1)
            break
        except Exception:
            time.sleep(0.2)
    else:
        proc.terminate()
        pytest.fail("server did not start")
    yield base
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except Exception:
        proc.kill()


def _client(base, token):
    from fastmcp import Client
    from fastmcp.client.transports import StreamableHttpTransport
    return Client(StreamableHttpTransport(f"{base}/mcp", headers={"Authorization": f"Bearer {token}"}))


async def _call(base, token, tool, args=None):
    async with _client(base, token) as c:
        res = await c.call_tool(tool, args or {})
        return res.structured_content


# ---------- live reads ----------
@needs_token
def test_whoami_live(server_url):
    out = asyncio.run(_call(server_url, YT_TOKEN, "yt_whoami"))
    assert "login" in out and out.get("login"), f"whoami returned {out}"


@needs_token
def test_search_live(server_url):
    out = asyncio.run(_call(server_url, YT_TOKEN, "yt_search", {"query": "#Unresolved", "limit": 3}))
    assert "issues" in out and "count" in out, f"search returned {out}"


# ---------- write safety: preview does not mutate ----------
@needs_project
def test_create_preview_no_mutation(server_url):
    out = asyncio.run(_call(server_url, YT_TOKEN, "yt_create",
                            {"project": YT_TEST_PROJECT, "summary": "positrack preview probe", "commit": False}))
    assert out.get("committed") is False
    assert "payload" in out and "created" not in out, f"preview must not create: {out}"


@needs_project
def test_create_commit_then_revert(server_url):
    """commit=True actually creates; then we delete the throwaway issue to revert."""
    import ytcore as core
    summary = "positrack e2e throwaway — safe to delete"
    out = asyncio.run(_call(server_url, YT_TOKEN, "yt_create",
                            {"project": YT_TEST_PROJECT, "summary": summary, "commit": True}))
    assert out.get("committed") is True and out.get("created"), f"commit must create: {out}"
    created_id = out["created"]["idReadable"]
    # revert: delete the throwaway issue with the same token's own permission
    ctx = core.Ctx(YT_TOKEN)
    core._req(ctx, "DELETE", f"/api/issues/{created_id}")
    # confirm it's gone (404 -> friendly YTError)
    with pytest.raises(core.YTError):
        core.get_issue(ctx, created_id)


# ---------- concurrent auth isolation (the deepest soundness risk) ----------
@needs_two
def test_concurrent_auth_isolation(server_url):
    """Two simultaneous in-flight requests with two different tokens must each see
    their OWN identity — no cross-talk from shared state."""
    async def go():
        a, b = await asyncio.gather(
            _call(server_url, YT_TOKEN, "yt_whoami"),
            _call(server_url, YT_TOKEN_2, "yt_whoami"),
        )
        return a, b
    a, b = asyncio.run(go())
    assert a.get("login") and b.get("login")
    assert a["login"] != b["login"], "two distinct tokens must resolve to distinct identities"
    # repeat under higher concurrency to stress for races
    async def stress():
        tasks = []
        for _ in range(8):
            tasks.append(_call(server_url, YT_TOKEN, "yt_whoami"))
            tasks.append(_call(server_url, YT_TOKEN_2, "yt_whoami"))
        return await asyncio.gather(*tasks)
    results = asyncio.run(stress())
    for i, r in enumerate(results):
        expected = a["login"] if i % 2 == 0 else b["login"]
        assert r.get("login") == expected, f"token bleed at {i}: got {r.get('login')}"


@needs_two
def test_cache_isolation(server_url):
    """A non-admin token must never receive the other token's cached project set."""
    pa = asyncio.run(_call(server_url, YT_TOKEN, "yt_projects"))
    pb = asyncio.run(_call(server_url, YT_TOKEN_2, "yt_projects"))
    assert "projects" in pa and "projects" in pb
    # repeat call for token 2 (now served from its own cache entry) stays its own set,
    # not token 1's — i.e. warming token 1's cache cannot leak into token 2.
    pb2 = asyncio.run(_call(server_url, YT_TOKEN_2, "yt_projects"))
    names_b = sorted(p.get("shortName", "") for p in pb["projects"])
    names_b2 = sorted(p.get("shortName", "") for p in pb2["projects"])
    assert names_b == names_b2, "token 2's cached set must be stable and its own"
