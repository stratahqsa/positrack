# Positrack — the dummy-proof setup manual

Positrack lets you **talk to Posibolt's YouTrack** (`support.posibolt.com`) in plain
English — ask what's stuck, get a weekly briefing, create or comment on tickets — and
it **answers with a chart by default** so anything you ask is screen-shareable in a
standup. You sign in as **yourself**, so you only ever see and change what your own
YouTrack account allows.

> **About the screenshots in this manual.** Each step has a **“What you'll see”** box
> describing the exact screen, and a placeholder like `![…](images/chatgpt-2.png)`.
> The image files live in [`docs/images/`](./images). If a placeholder shows a broken
> image, the screenshot for that step hasn't been dropped in yet — the text alone is
> enough to follow. Every step below was performed and verified end-to-end.

---

## Pick your tool (this matters)

| You use… | Works? | How | Need a YouTrack token? |
|---|---|---|---|
| **ChatGPT** (Plus, web) | ✅ Fully | Custom **connector** in Developer Mode (OAuth) | **No** — you sign in to Posibolt |
| **Claude** (claude.ai) | ✅ Fully | **Custom connector** (OAuth) | **No** — you sign in to Posibolt |
| **Gemini — the app/website** | ❌ No | *Google does not allow custom connectors in the consumer Gemini app* | — |
| **Gemini — the CLI** (terminal) | ⚠️ Technical | `gemini mcp add` | Yes (or Google sign-in + OAuth) |

**The short version:** if you use **ChatGPT or Claude**, setup is ~6 clicks, no token,
and it just works. **Gemini in the browser cannot do this at all** — that's a Google
limitation, not something we can fix. See the Gemini section for the only live option.

---

# 1) ChatGPT (recommended — easiest)

You'll add a **connector** (NOT a "Custom GPT Action" — see *Why not a Custom GPT?* at
the end). This uses **Developer Mode**, which any **ChatGPT Plus** account has.

### Step 1 — Open Developer Mode connectors
1. Go to **chatgpt.com** and sign in.
2. Click your **profile picture** (bottom-left) → **Settings**.
3. Click the **Apps** (a.k.a. **Connectors**) tab on the left.
4. Click **Advanced settings** → turn **Developer mode** **ON** (one-time).

> 📷 **What you'll see:** a Settings panel. The **Apps** tab lists any connectors you
> already have, with an **“Advanced settings”** button and a **“Create app”** button.
> ![ChatGPT connectors settings](images/chatgpt-1-settings.png)

### Step 2 — Create the Positrack connector
1. Click **Create app** (a dialog titled **“New App”** opens).
2. **Name:** `Positrack`
3. **Connection:** make sure **Server URL** is selected (not “Tunnel”).
4. **MCP Server URL:** paste exactly:
   ```
   https://positrack.up.railway.app/cmcp
   ```
5. **Authentication:** leave it on **OAuth** (the default). Leave the OAuth client
   ID/secret boxes **empty**.
6. Tick the box **“I understand and want to continue.”**
7. Click **Create**.

> 📷 **What you'll see:** the “New App” form with Name, a Server-URL field, an
> **Authentication = OAuth** dropdown, a risk-warning checkbox, and a black **Create**
> button. After a moment the **Advanced OAuth settings** line changes to *“Review
> discovered OAuth settings…”* — that means ChatGPT found our login automatically.
> ![ChatGPT New App dialog](images/chatgpt-2-create-app.png)

### Step 3 — Sign in to Posibolt
1. A panel **“Add Positrack to ChatGPT”** appears → click **Sign in with Positrack**.
2. A window opens on **support.posibolt.com**. If you're already logged into Posibolt
   it goes straight to a consent screen titled **“Application Access Request.”**
3. Click **Allow Access**.

> 📷 **What you'll see:** the Posibolt consent page listing “YouTrack” access, with
> **Allow Access** / **Deny** buttons. After you allow, the window closes by itself.
> ![Posibolt consent](images/chatgpt-3-consent.png)

### Step 4 — Done
The connector now shows **Connected** with **Disconnect** and the date. (The “Actions”
list in Settings can take a minute to populate — that's cosmetic; it works in chat
right away.)

> 📷 **What you'll see:** the Positrack connector card showing **Connected on …**,
> URL `…/cmcp`, **Authorization used: OAuth**. ![ChatGPT connected](images/chatgpt-4-connected.png)

### Step 5 — Use it
Start a **new chat** and try:
- **“Using Positrack, who am I in YouTrack?”** ← confirms it works
- **“What's unresolved in PXB1, broken down by state as a chart?”**
- **“Give me a 5-line weekly briefing on Integration Support.”**

> 📷 **What you'll see:** ChatGPT says *“Looked for available tools… Called tool”* and
> answers with your data — leading with a chart. ![ChatGPT query](images/chatgpt-5-query.png)

---

# 2) Claude (claude.ai — also easy, no token)

### Step 1 — Open the connectors page
1. Go to **claude.ai** and sign in.
2. Click your name (bottom-left) → **Settings** → **Connectors**, then the **Customize**
   link (connectors live at **claude.ai/customize/connectors**).

### Step 2 — Add the custom connector
1. Click **Add connector** → **Add custom connector**.
2. **Name:** `Positrack`
3. **Remote MCP server URL:**
   ```
   https://positrack.up.railway.app/cmcp
   ```
4. Leave **OAuth Client ID / Secret** **empty**.
5. Click **Add**.

> 📷 **What you'll see:** a dialog with **Name**, **Remote MCP server URL**, and two
> optional OAuth fields. ![Claude add connector](images/claude-1-add.png)

### Step 3 — Connect (sign in to Posibolt)
1. The Positrack connector appears as **Not connected** → click **Connect**.
2. You're taken to the Posibolt **“Application Access Request”** page → click
   **Allow Access**.

### Step 4 — Done
The connector shows **Disconnect** and **“Other tools 24.”** All 24 Positrack tools are
loaded immediately.

> 📷 **What you'll see:** the Positrack connector page listing `Yt whoami`, `Yt search`,
> `Yt report`, `Yt comment`, … (24 in total). ![Claude connected](images/claude-2-connected.png)

### Step 5 — Use it
In any chat, ask the same plain-English questions. The first time Claude uses a tool it
asks **“Claude wants to use … from Positrack”** — click **Always allow** (for reads) so
it stops asking. Writes still confirm (see *Is it safe?*).

> 📷 **What you'll see:** Claude renders a real **bar chart** for breakdowns. (Verified:
> “unresolved PXB1 by state” → a bar chart artifact + a table.)
> ![Claude bar chart](images/claude-3-chart.png)

---

# 3) Gemini (read this before you try)

**The Gemini app and website CANNOT use Positrack.** Google does not allow consumer
Gemini (Gemini app, gemini.google.com, “Gems”) to connect a custom/remote tool. No
setting changes this. A custom **Gem** can only *teach* you the commands and *draft*
tickets — it cannot read or change YouTrack.

**The only live option is the Gemini CLI** (a terminal app). It works, but it's for
technical users and needs Google sign-in. Steps:

1. Install: `npm install -g @google/gemini-cli`
2. Add Positrack (uses **your own** YouTrack token in a header):
   ```bash
   gemini mcp add --scope user --transport http \
     --header "Authorization: Bearer <YOUR perm-… YouTrack token>" \
     positrack https://positrack.up.railway.app/mcp
   ```
   (Get a token in YouTrack: **avatar → Account Security → New permanent token**, scope
   **YouTrack**, copy the `perm-…` value.)
3. Run `gemini`, **trust the folder** when asked, then `/mcp` to confirm **positrack** is
   **CONNECTED**, and ask *“Who am I in YouTrack?”*.

> Gemini CLI is a terminal and renders **text/Unicode** charts, not graphical ones. For
> visual charts use ChatGPT or Claude. For full details see [INSTALL_GEMINI.md](./INSTALL_GEMINI.md).

---

# Now actually use it — the same on every tool

**Lead with a question, not a ticket number.** Positrack is at its best on the things
the web UI can't do in one breath:

- *“What's stuck or unassigned this week in P8?”*
- *“Weekly briefing on Integration Support — shipped, new, blocked, needs a decision.”*
- *“Where is work piled on one person in PXB1?”* (workload chart)
- *“Log 90 minutes on IS-184 with a note.”*
- *“Comment on PXB1-7105: decided to ship behind a flag.”*

**You get a chart by default.** Any data answer leads with a visual (a bar/column chart
on ChatGPT & Claude; aligned Unicode bars in the Gemini CLI) plus a one-line takeaway.

### Is it safe? (yes)
- **You are you.** Every action runs with *your* YouTrack permissions. A “403” just
  means your account can't do that — ask a lead/admin, it's not a bug.
- **Writes preview first.** Create / comment / log / state-change tools return a
  *preview* and only apply after you confirm. ChatGPT/Claude also ask permission before
  each write. (You control this per-connector: set it to *ask every time* if you want a
  prompt on every action.)

---

# Troubleshooting

| Symptom | Cause & fix |
|---|---|
| **ChatGPT says “the integration isn't available / can't access this session.”** | You're on a **reasoning model** (it says *“Stopped thinking”*). Custom-GPT *Actions* don't run there — but the **connector** in this guide does, on every model. If it still happens, just say *“call the tool”* once. |
| **“Client Not Registered” when connecting.** | A one-time hiccup if your connector was created before the server's persistent-storage upgrade. **Delete the connector and re-create it** (Steps above). New setups never hit this. |
| **Settings shows “No app actions available yet.”** | Cosmetic lag in ChatGPT's settings panel. It works in chat — just ask it something. |
| **403 on a write.** | Your token/account lacks that permission. Use a lead/admin account for admin-only actions. |
| **Gemini app won't connect.** | Expected — consumer Gemini can't use custom tools. Use ChatGPT/Claude, or the Gemini CLI. |

### Why not a “Custom GPT” with an Action?
You *can* build a Custom GPT with an OpenAPI Action, but ChatGPT's **reasoning models
silently refuse to call Actions**, and you can't control which model a teammate uses —
so it breaks unpredictably. The **connector** in this guide works on every model. (The
old Action recipe is kept in [INSTALL_CHATGPT.md](./INSTALL_CHATGPT.md) for reference
only.)

---

# For admins (one-time, already done for Posibolt)

The connector path needs two server-side things, both set up:
1. An **OAuth service** registered in Posibolt **Hub** (so users sign in with their own
   account). Redirect URI `https://positrack.up.railway.app/auth/callback`.
2. The Positrack MCP server deployed on Railway **with a persistent volume** at `/data`
   so connector registrations survive redeploys (no “Client Not Registered” after
   deploys). See [INSTALL_CHATGPT.md → Server setup](./INSTALL_CHATGPT.md) and
   [MAINTENANCE.md](./MAINTENANCE.md).
