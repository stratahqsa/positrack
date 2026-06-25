# Outlier cases & edge handling

The cases that break naive YouTrack automation, and how this skill handles each.
Read before a bulk action, or when a result looks wrong. The goal: this skill
keeps working through a team restructure and messy data **without needing
changes** — so when something looks odd, it's almost always one of the cases
below, not a bug.

## A. Restructure & departures (the live risk right now)

1. **Open work assigned to deactivated users.** 12 users are already deactivated
   (`yt.py users --banned`), and departures will add more. Their open tickets are
   *stranded* — still "assigned", but no one is working them. Find them with
   `yt.py orphans [--project X]`; move them with `yt.py reassign <fromLogin>
   <toLogin> [--project X]` (previews the full list; only moves on `--commit`).
   Re-run `orphans` weekly during the change (schedule it) because the set grows.
2. **Role / queue accounts look assigned but aren't.** Accounts like `Dev Lead`,
   `QX Lead`, `Posibolt System Support` hold tickets that are *unassigned in
   practice*. Treat a pile on one of these as "needs a real owner", not as covered.
3. **Single points of failure.** `yt.py load --project X` shows open-work
   concentration. If one person holds most of a project's open work (e.g. one IS
   owner held 21 of 68), their departure is a delivery risk — plan coverage
   before, not after.
4. **Bulk reassignment is disruptive even though it's reversible.** Moving many
   tickets floods the receiver's queue and fires notifications. Always: scope with
   `--project`, review the preview's count and list, confirm the from/to, then
   `--commit`. To undo, reassign back. Prefer several small project-scoped moves
   over one instance-wide sweep.
5. **Do not use ownership data to rank or select people.** Assignment counts
   reflect board hygiene and queue routing, not performance or value. If asked to
   turn this into a layoff-target or performance list, decline and say why — it
   would be misleading and unfair. Keep it to continuity and capacity.
6. **A departing user's own token dies with their account.** Because everyone uses
   their *own* token, a banned user simply loses access; no shared credential
   breaks, and everyone else is unaffected.

## B. Permissions — what a normal token can and can't do (important for the 50)

The skill was validated with an **admin** token, so everything worked. A regular
support agent's token has *their own* rights, which is the safety model — but it
means some power features are lead/admin-only. The skill degrades gracefully
(friendly "403 — you lack permission, this is expected" message), and has
fallbacks so the core keeps working:

| Works on any normal token | Needs a lead / admin token |
|---|---|
| `search`, `count`, `get`, `history` | `users` (list everyone) |
| `report mywork`, most `report`/`activity` | `reassign` *other people's* work |
| `comment`, `log`, `cmd` (on issues you can edit) | precise field schema (`describe` values) |
| `articles`, `article` (read KB) | bulk admin reads |
| `create` / `update` (where you have create rights) | |

**Fallbacks built in:** if `/admin/projects` is denied, the project list is
derived from agile boards instead; if a project's field schema is denied, field
types are inferred from a sample issue (validated: 0 mismatches). So `projects`,
`create`, `update` and reports keep working for non-admins. When a value list
can't be read, use `yt.py cmd` for the change — the Commands API validates
server-side and needs no schema.

**Rollout guidance:** give leads/managers adequately-scoped tokens (they use
`reassign`, `users`, `load`, `briefing`); ICs and non-technical staff run fine on
a normal token for read, own-work, KB, comments and time logs.

## C. Data-model quirks (so reports read correctly)

1. **"Completed"/"Done-ish" states that aren't flagged resolved.** Some projects
   (e.g. IS `Completed`) don't mark those states as resolved in config, so such
   issues still appear in `#Unresolved` and inflate open counts. When a count
   looks too high, check whether the "done" state is actually a resolved state
   (`describe` lists states; the bundle's `isResolved` is the source of truth).
   Report it as a config outlier, don't silently trust the number.
2. **No `Estimate` field on some projects** (e.g. IS has only `Spent time`). The
   `briefing` report auto-skips the "unestimated" outlier where no Estimate field
   exists; an explicit `report unestimated` on such a project will return an
   error — that's expected, not a failure.
3. **Different state/type names per project.** `On hold` vs `BLOCKED`, `re-opened`
   vs `RE-OPEN`. The briefing detects blocked/reopened by pattern; for queries and
   writes, confirm exact names with `describe`, or use `cmd` (validates).
4. **Casing matters on writes.** `On hold` ≠ `on hold`, `TESTING` ≠ `Testing`.
   `cmd` catches a bad value in preview; raw field writes won't.
5. **Date attribute is `resolved date:`, not `resolved:`.** This instance rejects
   `resolved:`. The engine uses the correct form; raw queries must too.
6. **Multi-value fields** (Sprints, Region) take comma-separated values; handled.
7. **Empty / archived projects.** LPX is empty; archived projects exist (`projects`
   shows the flag). Empty results are returned as "0 issue(s)", not an error.
8. **Null value vs absent field** are both treated as "no value".
9. **`$top` default cap.** YouTrack caps page size (~42) if `$top` is omitted; the
   engine always paginates. Raw curl callers must set `$top`.

## D. Conversation / UX outliers

1. **Ambiguous plain-English.** Confirm scope (project/location/time) or state
   your assumption and proceed — don't guess silently on a write.
2. **Huge result sets.** Use `count` first; then list with a `--limit`.
3. **Genuinely out-of-scope questions.** If someone asks for something the instance
   doesn't hold and the KB has no entry, answer warmly in one line and point to
   what the skill *can* do — never error out at a non-technical user.
4. **Wrong/ambiguous project code.** `yt.py projects` lists the real codes; resolve
   before acting.

## E. Operational

1. **Token expiry / invalid** → friendly 401; regenerate the permanent token.
2. **Rate limiting (429)** → wait and retry; avoid firing many counts in parallel
   (date-range counts especially — run them sequentially).
3. **Network/base-URL issues** → friendly message naming the base URL to check.
4. **Count returns -1 transiently** (still calculating) → the engine polls; don't
   treat a momentary -1 as zero.
