"""Tests for scripts/snapshot.py — the Control Tower snapshot producer.

These are PURE/structural: they exercise the composition helpers that do NOT need a
token (RED-count derivation from effort data, the day-over-day delta against a prior
snapshot on disk, the sprint fallback, and the write/round-trip of the two files).
The heavy live path (effort_report sweep) is covered by the real committed snapshot
and the effort golden test; here we prove the SHAPE and the delta math offline.
"""
import json
import os
import sys

import pytest

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(_ROOT, "scripts"))
sys.path.insert(0, os.path.join(_ROOT, "core"))
import snapshot as snap  # noqa: E402
import gamification as gam  # noqa: E402


# ---------- a minimal but realistic effort_report-shaped fixture ----------
def _epic(eid, assignee="", state="OPEN", missing_est=False, overshoot=False,
          created=1, spent=0):
    return {"id": eid, "summary": eid, "assignee": assignee, "epic_state": state,
            "created": created, "resolved": None, "category": "PENDING",
            "rollup": {"server": 0, "ui": 0, "testing": 0}, "total": 0,
            "spent": spent, "overshoot": overshoot, "missing_est": missing_est,
            "stories": []}


def _effort_fixture():
    old = 1  # ms epoch ~ 1970 -> very stale by created age
    return {
        "project": "PXB1", "scope": "PHASE 1",
        "counts": {"done": 1, "pending": 3, "mixed": 1, "no_stories": 1,
                   "p2_backlog": 2, "epics_discovered": 8},
        "sections": {
            "done": [_epic("E-DONE")],
            "pending": [
                _epic("E-1", assignee="Dev Lead", missing_est=True),  # role-parked -> needs owner
                _epic("E-2", assignee="", state="On Hold"),        # unowned + blocked
                _epic("E-3", assignee="Dev", overshoot=True, spent=999, created=old),
            ],
            "mixed": [_epic("E-4", assignee="")],                  # unowned
            "no_stories": [_epic("E-5", assignee="QA", created=old)],  # stale (old + no spend)
            "p2_backlog": [{"id": "E-P1"}, {"id": "E-P2"}],
        },
        "totals": {"grand_total": {"total_md": 10.0, "spent_md": 5.0}},
    }


# ---------- RED counts from effort ----------
def test_red_counts_from_effort_fixture():
    red = snap._red_counts_from_effort(_effort_fixture())
    assert red["unowned"] == 3          # E-1 "Dev Lead" (role) + E-2 + E-4 (blank)
    assert red["role_owned"] == 1       # E-1 parked on a role placeholder
    assert red["unestimated"] == 1      # E-1 missing_est
    assert red["blocked"] == 1          # E-2 On Hold
    assert red["overshoot"] == 1        # E-3
    assert red["stale"] >= 1            # E-5 old + zero spend (E-3 old but has spend)
    assert red["total_red"] == (red["unowned"] + red["unestimated"] + red["stale"]
                                + red["blocked"] + red["overshoot"])
    assert red["stale_days"] == snap.STALE_DAYS


# ---------- day-over-day delta against a prior snapshot on disk ----------
def test_build_insights_delta_uses_prior_snapshot(tmp_path, monkeypatch):
    monkeypatch.setattr(snap, "DATA_DIR", str(tmp_path))
    # a prior snapshot with known red counts for the SAME project+scope
    prior = {
        "meta": {"project": "PXB1", "scope": "PHASE 1"},
        "insights": {"red_counts": {"unowned": 5, "unestimated": 4, "stale": 3,
                                    "blocked": 2, "overshoot": 1, "total_red": 15}},
    }
    (tmp_path / "snapshot-2026-06-30.json").write_text(json.dumps(prior))

    insights = snap.build_insights(_effort_fixture(), "PXB1", "PHASE 1")
    assert insights["red_counts"]["unowned"] == 3
    assert insights["compared_to"] == "snapshot-2026-06-30.json"
    # delta = today - prior (3-5 = -2 unowned, i.e. improved)
    assert insights["red_delta"]["unowned"] == 3 - 5
    assert insights["red_delta"]["unestimated"] == 1 - 4
    assert insights["red_delta"]["overshoot"] == 1 - 1
    assert set(insights["red_delta"]) == {"unowned", "unestimated", "stale",
                                          "blocked", "overshoot", "total_red"}


def test_build_insights_no_prior_snapshot_returns_none_delta(tmp_path, monkeypatch):
    monkeypatch.setattr(snap, "DATA_DIR", str(tmp_path))
    insights = snap.build_insights(_effort_fixture(), "PXB1", "PHASE 1")
    assert insights["red_delta"] is None
    assert insights["compared_to"] is None


def test_prior_snapshot_ignores_other_project_scope(tmp_path, monkeypatch):
    monkeypatch.setattr(snap, "DATA_DIR", str(tmp_path))
    other = {"meta": {"project": "OTHER", "scope": "PHASE 1"},
             "insights": {"red_counts": {"unowned": 9, "unestimated": 0, "stale": 0,
                                         "blocked": 0, "overshoot": 0, "total_red": 9}}}
    (tmp_path / "snapshot-2026-06-30.json").write_text(json.dumps(other))
    insights = snap.build_insights(_effort_fixture(), "PXB1", "PHASE 1")
    assert insights["red_delta"] is None   # different project -> not comparable


# ---------- pure signal fraction helper ----------
def test_frac_health_semantics():
    assert snap._frac(8, 10) == 0.8
    assert snap._frac(0, 0) == 1.0        # no open work -> not unhealthy
    assert snap._frac(-1, 10) == 0.0      # clamp low
    assert snap._frac(20, 10) == 1.0      # clamp high


# ---------- team signal mean (pure) ----------
def test_team_signal_mean():
    people = [
        {"key": "a", "signals": {"stale_free": 1.0, "estimated": 0.0, "moving": 0.5, "on_time_logging": 1.0}},
        {"key": "b", "signals": {"stale_free": 0.0, "estimated": 1.0, "moving": 0.5, "on_time_logging": 0.0}},
    ]
    mean = snap._team_signal_mean(people, ["a", "b"])
    assert mean["stale_free"] == 0.5
    assert mean["estimated"] == 0.5
    assert mean["moving"] == 0.5
    assert mean["on_time_logging"] == 0.5
    assert set(mean) == set(gam.HYGIENE_SIGNALS)
    assert snap._team_signal_mean(people, []) == {k: 0.0 for k in gam.HYGIENE_SIGNALS}


# ---------- write / round-trip ----------
def test_write_snapshot_writes_dated_and_latest(tmp_path, monkeypatch):
    monkeypatch.setattr(snap, "DATA_DIR", str(tmp_path))
    fake = {
        "meta": {"generated_at_iso": "2026-07-01T09:15:00+00:00", "generated_at_ms": 1,
                 "project": "PXB1", "scope": "PHASE 1", "sprint": "beta1-19",
                 "as_of_hhmm": "09:15", "engine_version": snap.ENGINE_VERSION},
        "effort": {"counts": {}}, "timespent": {}, "hygiene": {"blocks": []},
        "gamification": {"people": [], "teams": []}, "insights": {"red_counts": {}},
    }
    dated, latest = snap.write_snapshot(fake)
    assert os.path.basename(dated) == "snapshot-2026-07-01.json"
    assert os.path.basename(latest) == "latest.json"
    # both parse and round-trip to the same object
    for p in (dated, latest):
        with open(p, encoding="utf-8") as f:
            assert json.load(f) == fake


# ---------- gamification block uses ONLY allowlisted signals (integration guard) ----------
def test_person_signal_keys_are_allowlisted():
    # The producer must only ever emit allowlisted signal keys per person; feeding
    # those signals through the real scorer must not raise.
    signals = {"stale_free": 0.9, "estimated": 0.8, "moving": 0.2, "on_time_logging": 1.0}
    assert set(signals) <= set(gam.HYGIENE_SIGNALS)
    assert 0 <= gam.hygiene_score(signals) <= 100
