# YouTrack REST API — deep reference (the full "map")

> Use `scripts/yt.py` for everything it already wraps (search, reports, create/
> update/cmd/log/comment/attach, articles, users, reassign, boards, history).
> Reach into this reference only for an endpoint the engine doesn't cover yet
> (e.g. tag CRUD, saved-query create, link add/remove, sprint creation).
>
> **Auth:** every call uses the CALLER'S OWN token (see SKILL.md "setup"); never
> embed a real token in this file or any example. The `YOUR_..._TOKEN_HERE`
> strings below are placeholders.
>
> Adapted from a colleague's excellent endpoint reference; folded in here so the
> breadth lives behind the engine. See `YOUTRACK_SKILL_COMPARISON.md` for credit
> and the two-way analysis.

---

# YouTrack API Endpoint Reference
Base URL: `https://support.posibolt.com/api`
Auth header (all requests): `Authorization: Bearer YOUR_YOUTRACK_PERM_TOKEN_HERE`

> **Default behaviour:** Without `fields=`, the API returns ONLY `id` and `$type`. Always specify fields explicitly.

## Table of Contents
1. [Fields Syntax](#fields-syntax)
2. [Custom Field $type Mapping](#custom-field-type-mapping) ← read this before updating any custom field
3. [Issues](#issues)
4. [Issue Comments](#issue-comments)
5. [Issue Custom Fields](#issue-custom-fields)
6. [Issue Links](#issue-links)
7. [Issue Tags](#issue-tags)
8. [Issue Work Items (Time Tracking)](#issue-work-items)
9. [Agiles (Boards)](#agiles)
10. [Sprints](#sprints)
11. [Commands](#commands)
12. [Projects](#projects)
13. [Users](#users)
14. [Tags](#tags)
15. [Saved Queries](#saved-queries)
16. [Work Items (Global)](#work-items-global)
17. [Activities](#activities)
18. [Articles](#articles)

---

## Fields Syntax

Request only what you need. Without `fields=` you get only `id` + `$type`.

Flat fields: `fields=id,summary,description`
Nested entity: `fields=project(id,name,shortName)`
Nested array: `fields=customFields(id,name,value(id,name,login))`
Deep nest: `fields=customFields(id,name,value(id,name),projectCustomField(id,field(name)))`

Multiple fields on same object are comma-separated with no spaces.
Requesting a non-existent field is silently ignored — no error.

**$top default:** The server caps returned items (typically 42 by default). Always set `$top` explicitly for production queries.

---

## Custom Field $type Mapping

**Critical:** You MUST include the correct `$type` in the POST body when updating a custom field.

| Custom Field Type | IssueCustomField `$type` | Value shape |
|---|---|---|
| `enum[1]` | `SingleEnumIssueCustomField` | `{"name": "ValueName"}` |
| `enum[*]` | `MultiEnumIssueCustomField` | `[{"name": "A"}, {"name": "B"}]` |
| `state[1]` | `StateIssueCustomField` | `{"name": "In Progress"}` |
| `user[1]` | `SingleUserIssueCustomField` | `{"login": "jsmith"}` |
| `user[*]` | `MultiUserIssueCustomField` | `[{"login": "jsmith"}]` |
| `version[1]` | `SingleVersionIssueCustomField` | `{"name": "2.1"}` |
| `version[*]` | `MultiVersionIssueCustomField` | `[{"name": "2.1"}]` |
| `build[1]` | `SingleBuildIssueCustomField` | `{"name": "BuildName"}` |
| `build[*]` | `MultiBuildIssueCustomField` | `[{"name": "BuildName"}]` |
| `ownedField[1]` | `SingleOwnedIssueCustomField` | `{"name": "SubsystemName"}` |
| `ownedField[*]` | `MultiOwnedIssueCustomField` | `[{"name": "SubsystemName"}]` |
| `group[1]` | `SingleGroupIssueCustomField` | `{"name": "GroupName"}` |
| `group[*]` | `MultiGroupIssueCustomField` | `[{"name": "GroupName"}]` |
| `integer` / `float` / `string` / `date and time` | `SimpleIssueCustomField` | primitive value |
| `date` | `DateIssueCustomField` | Unix timestamp ms |
| `period` | `PeriodIssueCustomField` | `{"minutes": 120}` |
| `text` | `TextIssueCustomField` | `{"text": "content", "$type": "TextFieldValue"}` |

**How to find the field ID to update it:**
```bash
curl -s \
  -H "Authorization: Bearer YOUR_YOUTRACK_PERM_TOKEN_HERE" \
  -H "Accept: application/json" \
  "https://support.posibolt.com/api/issues/ISSUE-ID/customFields?fields=id,name,value(id,name,login),$type"
```
The `id` in the response is the `fieldId` to use in the update URL.

---

## Issues

### Issue entity — key attributes
| Field | Type | Notes |
|---|---|---|
| `id` | String | Internal DB ID e.g. `2-42`. Read-only. |
| `idReadable` | String | Human ID e.g. `POS-123`. Read-only. |
| `summary` | String | Title. Writable. |
| `description` | String | Body (Markdown). Writable. Can be null. |
| `created` | Long | Unix ms. Read-only. |
| `updated` | Long | Unix ms. Read-only. |
| `resolved` | Long | Unix ms, null if open. Read-only. |
| `reporter` | User | Who filed it. Read-only. |
| `updater` | User | Last editor. Read-only. |
| `project` | Project | Parent project. Writable (for move). |
| `customFields` | Array of IssueCustomField | All custom fields with values. Read-only (update via sub-resource). |
| `comments` | Array of IssueComment | All comments. |
| `commentsCount` | Int | Read-only. |
| `tags` | Array of Tag | Tags on issue. |
| `links` | Array of IssueLink | Related issues. Read-only. |
| `parent` | IssueLink | Parent if sub-task. Read-only. |
| `subtasks` | IssueLink | Child issues. Read-only. |
| `isDraft` | Boolean | Read-only. |
| `visibility` | Visibility | Who can see the issue. |
| `votes` | Int | Read-only. |

### List / Search Issues
```
GET /issues?query=QUERY&fields=FIELDS&$top=N&$skip=N
```
**Recommended fields string:**
```
id,idReadable,summary,created,updated,resolved,
reporter(login,name),updater(login,name),
project(id,name,shortName),
customFields(id,name,$type,value(id,name,login,text,minutes,presentation,isResolved)),
tags(id,name),
commentsCount
```
**Query examples:**
- `#Unresolved` — all open issues
- `project: POS #Unresolved` — by project short name
- `assignee: jsmith #Unresolved` — by assignee login
- `Priority: Critical #Unresolved` — by priority value
- `created: Today` — created today
- `Sprint: {Sprint Name} #Unresolved` — in a sprint
- `tag: myTag` — by tag
- `for: me #Unresolved` — assigned to the token owner
- Combined: `project: POS assignee: jsmith #Unresolved Priority: Critical`

Default sort if none specified: `updated desc`
Pagination: `&$top=50&$skip=0`

### Get Specific Issue
```
GET /issues/:id?fields=FIELDS
```
`:id` = internal ID (`2-42`) OR readable ID (`POS-123`) — both work.

### Create Issue
```
POST /issues?fields=id,idReadable,summary
```
Required in body: `summary`, `project.id`
```json
{
  "summary": "Issue title",
  "description": "Detail here (Markdown ok)",
  "project": { "id": "PROJECT_INTERNAL_ID" },
  "customFields": [
    {
      "$type": "SingleEnumIssueCustomField",
      "name": "Priority",
      "value": { "name": "Critical" }
    },
    {
      "$type": "SingleUserIssueCustomField",
      "name": "Assignee",
      "value": { "login": "jsmith" }
    }
  ]
}
```
To get project internal IDs: `GET /admin/projects?fields=id,name,shortName`

### Update Issue (summary/description only)
```
POST /issues/:id?fields=id,idReadable,summary
```
```json
{ "summary": "Updated title", "description": "New description" }
```
For field changes use the Commands endpoint or Issue Custom Fields sub-resource.

### Delete Issue
```
DELETE /issues/:id
```

---

## Issue Comments

### List Comments
```
GET /issues/:id/comments?fields=id,text,author(login,name),created,updated,deleted,pinned
```

### Add Comment
```
POST /issues/:id/comments?fields=id,text,author(login,name),created
```
```json
{ "text": "Comment body (Markdown supported)" }
```

### Update Comment
```
POST /issues/:id/comments/:commentId?fields=id,text
```
```json
{ "text": "Updated comment" }
```

### Delete Comment
```
DELETE /issues/:id/comments/:commentId
```

---

## Issue Custom Fields

### List Fields + Values on an Issue
```
GET /issues/:id/customFields?fields=id,name,$type,value(id,name,login,text,minutes,presentation,isResolved)
```
This shows you the `id` of each field needed for updates, plus the current value.

### Update a Custom Field
```
POST /issues/:id/customFields/:fieldId?fields=id,name,value(id,name)
```
**The `$type` in the body must match the field type exactly — see the $type mapping table above.**

State field (e.g. move to "In Progress"):
```json
{
  "$type": "StateIssueCustomField",
  "value": { "name": "In Progress" }
}
```
Single enum (e.g. Priority):
```json
{
  "$type": "SingleEnumIssueCustomField",
  "value": { "name": "Critical" }
}
```
Single user (e.g. Assignee):
```json
{
  "$type": "SingleUserIssueCustomField",
  "value": { "login": "jsmith" }
}
```
Multi-enum (e.g. affected versions):
```json
{
  "$type": "MultiVersionIssueCustomField",
  "value": [{ "name": "2.1" }, { "name": "2.2" }]
}
```
Period/time estimate:
```json
{
  "$type": "PeriodIssueCustomField",
  "value": { "minutes": 120 }
}
```
Text field:
```json
{
  "$type": "TextIssueCustomField",
  "value": { "$type": "TextFieldValue", "text": "content here" }
}
```
Clear a field (set to null/empty):
```json
{
  "$type": "SingleEnumIssueCustomField",
  "value": null
}
```

> **Tip:** Use Commands endpoint instead when possible — it's simpler and handles state machine transitions automatically.

---

## Issue Links

### List Links on Issue
```
GET /issues/:id/links?fields=id,direction,linkType(id,name,localizedName,sourceToTarget,targetToSource),issues(id,idReadable,summary)
```

### Add Link to Issue
```
POST /issues/:id/links/:linkId/issues?fields=id,idReadable
```
`:linkId` is the IssueLink id (get it from the links list above)
```json
{ "id": "TARGET_ISSUE_INTERNAL_ID" }
```

### Remove Link
```
DELETE /issues/:id/links/:linkId/issues/:linkedIssueId
```

---

## Issue Tags

### List Tags on Issue
```
GET /issues/:id/tags?fields=id,name,owner(login,name)
```

### Add Tag to Issue
```
POST /issues/:id/tags?fields=id,name
```
```json
{ "id": "TAG_INTERNAL_ID" }
```
Get tag IDs first: `GET /tags?fields=id,name&$top=100`

### Remove Tag from Issue
```
DELETE /issues/:id/tags/:tagId
```

---

## Issue Work Items

### List Work Items on Issue
```
GET /issues/:id/timeTracking/workItems?fields=id,author(login,name),creator(login,name),date,duration(minutes,presentation),text,type(id,name)
```

### Log Time (Add Work Item)
```
POST /issues/:id/timeTracking/workItems?fields=id,duration(minutes,presentation),date
```
```json
{
  "duration": { "minutes": 90 },
  "text": "Investigated and resolved the issue",
  "date": 1700000000000,
  "type": { "name": "Development" }
}
```
`date` = Unix timestamp in milliseconds. Omit to use current time.
`type` = work item type name configured in the project. Omit if not required.

### Update Work Item
```
POST /issues/:id/timeTracking/workItems/:workItemId?fields=id,duration(minutes,presentation)
```

### Delete Work Item
```
DELETE /issues/:id/timeTracking/workItems/:workItemId
```

---

## Agiles

### List All Boards
```
GET /agiles?fields=id,name,owner(id,name,login),projects(id,name,shortName),sprints(id,name,isDefault,archived,start,finish)
```

### Get Specific Board
```
GET /agiles/:id?fields=id,name,owner(id,name,login),projects(id,name,shortName),sprints(id,name,isDefault,archived,start,finish,goal),columnSettings(columns(id,presentation,isResolved)),sprintsSettings(disableSprints,isExplicit,cardOnSeveralSprints),swimlaneSettings($type)
```

### Create Board
```
POST /agiles?template=kanban&fields=id,name
```
```json
{
  "name": "Board Name",
  "projects": [{ "id": "PROJECT_INTERNAL_ID" }]
}
```

### Update Board
```
POST /agiles/:id?fields=id,name
```

### Delete Board
```
DELETE /agiles/:id
```

---

## Sprints

### List Sprints on a Board
```
GET /agiles/:agileId/sprints?fields=id,name,isDefault,archived,start,finish,goal,issues(id,idReadable,summary)
```

### Get Specific Sprint (with issues)
```
GET /agiles/:agileId/sprints/:sprintId?fields=id,name,isDefault,archived,start,finish,goal,issues(id,idReadable,summary,resolved,customFields(name,value(name,login,isResolved)))
```

### Create Sprint
```
POST /agiles/:agileId/sprints?fields=id,name,isDefault,start,finish,goal
```
```json
{
  "name": "Sprint 5",
  "goal": "Deliver auth module",
  "start": 1700000000000,
  "finish": 1700604800000
}
```
`start`/`finish` = Unix timestamps in milliseconds.

### Update Sprint
```
POST /agiles/:agileId/sprints/:sprintId?fields=id,name,goal,isDefault
```
```json
{
  "goal": "Updated goal",
  "isDefault": true
}
```

### Delete Sprint
```
DELETE /agiles/:agileId/sprints/:sprintId
```

---

## Commands

**Most powerful way to update issues.** Handles state transitions, assignment, priority, tags, and more in a single call. Supports bulk — apply to multiple issues at once.

### Execute Command
```
POST /commands?fields=issues(id,idReadable)
```
Required body fields: `query` (the command string), `issues` (array with at least one issue by `id` or `idReadable`).

```json
{
  "query": "state In Progress assignee jsmith priority Critical",
  "issues": [
    { "idReadable": "POS-42" },
    { "idReadable": "POS-43" }
  ],
  "comment": "Moving to in-progress and assigning",
  "silent": false
}
```
`silent: true` — apply without sending notifications (requires Apply Commands Silently permission).

**Common command strings:**
| Command | Effect |
|---|---|
| `Fixed` | Set state to Fixed |
| `state Open` | Set state to Open |
| `state In Progress` | Set state to In Progress |
| `state Won't fix` | Set state (use quotes if name has spaces in some contexts) |
| `assignee jsmith` | Assign to login `jsmith` |
| `for me` | Assign to token owner |
| `for Unassigned` | Unassign |
| `priority Critical` | Set Priority to Critical |
| `Priority Major` | Set Priority (field name case-insensitive) |
| `type Bug` | Set Type field |
| `tag myTag` | Add tag |
| `remove tag myTag` | Remove tag |
| `fix version 2.1` | Set fix version |
| `Sprints {Sprint Name}` | Add to sprint |

Multiple commands space-separated in one `query` string: `"state In Progress assignee jsmith priority Major"`

Both `id` and `idReadable` work for identifying issues in the `issues` array.

### Get Command Suggestions
```
POST /commands/assist?fields=caret,commands(description,error,delete),query,suggestions(caret,completionEnd,completionStart,description,option,suffix)
```
```json
{
  "query": "state ",
  "issues": [{ "idReadable": "POS-42" }],
  "caret": 6
}
```

---

## Projects

### List All Projects
```
GET /admin/projects?fields=id,name,shortName,description,leader(login,name),createdBy(login,name),archived
```

### Get Specific Project
```
GET /admin/projects/:id?fields=id,name,shortName,description,timeTrackingEnabled,leader(login,name),customFields(id,field(name,fieldType($type,valueType)))
```

### List Project Custom Field Definitions
```
GET /admin/projects/:id/customFields?fields=id,field(id,name,fieldType($type,valueType)),bundle(id,name),canBeEmpty,emptyFieldText
```
Use this to discover the field types and IDs for a project before updating issues.

### Create Project
```
POST /admin/projects?fields=id,shortName,name
```
```json
{
  "name": "Project Name",
  "shortName": "PROJ",
  "leader": { "login": "jsmith" }
}
```

---

## Users

### Get Token Owner (Me)
```
GET /users/me?fields=id,login,name,email,savedQueries(name,id),tags(name,id)
```

### List Users
```
GET /users?fields=id,login,fullName,name,email,online,banned&$top=100
```

### Get Specific User
```
GET /users/:id?fields=id,login,name,fullName,email,online,banned,tags(id,name)
```
`:id` can be the login value (`jsmith`) or internal ID.

---

## Tags

### List All Tags
```
GET /tags?fields=id,name,owner(login,name),visibleFor(id,name)&$top=100
```

### Get Tag + Its Issues
```
GET /tags/:id?fields=id,name,owner(login,name),issues(id,idReadable,summary)
```

### Create Tag
```
POST /tags?fields=id,name
```
```json
{ "name": "new-tag-name" }
```

### Delete Tag
```
DELETE /tags/:id
```

---

## Saved Queries

### List Saved Queries
```
GET /savedQueries?fields=id,name,query,owner(login,name)&$top=50
```

### Create Saved Query
```
POST /savedQueries?fields=id,name,query
```
```json
{
  "name": "My Open Issues",
  "query": "for: me #Unresolved"
}
```

---

## Work Items (Global)

All work items across all issues.

```
GET /workItems?fields=id,created,date,duration(minutes,presentation),author(login,name),issue(id,idReadable,summary),text,type(name)&$top=50
```

---

## Activities

### Activities on a Specific Issue
```
GET /issues/:id/activities?fields=id,author(name,login),timestamp,target(id,idReadable),added(id,name,text,login,presentation),removed(id,name,text)&categories=CommentsCategory,IssueCreatedCategory,CustomFieldCategory,LinksCategory,TagsCategory&$top=50
```

**Category options for `categories=` param:**
- `CommentsCategory` — comments added/edited/deleted
- `IssueCreatedCategory` — issue creation event
- `CustomFieldCategory` — any custom field change
- `LinksCategory` — link added/removed
- `TagsCategory` — tags added/removed
- `AttachmentsCategory` — file attachments
- `SprintCategory` — sprint membership changes
- `WorkItemCategory` — time log changes

Multiple categories comma-separated: `categories=CommentsCategory,CustomFieldCategory`

### Global Activity Feed
```
GET /activities?fields=id,author(login,name),timestamp,target(id,idReadable),added,removed&categories=IssueCreatedCategory,CustomFieldCategory&$top=50
```

---

## Articles (Knowledge Base)

### List Articles
```
GET /articles?fields=id,idReadable,summary,created,updated,reporter(login,name),project(name,shortName)&$top=50
```

### Get Article Content
```
GET /articles/:id?fields=id,idReadable,summary,content,created,updated,reporter(login,name),project(name,shortName),parentArticle(id,summary),childArticles(id,summary)
```

### Create Article
```
POST /articles?fields=id,idReadable,summary
```
```json
{
  "summary": "Article Title",
  "content": "Markdown content body",
  "project": { "id": "PROJECT_INTERNAL_ID" }
}
```

### Add Comment to Article
```
POST /articles/:id/comments?fields=id,text,author(login,name),created
```
```json
{ "text": "Comment text (Markdown ok)" }
```

---

## Pagination

- `$top=N` — page size (default varies by endpoint, typically 42)
- `$skip=N` — offset
- Loop: `$top=100&$skip=0`, then `$top=100&$skip=100`, etc.
- For activity feeds, use cursor-based pagination via `beforeCursor`/`afterCursor` returned in the response.
- The `customFields` query param on `/issues` lets you request only specific custom fields by name rather than all of them.
