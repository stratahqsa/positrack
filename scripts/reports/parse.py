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

def submodule_fold_key(text):
    """Comparison key for near-duplicate submodule matching: lowercase, plus
    a conservative singular fold — strip one trailing 's' from the LAST WORD
    only (never a double-s ending, and only when the word is long enough
    that it isn't a short acronym like "POS") — so pure casing/pluralization
    variants (e.g. "Laybuy Report"/"Laybuy report", "Purchase Return"/
    "Purchase Returns") compare equal without needing a table entry for
    every future case (2026-07-22). This never REWRITES a submodule's text,
    only detects a match — used by module_insights() to merge counts and by
    the dashboard's submodule drill-down/filter, never to alter what a bug
    record itself displays. Real synonyms/abbreviations that don't differ by
    mere casing/plurality (e.g. "RG" vs "Goods Receipt") still need an
    explicit _SUBMODULE_ALIASES entry below — no fold key can safely infer
    those."""
    key = (text or "").strip().lower()
    if not key:
        return key
    words = key.rsplit(" ", 1)
    last = words[-1]
    if last.endswith("s") and not last.endswith("ss") and len(last) > 4:
        words[-1] = last[:-1]
    return " ".join(words)

_SUBMODULE_ALIASES = {
    # Real synonyms/abbreviations/naming-preference calls that need domain
    # knowledge — submodule_fold_key() alone can't safely infer these (e.g.
    # "RG" doesn't textually resemble "Goods Receipt"; "Stock Valuation" vs
    # "...Report" differs by a whole word, not just casing/plurality).
    # Keyed by submodule_fold_key(), so only ONE entry is needed per group
    # regardless of singular/plural spelling — e.g. "Product Imports" already
    # folds to the same key as "Product Import" below, no separate entry
    # needed. User-confirmed canonical spellings, 2026-07-21/22.
    "product category": "Product Category",
    "product import": "Product Import",
    "payables management": "Payables Management",
    "payable management": "Payables Management",
    "receive good": "Goods Receipt",
    "goods receipt": "Goods Receipt",
    "rg": "Goods Receipt",
    "pos": "POS",
    "pos screen": "POS",
    "pos scree": "POS",
    "web pos": "POS",
    "customer settlement": "Customer Settlement",
    "manage customer": "Manage Customer",
    "laybuy report": "Laybuy Report",
    "purchase return": "Purchase Return",
    "stock valuation": "Stock Valuation Report",
    "stock valuation report": "Stock Valuation Report",
}

def submodule(summary):
    """Text after the FIRST colon, cut at the FIRST dash of any type; None if no
    colon (Examples_1 §6). Near-duplicate spellings/casings are folded to a
    single canonical form via _SUBMODULE_ALIASES so Module Insights counts
    aren't split across variants of the same submodule. Only covers cases
    with a confirmed canonical spelling; module_insights() additionally
    auto-merges casing/pluralization variants that AREN'T in this table yet
    (submodule_fold_key(), above) without rewriting the per-bug text here."""
    if not summary or ":" not in summary:
        return None
    after = summary.split(":", 1)[1]
    part = _DASH_RE.split(after, 1)[0].strip()
    if not part:
        return None
    return _SUBMODULE_ALIASES.get(submodule_fold_key(part), part)

def fmt_ist(ms):
    """Epoch ms → 'DD Mon YYYY, h:mm AM/PM' in IST (Examples_1 §4)."""
    dt = datetime.datetime.fromtimestamp(ms / 1000, IST)
    return dt.strftime("%d %b %Y, %-I:%M %p")

def ist_window(now_ms):
    """The Bug Analysis window: yesterday 00:00 IST → now (Examples_1 §2),
    EXCEPT on Monday runs, where the window starts the PRECEDING FRIDAY
    00:00 IST instead — so a Monday-morning run still covers bugs reported
    over the weekend (Fri/Sat/Sun), which a plain "yesterday" (Sunday)
    window would silently drop. (2026-07-20: the dashboard never had this
    Monday rule; the standalone pxb1-bug-analysis skill already did, and
    this ports the same behavior here.) The day-of-week check runs on the
    already-IST-localized date, so it can't be thrown off by a UTC/IST
    calendar-date mismatch near midnight — same care as `in_window` below.
    Returns start_ms, end_ms, label, window_start_str (YYYY-MM-DD — was
    `yesterday_str`, renamed since it isn't always yesterday), seven_days_str."""
    now_ist = datetime.datetime.fromtimestamp(now_ms / 1000, IST)
    today = now_ist.date()
    days_back = 3 if today.weekday() == 0 else 1  # Monday (weekday()==0) -> back to Friday
    window_start_date = today - datetime.timedelta(days=days_back)
    start_ist = datetime.datetime(
        window_start_date.year, window_start_date.month, window_start_date.day, 0, 0, tzinfo=IST)
    start_ms = int(start_ist.timestamp() * 1000)
    return {
        "start_ms": start_ms,
        "end_ms": now_ms,
        "window_start_str": window_start_date.isoformat(),
        "seven_days_str": (today - datetime.timedelta(days=7)).isoformat(),
        "label": "%s → %s IST" % (fmt_ist(start_ms), fmt_ist(now_ms)),
    }
