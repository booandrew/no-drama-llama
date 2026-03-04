Jira Cloud REST API v3 — Complete Issue Data Model

  Search Response (GET /rest/api/3/search/jql)

  - issues IssueBean[] — matched issues
  - names Record<string, string> — field ID → display name
  - schema Record<string, JsonTypeBean> — field ID → type schema
  - nextPageToken string | null — cursor for next page
  - isLast boolean — whether this is the last page

  ---
  IssueBean (top-level)

  - id string — numeric issue ID (e.g. "10001")
  - key string — issue key (e.g. "PROJ-123")
  - self string — REST API URL for this issue
  - expand string — which expansions were included
  - fields object — all field values (see below)
  - renderedFields object — HTML-rendered fields (expand=renderedFields)
  - names Record<string, string> — field ID → name (expand=names)
  - schema Record<string, JsonTypeBean> — field types (expand=schema)
  - transitions IssueTransition[] — workflow transitions (expand=transitions)
  - operations Operations — available actions (expand=operations)
  - editmeta IssueUpdateMetadata — edit metadata (expand=editmeta)
  - changelog PageOfChangelogs — change history (expand=changelog)
  - properties object — entity properties (?properties=key1,key2)

  ---
  fields — Scalar Fields

  - summary string — issue title
  - description ADF object | null — Atlassian Document Format
  - environment ADF object | null — environment description
  - created datetime string — ISO-8601 creation time
  - updated datetime string — ISO-8601 last update time
  - duedate string ("YYYY-MM-DD") | null
  - resolutiondate datetime string | null
  - labels string[] — e.g. ["bug", "frontend"]
  - lastViewed datetime string | null
  - statuscategorychangedate datetime string
  - workratio integer — % time logged vs estimated (-1 if no estimate)
  - timeoriginalestimate integer | null — seconds
  - timeestimate integer | null — remaining estimate, seconds
  - timespent integer | null — seconds
  - aggregatetimeoriginalestimate integer | null — seconds (incl. subtasks)
  - aggregatetimeestimate integer | null — seconds (incl. subtasks)
  - aggregatetimespent integer | null — seconds (incl. subtasks)

  ---
  fields.status — StatusDetails

  - self string — REST URL
  - id string
  - name string — e.g. "In Progress"
  - description string
  - iconUrl string
  - statusCategory
    - id integer — 1=undefined, 2=to do, 3=in progress, 4=done
    - key string — "undefined", "new", "indeterminate", "done"
    - name string — "No Category", "To Do", "In Progress", "Done"
    - colorName string — "blue-gray", "yellow", "green", etc.

  ---
  fields.priority — Priority

  - self string
  - id string
  - name string — "Highest", "High", "Medium", "Low", "Lowest"
  - description string
  - iconUrl string
  - statusColor string — hex color

  ---
  fields.resolution — Resolution | null

  - self string
  - id string
  - name string — "Done", "Won't Do", "Duplicate", "Cannot Reproduce"
  - description string

  ---
  fields.issuetype — IssueTypeDetails

  - self string
  - id string
  - name string — "Bug", "Task", "Story", "Epic", "Sub-task"
  - description string
  - iconUrl string
  - subtask boolean
  - avatarId integer
  - entityId string (uuid)
  - hierarchyLevel integer — 0=base, -1=subtask, 1=epic
  - scope
    - type string — "PROJECT" or "TEMPLATE"
    - project — ProjectDetails (abbreviated)

  ---
  fields.project — Project

  - self string
  - id string
  - key string — e.g. "PROJ"
  - name string
  - description string
  - lead User
  - projectTypeKey string — "software", "service_desk", "business"
  - simplified boolean — team-managed (next-gen) project
  - style string — "classic" or "next-gen"
  - avatarUrls — 16x16, 24x24, 32x32, 48x48
  - projectCategory
    - id string
    - name string
    - description string

  ---
  fields.assignee / fields.reporter / fields.creator — User

  - self string
  - accountId string — unique Atlassian account ID
  - accountType string — "atlassian", "app", "customer"
  - displayName string
  - emailAddress string | null — may be privacy-restricted
  - active boolean
  - timeZone string — e.g. "Europe/London"
  - locale string | null
  - avatarUrls — 16x16, 24x24, 32x32, 48x48

  ---
  fields.components — ComponentJsonBean[]

  - self string
  - id string
  - name string — e.g. "Backend"
  - description string
  - lead User
  - assigneeType string — "PROJECT_DEFAULT", "COMPONENT_LEAD", "PROJECT_LEAD", "UNASSIGNED"
  - assignee User
  - project string — project key
  - projectId integer

  ---
  fields.fixVersions / fields.versions — Version[]

  - self string
  - id string
  - name string — e.g. "v2.0"
  - description string
  - archived boolean
  - released boolean
  - releaseDate string ("YYYY-MM-DD")
  - startDate string ("YYYY-MM-DD")
  - overdue boolean
  - projectId integer

  ---
  fields.timetracking — TimeTrackingDetails

  - originalEstimate string — e.g. "2d 4h"
  - remainingEstimate string — e.g. "1d 2h"
  - timeSpent string — e.g. "3h 20m"
  - originalEstimateSeconds integer
  - remainingEstimateSeconds integer
  - timeSpentSeconds integer

  ---
  fields.progress / fields.aggregateprogress — Progress

  - progress integer — time spent in seconds
  - total integer — original estimate in seconds
  - percent integer — % complete

  ---
  fields.worklog — PageOfWorklogs

  - startAt integer
  - maxResults integer
  - total integer
  - worklogs[]
    - self string
    - id string
    - issueId string
    - author User
    - updateAuthor User
    - created datetime string
    - updated datetime string
    - started datetime string — when the work was done
    - timeSpent string — e.g. "3h 20m"
    - timeSpentSeconds integer
    - comment ADF object
    - visibility
        - type string — "group" or "role"
      - value string
      - identifier string

  ---
  fields.comment — PageOfComments

  - startAt integer
  - maxResults integer
  - total integer
  - comments[]
    - self string
    - id string
    - author User
    - updateAuthor User
    - created datetime string
    - updated datetime string
    - body ADF object
    - renderedBody string — HTML (with expand=renderedFields)
    - jsdPublic boolean — visible to JSM customers
    - visibility — same as worklog visibility

  ---
  fields.attachment — Attachment[]

  - self string
  - id string
  - filename string — e.g. "screenshot.png"
  - author User
  - created datetime string
  - size integer — bytes
  - mimeType string — e.g. "image/png"
  - content string — download URL
  - thumbnail string — thumbnail URL (images)

  ---
  fields.issuelinks — IssueLink[]

  - id string
  - self string
  - type
    - id string
    - name string — "Blocks", "Cloners", "Duplicate", "Relates"
    - inward string — e.g. "is blocked by"
    - outward string — e.g. "blocks"
  - inwardIssue (or outwardIssue) — LinkedIssue
    - id string
    - key string
    - fields — subset: summary, status, priority, issuetype

  ---
  fields.subtasks — IssueBean[] (subset)

  - id string
  - key string
  - fields — subset: summary, status, priority, issuetype

  ---
  fields.parent — IssueBean (subset) | null

  - id string
  - key string
  - fields — subset: summary, status, priority, issuetype

  ---
  fields.votes — Votes

  - self string
  - votes integer — vote count
  - hasVoted boolean — current user voted?

  fields.watches — Watchers

  - self string
  - watchCount integer
  - isWatching boolean — current user watching?

  fields.security — SecurityLevel | null

  - self string
  - id string
  - name string
  - description string

  ---
  Jira Software Custom Fields (IDs vary per instance)

  - Sprint (commonly customfield_10020) Sprint[]
    - id integer
    - state string — "active", "closed", "future"
    - name string
    - goal string
    - startDate / endDate / completeDate datetime string
    - originBoardId integer
  - Epic Link (commonly customfield_10014) string — epic issue key
  - Epic Name (commonly customfield_10011) string
  - Story Points (commonly customfield_10016) number
  - Rank (commonly customfield_10019) string — lexorank
  - Flagged (commonly customfield_10021) [{ self, value, id }]

  ---
  Custom Field Value Shapes by Type

  - Text (single/multi) → string
  - Rich text → ADF object
  - Number → number
  - Date picker → string ("YYYY-MM-DD")
  - DateTime picker → datetime string
  - URL → string
  - Single select / Radio → { self, id, value }
  - Multi select / Checkboxes → [{ self, id, value }]
  - Cascading select → { self, id, value, child: { self, id, value } }
  - User picker (single) → User
  - User picker (multi) → User[]
  - Group picker (single) → { name, groupId, self }
  - Group picker (multi) → [{ name, groupId, self }]
  - Version picker → Version or Version[]
  - Labels → string[]

  ---
  Controlling the Response

  fields param: *all, *navigable (default), comma-separated keys, or -fieldname to exclude

  expand param: renderedFields, names, schema, transitions, editmeta, changelog, operations, versionedRepresentations

  Use GET /rest/api/3/field to discover all field IDs (system + custom) for your instance.
