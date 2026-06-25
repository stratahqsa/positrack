# Posibolt YouTrack — instance guide

How to read the instance, and the cross-cutting realities to keep in mind.
**Nothing here is hardcoded into the tool** — `yt.py` discovers projects, fields,
states and values live. The snapshot below is orientation only; always confirm
with `yt.py projects` and `yt.py describe --project X`.

## Discover it live
- `python3 scripts/yt.py projects` — all projects (short code, id, name).
- `python3 scripts/yt.py describe --project IS` — that project's fields, and the
  values for State / Type / Priority / Location / Category / Team.
- `python3 scripts/yt.py get ISSUE-ID` — one issue with links, comments, age,
  estimate-vs-spent (use for progress/risk questions).

## Project snapshot (verify with `yt.py projects`)
| Code | Project | Typical use |
|---|---|---|
| P8 | POSibolt V8 | The legacy/flagship product — live support + dev |
| IS | Integration Support | Integrations (Shopify, Woo, RFID, HR…); SA + UAE |
| SUP | Posibolt Helpdesk | Native YouTrack Helpdesk — client support tickets, escalation states |
| OFT | Office Fix & Track | Internal office/IT fixes |
| GCC | GCC Projects | GCC-region delivery |
| APP | App Development | Mobile/app work |
| DVPS | DevOps | Infra / deployment |
| DAB | DABI | (UAE) |
| PCK | Customer Knowledge Base | KB articles |
| PXB1 | Posibolt X Beta Phase1 | The active POS X dev project |
| PX / PXB | POS X Alpha / Beta | Legacy POS X |
| BPX / LPX | POS X Product Mgmt (Beta / Lite) | Product/PRD pipelines |
| TCX / TCP8 | Test Cases X / 2025 | QA test-case repositories |

## Cross-cutting realities (so reports are read correctly)
- **No shared schema.** Each project has its own fields, state machine, and work
  types. The same idea has different names: work type is `Type` in IS/P8/SUP but
  `TaskType` in PXB1/PXB; states differ entirely (IS: Open / In Development /
  Testing / On hold / re-opened / Discovery / Completed). Always `describe`
  before assuming.
- **`Location`** (SA, UAE, INDIA, KSA, BAHRAIN, QATAR, OMAN, KUWAIT) is set on IS,
  P8, SUP, GCC, DAB — it's the cross-project lens for "what's happening in <place>".
- **Helpdesk (SUP)** is a native YouTrack Helpdesk: it has Client Name, Location,
  SLA-ish fields and escalation states (e.g. `Escalated`, `X Dev Ticket Created`,
  `V8 Dev ticket Created`) — useful for tracing how L1 support flows to dev today.
- **Resolved-state quirk.** Some projects have states like `Completed` that are
  NOT flagged resolved in config, so such issues still show as `#Unresolved`.
  When a count looks off, check whether the "done-ish" state is actually a
  resolved state (`describe` shows states; the bundle's `isResolved` flag is the
  source of truth). Flag this as a data-quality outlier rather than trusting the
  raw open count.
- **Estimation varies.** Some projects (e.g. IS) have no `Estimate` field at all,
  only `Spent time`; others (POS X) spread estimation across several period
  fields. The briefing report only checks "unestimated" where an Estimate field
  exists.
- **Role/queue accounts.** Assignee pools include role/system accounts (e.g.
  "Posibolt System Support", "Dev Lead"); a pile of work on one of these usually
  means "unassigned in practice".

## Writing safely
- `yt.py` reads each project's schema and builds the correctly-typed payload, so
  you only pass `Name=Value`. Writes preview by default; add `--commit` only
  after the user approves the preview.
- Values must match the project's allowed list exactly (case-sensitive). Use
  `describe` to confirm before committing.
