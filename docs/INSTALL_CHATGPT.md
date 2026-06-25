# Install Positrack for ChatGPT

**Good news, corrected for 2026:** ChatGPT **Plus** (the individual plan) can run
Positrack with **full read AND write**. The old "writes need Business/Enterprise"
guidance is outdated — that's an org-workspace admin restriction, not a Plus limit.
Write actions simply ask you to confirm before they go through.

Everything uses **your own** YouTrack permanent token, so you only ever see and
change what your YouTrack account already allows. A `403` just means your token
lacks permission for that action (you may need a lead/admin token) — that's
expected, not a bug.

### Get your YouTrack token first (both options need it)

1. In YouTrack (`https://support.posibolt.com`): profile avatar → **Account
   Security** → **New permanent token** → scope **YouTrack** → copy it (starts
   with `perm-`).
2. Keep it private. Never paste it into a chat message, a shared doc, or anywhere
   it could be logged.

---

## Option 1 — Custom GPT with a YouTrack Action (recommended, works today)

This is the **guaranteed** path on Plus. You build a Custom GPT whose Action calls
YouTrack's REST API directly, authenticated with **your own** token as a Bearer
key. Nothing is stored on our server — the token lives only in your GPT's config.

**Steps:**

1. ChatGPT → **GPTs** → **Create** → open the **Configure** tab.
2. Scroll to **Actions** → **Create new action**.
3. In the schema box, paste the OpenAPI schema from
   [`docs/chatgpt-action-openapi.yaml`](./chatgpt-action-openapi.yaml).
4. Under **Authentication**, choose **API Key**:
   - **Auth Type:** API Key
   - **Auth header type:** **Bearer**
   - **API Key value:** your `perm-…` token from above
5. Save the GPT. Give it a name like "Positrack" and (optionally) paste the
   Positrack skill voice into the instructions so it leads with answers and nudges
   you to capture decisions.

**Read vs. write confirmation.** Read calls (HTTP `GET` — search, get, reports,
boards, articles) are non-consequential and run without a prompt. Write calls
(`POST` / `PUT` / `DELETE` — create, update, comment, log, reassign) are flagged
as **consequential**, so ChatGPT shows you exactly what it's about to do and waits
for your **Confirm** before sending it to YouTrack. That's your preview→commit
safety net.

> **Note:** Custom GPT Actions are **not** available to ChatGPT's Pro-mode
> reasoning models. Use a standard model with this GPT.

---

## Option 2 — Remote MCP connector via Developer Mode

This connects ChatGPT directly to the deployed **Positrack MCP server** (all 24
tools, with the engine's preview→commit safety). It's a cleaner experience when
it's available, but there's a catch on auth — see the note at the end.

**Steps:**

1. ChatGPT → **Settings** → **Apps & Connectors** → **Advanced** → enable
   **Developer mode (beta)**.
2. **Create app** (custom connector).
3. **MCP Server URL:** `https://<railway-app>/mcp` (streamable HTTP, recommended),
   or `https://<railway-app>/sse` (SSE).
4. **Authentication:** ChatGPT only offers **No-Auth**, **OAuth**, or **Mixed** —
   it **cannot** pass a custom `Authorization` header. Since Positrack needs each
   user's own token, this path requires the server's **OAuth** flow.
5. Connect. Read tools run freely; each **write** tool prompts you per call to
   confirm before it commits.

> **Auth status:** Positrack's OAuth flow for the MCP server is a follow-up.
> **Until OAuth ships, use Option 1** — it gives you full read+write on Plus
> today with zero server-side token storage.

**Managed seats:** on a managed **Business/Enterprise** workspace, an admin may
have **Developer Mode disabled** — then Option 2 won't appear. An individual
**Plus** account is fine. Either way, Option 1 always works.

---

## Which should I pick?

- **Just want it working now, on Plus → Option 1.** Guaranteed, full read+write,
  your token never leaves your GPT config.
- **Want the full MCP toolset and OAuth is live → Option 2.**

## See also

JetBrains now ships an official **YouTrack Remote MCP server** (2025.3+).
Positrack complements it: a plain-English assistant layer, preview→commit safety
on every write, location/briefing reports, self-hosted reach, and the **same
engine** that powers the Positrack CLI and Claude skill.
