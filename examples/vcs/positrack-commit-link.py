#!/usr/bin/env python3
"""
positrack-commit-link.py — link a git commit to its YouTrack issue via Positrack.

Modes:
  --auto                 (for a Claude Code PostToolUse hook or a git post-commit hook)
                         Look at HEAD + the current branch, extract an issue id
                         (e.g. IS-123) from the branch name or commit message, and
                         post a comment on that issue with the short SHA, subject,
                         branch and repo. Idempotent (one comment per commit). Quiet
                         no-op when there's no id / no token / already linked.
  link ISSUE [SHA]       Comment a specific commit (default HEAD) onto a given issue.

Auth: the developer's OWN YouTrack token ($YT_TOKEN, or YT_TOKEN=... in /tmp/yt.env).
It only ever acts as that developer. Base URL: $YT_BASE or the engine default.

This is an EXAMPLE/reference (see docs/VCS_LINKING.md); adopt it per-team as you like.
"""
import os
import re
import subprocess
import sys

ISSUE_RE = re.compile(r"\b([A-Z][A-Z0-9]+-\d+)\b")


def _load_core():
    """Import the shared engine (core/ytcore.py) by walking up from this file."""
    d = os.path.dirname(os.path.abspath(__file__))
    for _ in range(6):
        cand = os.path.join(d, "core", "ytcore.py")
        if os.path.isfile(cand):
            sys.path.insert(0, os.path.join(d, "core"))
            import ytcore  # noqa: E402
            return ytcore
        parent = os.path.dirname(d)
        if parent == d:
            break
        d = parent
    sys.exit("positrack: could not locate core/ytcore.py (run from within the repo)")


def _git(*args):
    try:
        return subprocess.run(["git", *args], capture_output=True, text=True).stdout.strip()
    except Exception:
        return ""


def _token():
    t = os.environ.get("YT_TOKEN")
    if t:
        return t.strip()
    path = os.environ.get("YT_ENV", "/tmp/yt.env")
    if os.path.exists(path):
        for line in open(path):
            line = line.strip()
            if line.startswith("YT_TOKEN"):
                return line.split("=", 1)[1].strip()
            if line and "=" not in line and line.startswith("perm-"):
                return line
    return None


def _issue_from(*texts):
    for text in texts:
        m = ISSUE_RE.search(text or "")
        if m:
            return m.group(1)
    return None


def _comment_text(short, branch, subject, remote):
    head = f"Commit `{short}`" + (f" on `{branch}`" if branch and branch != "HEAD" else "")
    body = f"{head} — {subject}"
    if remote:
        body += f"\n{remote}"
    return body


def main():
    args = sys.argv[1:]
    auto = "--auto" in args or not args  # bare invocation (git post-commit) == auto
    core = _load_core()

    token = _token()
    if not token:
        if auto:
            return 0  # quiet no-op for hooks
        print("positrack: no YT_TOKEN (set $YT_TOKEN or YT_TOKEN=... in /tmp/yt.env)", file=sys.stderr)
        return 1
    ctx = core.Ctx(token, os.environ.get("YT_BASE") or core.DEFAULT_BASE)
    remote = _git("config", "--get", "remote.origin.url")

    # Manual: link ISSUE [SHA]
    if args and args[0] == "link":
        if len(args) < 2:
            print("usage: positrack-commit-link.py link ISSUE [SHA]", file=sys.stderr)
            return 2
        issue = args[1]
        sha = args[2] if len(args) > 2 else "HEAD"
        full = _git("rev-parse", sha)
        if not full:
            print(f"positrack: unknown revision {sha}", file=sys.stderr)
            return 1
        subject = _git("log", "-1", "--format=%s", full)
        try:
            core.comment(ctx, issue, _comment_text(full[:8], "", subject, remote), commit=True)
        except core.YTError as e:
            print(f"positrack: {e.friendly_message}", file=sys.stderr)
            return 1
        print(f"positrack: linked {full[:8]} -> {issue}")
        return 0

    # Auto: detect HEAD + branch + id
    full = _git("rev-parse", "HEAD")
    if not full:
        return 0
    branch = _git("rev-parse", "--abbrev-ref", "HEAD")
    subject = _git("log", "-1", "--format=%s")
    body = _git("log", "-1", "--format=%b")
    issue = _issue_from(branch, subject, body)
    if not issue:
        return 0  # nothing to link

    # Idempotency: never post the same commit twice.
    git_dir = _git("rev-parse", "--git-dir") or ".git"
    marker = os.path.join(git_dir, "positrack-linked")
    seen = set(open(marker).read().split()) if os.path.exists(marker) else set()
    if full in seen:
        return 0

    try:
        core.comment(ctx, issue, _comment_text(full[:8], branch, subject, remote), commit=True)
    except core.YTError as e:
        if auto:
            return 0  # stay quiet in hook mode
        print(f"positrack: {e.friendly_message}", file=sys.stderr)
        return 1

    with open(marker, "a") as f:
        f.write(full + "\n")
    print(f"positrack: linked {full[:8]} -> {issue}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
