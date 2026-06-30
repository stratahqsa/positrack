# Install Positrack for ChatGPT

> ### 👉 Most people should follow the [**dummy-proof manual → MANUAL.md**](./MANUAL.md)
> It walks the **recommended OAuth connector** path (no token, ~6 clicks) with
> screenshots. Use **Option 2 (MCP connector)** below — it works on **every** model.
>
> ⚠️ **Option 1 (Custom GPT Action) is now LEGACY / not recommended.** ChatGPT's
> *reasoning* models silently refuse to call Custom-GPT Actions, and you can't control
> which model a teammate is on, so the Action path breaks unpredictably. It's kept here
> for reference only. The **connector (Option 2)** is the reliable path and what
> MANUAL.md uses.

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

## Option 2 — Remote MCP connector via Developer Mode (OAuth)

This connects ChatGPT directly to the deployed **Positrack MCP server** (all 25
tools, with the engine's preview→commit safety). ChatGPT's MCP connector can't
pass a custom `Authorization` header — it only does **OAuth** — so Positrack runs
an OAuth flow that logs you in with your **own** Posibolt Hub account and forwards
your access to YouTrack. You never paste a token; nothing shared is stored.

> **Use the `/cmcp` URL, not `/mcp`.** `/mcp` is the raw-token endpoint for clients
> that *can* send a header (Claude, Gemini CLI). ChatGPT uses the OAuth-protected
> **`/cmcp`** endpoint.

**Steps (per user):**

1. ChatGPT → **Settings** → **Apps & Connectors** → **Advanced** → enable
   **Developer mode (beta)**.
2. **Create app** (custom connector).
3. **MCP Server URL:** `https://positrack.up.railway.app/cmcp`
4. **Authentication:** choose **OAuth**. Leave the advanced Auth/Token/Registration
   URL fields **blank** — ChatGPT discovers them automatically from the server
   (it registers itself via Dynamic Client Registration). If you'd previously
   typed anything there, clear it.
5. **Create**, then **Connect** → you're redirected to **Posibolt Hub** to log in
   and approve. After consent you land back in ChatGPT, connected.
6. Read tools run freely; each **write** tool prompts you per call to confirm
   before it commits.

> If the connect fails immediately with no Hub login page, the server hasn't been
> configured yet — see **Server setup** below (a one-time admin step), or just use
> **Option 1**, which always works on Plus.

### Server setup (one-time, by a Posibolt Hub admin)

OAuth needs a client registered in Hub. This is done **once** for everyone.

1. In Hub (`https://support.posibolt.com/hub`) you need **Low-level Admin Write**.
   Go to the administration area → **Services** → **New Service**.
2. Give it a name (e.g. "Positrack ChatGPT"), set a **Home URL**, **Create**.
3. On the service's settings:
   - Copy its **ID** (this is the OAuth `client_id`).
   - Set a **Secret** (the `client_secret`) — click **Change** to generate one.
   - Under **Redirect URIs**, add exactly:
     `https://positrack.up.railway.app/auth/callback`
   - Enable the **Authorization Code** flow; require **PKCE** if offered.
4. Note the **YouTrack service ID** from the **Services** list (a different UUID) —
   the access token must carry it for YouTrack REST calls to work.
5. Set these env vars on the Railway service and redeploy:

   ```
   HUB_CLIENT_ID=<the Positrack service ID from step 3>
   HUB_CLIENT_SECRET=<the secret from step 3>
   OAUTH_PUBLIC_URL=https://positrack.up.railway.app
   HUB_SCOPES=openid offline_access <youtrack-service-uuid> 0-0-0-0-0
   FASTMCP_JWT_SIGNING_KEY=<a long random string>   # keeps sessions valid across redeploys
   ```

   With those unset, the server simply runs without OAuth (Option 1 / Claude /
   Gemini are unaffected). `0-0-0-0-0` is Hub's own service id; keep it in scope.

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
