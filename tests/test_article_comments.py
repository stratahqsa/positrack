import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "core"))
import ytcore as y


def test_is_article_id():
    assert y.is_article_id("PXB-A-229")
    assert not y.is_article_id("PXB1-3205")
    assert not y.is_article_id("SUP-12")


def test_comment_routes_by_id_kind(monkeypatch):
    calls = []
    monkeypatch.setattr(y, "POST", lambda ctx, path, payload: calls.append(path) or {})
    y.comment(None, "PXB-A-229", "hi", commit=True)
    y.comment(None, "SUP-12", "hi", commit=True)
    assert calls[0].startswith("/api/articles/PXB-A-229/comments")
    assert calls[1].startswith("/api/issues/SUP-12/comments")


def test_article_includes_comments(monkeypatch):
    seen = []
    def fake_get(ctx, path):
        seen.append(path)
        return [{"text": "c"}] if "/comments" in path else {"idReadable": "PXB-A-229"}
    monkeypatch.setattr(y, "GET", fake_get)
    r = y.article(None, "PXB-A-229", comments_limit=500)
    assert r["comments"] == [{"text": "c"}]
    assert seen[1].endswith("$top=100")
