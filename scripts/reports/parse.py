# scripts/reports/parse.py
"""Pure parsers shared by all report-data modules. No network. Every rule is
pinned to a guide section and a test in tests/reports/test_parse.py."""
import datetime, re

IST = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
_DASH_RE = re.compile(r"[-–—]")  # hyphen, en-dash, em-dash
DONE_STATES = ("done", "fixed", "verified", "closed", "won't fix", "duplicate", "obsolete")

def iso_to_ms(iso):
    if not iso:
        return None
    s = str(iso).strip()
    fmt = "%Y-%m-%dT%H:%M:%S.%fZ" if "." in s else "%Y-%m-%dT%H:%M:%SZ"
    dt = datetime.datetime.strptime(s, fmt).replace(tzinfo=datetime.timezone.utc)
    return int(dt.timestamp() * 1000)

def _cf_value(issue, name):
    for cf in (issue.get("customFields") or []):
        if cf.get("name") == name:
            return cf.get("value")
    return None

def cf_name(issue, name):
    """`value.name` (enum/state/user) → str, or '' when absent/null."""
    v = _cf_value(issue, name)
    if isinstance(v, dict):
        return v.get("name") or v.get("fullName") or v.get("login") or ""
    return "" if v is None else str(v)

def cf_minutes(issue, name):
    """Period customField → minutes int, or 0."""
    v = _cf_value(issue, name)
    return int(v["minutes"]) if isinstance(v, dict) and v.get("minutes") else 0

def cf_date_ms(issue, name):
    """Date customField → epoch ms. Value is a BARE NUMBER on this instance
    (Examples_4 §4 gotcha 2); tolerate {'timestamp': n} defensively. None if unset."""
    v = _cf_value(issue, name)
    if isinstance(v, (int, float)):
        return int(v)
    if isinstance(v, dict) and v.get("timestamp"):
        return int(v["timestamp"])
    return None

def sprint_max(value):
    """Max sprint name by trailing numeric suffix (Examples_4 §4 gotcha 3)."""
    names = [s.get("name") for s in (value or []) if s and s.get("name")]
    if not names:
        return ""
    def key(n):
        m = re.search(r"(\d+)\s*$", n)
        return int(m.group(1)) if m else -1
    return max(names, key=key)

def is_done(state):
    """Case-insensitive substring match against DONE_STATES (Examples_4 §4)."""
    s = (state or "").lower()
    return any(d in s for d in DONE_STATES)

def submodule(summary):
    """Text after the FIRST colon, cut at the FIRST dash of any type; None if no
    colon (Examples_1 §6)."""
    if not summary or ":" not in summary:
        return None
    after = summary.split(":", 1)[1]
    part = _DASH_RE.split(after, 1)[0].strip()
    return part or None

def fmt_ist(ms):
    """Epoch ms → 'DD Mon YYYY, h:mm AM/PM' in IST (Examples_1 §4)."""
    dt = datetime.datetime.fromtimestamp(ms / 1000, IST)
    return dt.strftime("%d %b %Y, %-I:%M %p")

def ist_window(now_ms):
    """The Bug Analysis window: yesterday 00:00 IST → now (Examples_1 §2).
    Returns start_ms, end_ms, label, yesterday_str (YYYY-MM-DD), seven_days_str."""
    now_ist = datetime.datetime.fromtimestamp(now_ms / 1000, IST)
    today = now_ist.date()
    yest = today - datetime.timedelta(days=1)
    start_ist = datetime.datetime(yest.year, yest.month, yest.day, 0, 0, tzinfo=IST)
    start_ms = int(start_ist.timestamp() * 1000)
    return {
        "start_ms": start_ms,
        "end_ms": now_ms,
        "yesterday_str": yest.isoformat(),
        "seven_days_str": (today - datetime.timedelta(days=7)).isoformat(),
        "label": "%s → %s IST" % (fmt_ist(start_ms), fmt_ist(now_ms)),
    }
