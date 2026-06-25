"""CLI parity harness — proves the refactored cli/yt.py reproduces the original
engine's behaviour byte-for-byte (stdout, stderr, AND exit code).

Two tiers:

  * OFFLINE cases (run here, no token): commands that fail/print BEFORE any
    network call — `profile`, `nothing to update`, `briefing`/`sprint`/`load`
    missing-arg, `file not found`, and `no token`. Golden snapshots of the
    ORIGINAL engine live in tests/golden/ and are committed; this test runs the
    refactored CLI with identical env and asserts an exact match.

  * LIVE cases (run at the token checkpoint via `live_parity_report`): happy-path
    reads + network error paths (bad --field, field-not-in-schema, project not
    found). Because live data shifts, these are captured from the original and
    the refactored CLI BACK-TO-BACK and diffed, not stored as committed golden.

Regenerate offline golden from the original engine:
    python3 tests/test_cli_parity.py capture /path/to/original/yt.py
"""
import os
import subprocess
import sys

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLI = os.path.join(ROOT, "cli", "yt.py")
GOLDEN = os.path.join(ROOT, "tests", "golden")

# Absent paths so neither engine reads a real profile / token file / cache.
_NOPROFILE = "/tmp/positrack_test_noprofile.json"
_NOENV = "/tmp/positrack_test_noenv.env"
_PCACHE = "/tmp/positrack_test_pcache.json"
_ABSENT_FILE = "/tmp/positrack_definitely_absent_file.bin"

# Each case: name, argv, and whether a (dummy) token is present. Offline cases
# deliberately fail/return before any network call, so a dummy token is safe.
OFFLINE_CASES = [
    ("profile", ["profile"], True),
    ("nothing_to_update", ["update", "IS-1"], True),
    ("briefing_no_project", ["report", "briefing"], True),
    ("sprint_no_sprint", ["report", "sprint"], True),
    ("load_no_project", ["load"], True),
    ("file_not_found", ["attach", "IS-1", _ABSENT_FILE], True),
    ("no_token", ["whoami"], False),
]


def _env(with_token):
    env = dict(os.environ)
    env["YT_PROFILE"] = _NOPROFILE
    env["YT_PCACHE"] = _PCACHE
    env["YT_BASE"] = "https://support.posibolt.com"
    for absent in (_NOPROFILE, _NOENV, _PCACHE, _ABSENT_FILE):
        try:
            os.remove(absent)
        except OSError:
            pass
    if with_token:
        env["YT_TOKEN"] = "perm-DUMMYTESTTOKEN"
        env.pop("YT_ENV", None)
    else:
        env.pop("YT_TOKEN", None)
        env["YT_ENV"] = _NOENV
    return env


def _run(script, argv, with_token):
    p = subprocess.run([sys.executable, script] + argv, env=_env(with_token),
                       capture_output=True, text=True)
    return p.returncode, p.stdout, p.stderr


def _golden_paths(name):
    return (os.path.join(GOLDEN, name + ".rc"),
            os.path.join(GOLDEN, name + ".out"),
            os.path.join(GOLDEN, name + ".err"))


@pytest.mark.parametrize("name,argv,with_token", OFFLINE_CASES)
def test_offline_parity(name, argv, with_token):
    rc_f, out_f, err_f = _golden_paths(name)
    if not (os.path.exists(rc_f) and os.path.exists(out_f) and os.path.exists(err_f)):
        pytest.skip(f"golden missing for {name} — run: python3 tests/test_cli_parity.py capture <original yt.py>")
    rc, out, err = _run(CLI, argv, with_token)
    assert str(rc) == open(rc_f).read().strip(), f"{name}: exit code differs"
    assert out == open(out_f).read(), f"{name}: stdout differs"
    assert err == open(err_f).read(), f"{name}: stderr differs"


def capture(original):
    """Capture offline golden snapshots from the ORIGINAL engine."""
    os.makedirs(GOLDEN, exist_ok=True)
    for name, argv, with_token in OFFLINE_CASES:
        rc, out, err = _run(original, argv, with_token)
        rc_f, out_f, err_f = _golden_paths(name)
        open(rc_f, "w").write(str(rc) + "\n")
        open(out_f, "w").write(out)
        open(err_f, "w").write(err)
        print(f"captured {name}: rc={rc} out={len(out)}b err={len(err)}b")


# Live (network) commands diffed original-vs-refactored back-to-back at the token
# checkpoint. Data shifts over time, so these are NOT committed golden.
LIVE_CASES = [
    ("whoami", ["whoami"], True),
    ("projects", ["projects"], True),
    ("search_p8_bugs", ["search", "Type: Bug #Unresolved", "--project", "P8",
                        "--columns", "id,summary,State,Assignee", "--limit", "10"], True),
    ("report_health_p8", ["report", "health", "--project", "P8"], True),
    ("report_activity_sa", ["report", "activity", "--days", "7"], True),
    ("boards", ["boards"], True),
    ("tags", ["tags"], True),
    ("saved", ["saved"], True),
    ("bad_field_syntax", ["update", "IS-1", "--field", "Bogus"], True),
    ("project_not_found", ["describe", "--project", "NOPEZZZ"], True),
]


def live_parity_report(original):
    """Run each live case on the ORIGINAL then the REFACTORED CLI back-to-back
    (real $YT_TOKEN required) and report diffs. Returns the number of mismatches."""
    mismatches = 0
    for name, argv, with_token in LIVE_CASES:
        o = subprocess.run([sys.executable, original] + argv, capture_output=True, text=True)
        r = subprocess.run([sys.executable, CLI] + argv, capture_output=True, text=True)
        same = (o.returncode == r.returncode and o.stdout == r.stdout and o.stderr == r.stderr)
        print(f"[{'OK ' if same else 'DIFF'}] {name}")
        if not same:
            mismatches += 1
            if o.returncode != r.returncode:
                print(f"   rc: orig={o.returncode} refactor={r.returncode}")
            if o.stdout != r.stdout:
                print(f"   stdout differs (orig {len(o.stdout)}b vs refactor {len(r.stdout)}b)")
            if o.stderr != r.stderr:
                print(f"   stderr: orig={o.stderr!r} refactor={r.stderr!r}")
    print(f"\n{len(LIVE_CASES) - mismatches}/{len(LIVE_CASES)} live cases match")
    return mismatches


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "capture":
        capture(sys.argv[2])
    elif len(sys.argv) >= 3 and sys.argv[1] == "live":
        sys.exit(1 if live_parity_report(sys.argv[2]) else 0)
    else:
        print("usage: test_cli_parity.py capture <original yt.py> | live <original yt.py>")
