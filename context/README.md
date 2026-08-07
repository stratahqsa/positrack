# Project Context Files

Git-controlled strategic context for Posibolt YouTrack projects, consumed by the
`yt_context` MCP tool and AI agents.

## What this is

Each JSON file in this directory describes **what a project IS about** — its
goals, milestones, KPIs, risks, team, and leader commentary. AI agents read
these files via the `yt_context` MCP tool to answer strategic questions like:

- "What's blocking the BPX launch?"
- "Give me a status update for the CEO"
- "Why is Module X behind?"
- "Compare BPX progress to PXB1"

The context files provide the **"why"** that ticket data alone cannot convey.

## How to create a context file

1. Copy the skeleton below into `context/{PROJECT_CODE}.json`
2. Fill in the sections relevant to your project
3. Submit a PR — context files are reviewed like code

### Skeleton

```json
{
  "identity": {
    "code": "YOUR_CODE",
    "name": "Project Name",
    "description": "One-line description",
    "owner": null,
    "launch_target": null
  },
  "goals": [],
  "milestones": [],
  "modules": [],
  "kpis": [],
  "risks": [],
  "dependencies": [],
  "team": [],
  "notes": ""
}
```

## Schema

See [`_schema.json`](_schema.json) for the full JSON Schema with field
descriptions and type constraints.

## Sections

| Section | Purpose | Example |
|---------|---------|---------|
| `identity` | Project code, name, owner, launch target | `"code": "BPX", "name": "POS X Product Management"` |
| `goals` | Business outcomes (not tickets) | `"Ship a fully integrated POS system by Q3 2026"` |
| `milestones` | Key dates with done/not-done status | `{"name": "Beta launch", "date": "2026-09-15", "done": false}` |
| `modules` | Major functional areas with owners | `{"name": "Sales", "owner": "john.doe", "purpose": "..."}` |
| `kpis` | Success metrics with targets | `{"name": "Open High bugs", "target": "< 5 by launch"}` |
| `risks` | Known risks and mitigations | `{"description": "...", "severity": "high", "mitigation": "..."}` |
| `dependencies` | Internal projects or external systems | `{"project": "PXB1", "description": "Depends on core ERP"}` |
| `team` | Key roles and who fills them | `{"role": "Tech Lead", "login": "jane.smith"}` |
| `notes` | Free-form leader annotations | Strategic decisions, context that tickets can't capture |

## Access control

Context files are **git-controlled**. The only way to modify them is through a
merged PR. This prevents gaming — you can't inflate your project's health by
editing context without review.

## MCP usage

```
# Full context
yt_context(project="BPX")

# Single section
yt_context(project="BPX", section="goals")
```

The tool returns structured JSON. Combine with `yt_report`, `yt_search`, and
`yt_effort` for the full picture.

## Deployment

Context files are copied into the MCP server's Docker image via the Dockerfile.
Updating a context file requires a redeploy. This is intentional for v1 — context
is strategic (changes rarely), not operational (changes daily).
