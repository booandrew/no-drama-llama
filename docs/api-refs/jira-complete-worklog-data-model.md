Jira Cloud REST API v3 -- Worklog Endpoints (Exhaustive Reference)

Base URL: https://api.atlassian.com/ex/jira/{cloudId}

All endpoints below are relative to this base. Header: Authorization: Bearer {access_token}
Content-Type: application/json (for POST/PUT/DELETE with body)
Accept: application/json

Prerequisite: Time tracking must be enabled in the Jira instance. If disabled, all worklog endpoints return an error.

================================================================================
TABLE OF CONTENTS
================================================================================
1. POST   /rest/api/3/issue/{issueIdOrKey}/worklog              -- Create worklog
2. GET    /rest/api/3/issue/{issueIdOrKey}/worklog              -- Get issue worklogs
3. GET    /rest/api/3/issue/{issueIdOrKey}/worklog/{id}         -- Get single worklog
4. PUT    /rest/api/3/issue/{issueIdOrKey}/worklog/{id}         -- Update worklog
5. DELETE /rest/api/3/issue/{issueIdOrKey}/worklog/{id}         -- Delete worklog
6. POST   /rest/api/3/worklog/list                              -- Bulk get worklogs by IDs
7. GET    /rest/api/3/worklog/updated                           -- Get IDs of updated worklogs
8. GET    /rest/api/3/worklog/deleted                           -- Get IDs of deleted worklogs
9. DELETE /rest/api/3/issue/{issueIdOrKey}/worklog              -- Bulk delete worklogs
10. POST  /rest/api/3/issue/{issueIdOrKey}/worklog/move         -- Bulk move worklogs

================================================================================
COMMON SCHEMAS (referenced by all endpoints)
================================================================================

--- Worklog Object (Response) ---

{
  "self":             string,   // URL of this worklog resource
  "id":               string,   // Worklog ID (numeric string)
  "issueId":          string,   // Parent issue ID (numeric string)
  "author":           UserDetails,
  "updateAuthor":     UserDetails,
  "comment":          Document,   // ADF (Atlassian Document Format) -- see below
  "created":          string,   // ISO 8601 datetime, e.g. "2024-01-17T12:34:00.000+0000"
  "updated":          string,   // ISO 8601 datetime
  "started":          string,   // ISO 8601 datetime -- see STARTED FORMAT below
  "timeSpent":        string,   // Human-readable: "3h 20m", "1d", "2d 4h"
  "timeSpentSeconds": integer,  // int64, e.g. 12000
  "visibility":       Visibility,  // optional -- restriction
  "properties":       EntityProperty[]  // only present when expand=properties
}

--- UserDetails Object ---

{
  "self":         string,   // URL of the user resource
  "accountId":    string,   // Atlassian account ID (e.g. "5b10a2844c20165700ede21g")
  "emailAddress": string,   // May be absent depending on privacy settings
  "avatarUrls": {
    "48x48":      string,
    "24x24":      string,
    "16x16":      string,
    "32x32":      string
  },
  "displayName":  string,   // e.g. "Mia Krystof"
  "active":       boolean,  // true if account is active
  "timeZone":     string,   // e.g. "Australia/Sydney"
  "accountType":  string    // "atlassian", "app", "customer"
}

NOTE: When creating a worklog, the "author" field in the request body is IGNORED.
The authenticated user is always recorded as the author. You cannot log work on
behalf of another user via the standard REST API.

--- Visibility Object ---

{
  "type":       string,   // "group" or "role"
  "value":      string,   // Name of the group or role (e.g. "jira-developers", "Developers")
  "identifier": string    // UUID/ID of the group or role (e.g. "276f955c-63d7-42c8-9520-92d01dca0625")
}

When setting visibility on create/update, you can provide:
  - type + value (group/role name)
  - type + identifier (group/role ID)
  - type + value + identifier (both)

If omitted, the worklog is visible to all users with access to the issue.

--- EntityProperty Object ---

{
  "key":   string,   // Property key, max 255 characters
  "value": any       // Any valid JSON value, max 32,768 characters when serialized
}

Properties can be set inline when creating/updating a worklog, or managed
separately via the Issue Worklog Properties endpoints:
  GET/PUT/DELETE /rest/api/3/issue/{issueIdOrKey}/worklog/{worklogId}/properties/{propertyKey}

--- Document Object (ADF -- Atlassian Document Format) ---

In API v3, the "comment" field uses ADF (not plain text as in v2).

Minimal structure:
{
  "version": 1,
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "Your worklog comment here"
        }
      ]
    }
  ]
}

Root node:
  - version: integer (always 1)
  - type: "doc"
  - content: array of top-level block nodes

Top-level block node types:
  blockquote, bulletList, codeBlock, expand, heading, mediaGroup,
  mediaSingle, orderedList, panel, paragraph, rule, table,
  multiBodiedExtension

Child block node types (must be nested within parents):
  listItem, media, nestedExpand, tableCell, tableHeader, tableRow,
  extensionFrame

Inline node types:
  date, emoji, hardBreak, inlineCard, mention, status, text, mediaInline

Available marks (text formatting):
  border, code, em, link, strike, strong, subsup, textColor, underline

JSON schema: http://go.atlassian.com/adf-json-schema

--- STARTED Field Format ---

Format: ISO 8601 with milliseconds and timezone offset WITHOUT colon.

  "2024-01-17T12:34:00.000+0000"

IMPORTANT quirks:
  - Timezone offset MUST use [+-]hhmm (no colon), NOT [+-]hh:mm
  - Fractional seconds MUST be present, even if ".000"
  - "2024-01-17T12:34:00+0000"      --> REJECTED (no fractional seconds)
  - "2024-01-17T12:34:00.000+00:00"  --> REJECTED (colon in tz offset)
  - "2024-01-17T12:34:00.000+0000"   --> ACCEPTED

================================================================================
1. CREATE WORKLOG
================================================================================

POST /rest/api/3/issue/{issueIdOrKey}/worklog

--- Path Parameters ---
  issueIdOrKey   string   REQUIRED   Issue ID (e.g. "10001") or key (e.g. "PROJ-123")

--- Query Parameters ---
  notifyUsers          boolean  optional  default: true     Whether to send email notifications
  adjustEstimate       string   optional  default: "auto"   How to adjust remaining estimate
                                          Valid values: "new", "leave", "manual", "auto"
                                            "auto"   - reduce estimate by timeSpent
                                            "leave"  - leave estimate unchanged
                                            "new"    - set estimate to newEstimate value
                                            "manual" - reduce estimate by reduceBy value
  newEstimate          string   optional  default: none     Required when adjustEstimate="new"
                                          Format: Jira duration ("2d", "4h", "30m", "1d 2h")
  reduceBy             string   optional  default: none     Required when adjustEstimate="manual"
                                          Format: Jira duration
  expand               string   optional  default: none     Comma-separated. Values: "properties"
  overrideEditableFlag boolean  optional  default: false    Allow adding worklog to non-editable issue
                                          (e.g. closed issue). Only usable by Connect apps with
                                          admin scope or Forge apps with appropriate permissions.

--- Request Body ---
{
  "comment":          Document,          // optional -- ADF object (see above)
  "visibility":       Visibility,        // optional -- restriction object
  "started":          string,            // optional -- defaults to current time
                                         //   format: "2024-01-17T12:34:00.000+0000"
  "timeSpentSeconds": integer,           // required (either this or timeSpent)
                                         //   time in seconds, e.g. 12000
  "timeSpent":        string,            // required (either this or timeSpentSeconds)
                                         //   Jira duration, e.g. "3h 20m"
  "properties":       EntityProperty[]   // optional -- array of entity properties
}

NOTE: "author" and "updateAuthor" fields in the request body are IGNORED.

--- Response ---
  201 Created     -- Worklog object (full schema above)
  400 Bad Request -- Invalid input (bad timeSpent format, invalid ADF, etc.)
  401 Unauthorized
  404 Not Found   -- Issue not found or user lacks browse permission

--- OAuth 2.0 (3LO) Scopes ---
  Classic:  write:jira-work
  Granular: write:issue-worklog:jira, write:issue-worklog.property:jira,
            read:issue-worklog:jira, read:avatar:jira, read:group:jira,
            read:project-role:jira, read:user:jira

--- Jira Permissions ---
  Browse projects (project-level) for the issue's project
  Work on issues (project-level) for the issue's project
  If issue has security level: appropriate issue-level security permission


================================================================================
2. GET ISSUE WORKLOGS
================================================================================

GET /rest/api/3/issue/{issueIdOrKey}/worklog

Returns all worklogs for an issue, ordered by created time (oldest first).

--- Path Parameters ---
  issueIdOrKey   string   REQUIRED   Issue ID or key

--- Query Parameters ---
  startAt        integer  optional  default: 0      Index of first result (0-based)
  maxResults     integer  optional  default: 1048576 (effectively unlimited, but page
                                    size capped at 1000)  Max worklogs per page
  startedAfter   long     optional  default: none   Unix timestamp in MILLISECONDS.
                                    Only return worklogs started on or after this time.
  startedBefore  long     optional  default: none   Unix timestamp in MILLISECONDS.
                                    Only return worklogs started before this time.
  expand         string   optional  default: none   Values: "properties"

--- Response ---
  200 OK
  {
    "startAt":    integer,    // 0-based index of first item
    "maxResults": integer,    // page size
    "total":      integer,    // total number of worklogs matching criteria
    "worklogs":   Worklog[]   // array of worklog objects
  }

Pagination: Use startAt + maxResults. Iterate while startAt + maxResults < total.
Page size limit: 1000 worklogs per page.

  401 Unauthorized
  404 Not Found   -- Issue not found or no browse permission

--- OAuth 2.0 (3LO) Scopes ---
  Classic:  read:jira-work
  Granular: read:issue-worklog:jira, read:issue-worklog.property:jira,
            read:avatar:jira, read:group:jira, read:project-role:jira,
            read:user:jira

--- Jira Permissions ---
  Browse projects (project-level)
  Worklogs restricted by visibility require membership in the specified group/role


================================================================================
3. GET SINGLE WORKLOG
================================================================================

GET /rest/api/3/issue/{issueIdOrKey}/worklog/{id}

--- Path Parameters ---
  issueIdOrKey   string   REQUIRED   Issue ID or key
  id             string   REQUIRED   Worklog ID

--- Query Parameters ---
  expand         string   optional  default: none   Values: "properties"

--- Response ---
  200 OK         -- Single Worklog object
  401 Unauthorized
  404 Not Found  -- Issue or worklog not found, or no browse permission

--- OAuth 2.0 (3LO) Scopes ---
  Classic:  read:jira-work
  Granular: read:issue-worklog:jira, read:issue-worklog.property:jira,
            read:avatar:jira, read:group:jira, read:project-role:jira,
            read:user:jira

--- Jira Permissions ---
  Browse projects (project-level)
  If worklog has visibility restriction: user must be in the specified group/role


================================================================================
4. UPDATE WORKLOG
================================================================================

PUT /rest/api/3/issue/{issueIdOrKey}/worklog/{id}

--- Path Parameters ---
  issueIdOrKey   string   REQUIRED   Issue ID or key
  id             string   REQUIRED   Worklog ID

--- Query Parameters ---
  notifyUsers          boolean  optional  default: true     Send email notifications
  adjustEstimate       string   optional  default: "auto"   How to adjust remaining estimate
                                          Valid values: "new", "leave", "manual", "auto"
  newEstimate          string   optional  default: none     Required when adjustEstimate="new"
                                          Format: Jira duration
  reduceBy             string   optional  default: none     Required when adjustEstimate="manual"
                                          Format: Jira duration
  expand               string   optional  default: none     Values: "properties"
  overrideEditableFlag boolean  optional  default: false    Same as create -- Connect/Forge apps only

--- Request Body ---
Same schema as Create Worklog. All fields are optional (partial update supported).
{
  "comment":          Document,          // optional
  "visibility":       Visibility,        // optional
  "started":          string,            // optional
  "timeSpentSeconds": integer,           // optional
  "timeSpent":        string,            // optional
  "properties":       EntityProperty[]   // optional
}

--- Response ---
  200 OK          -- Updated Worklog object
  400 Bad Request -- Invalid input
  401 Unauthorized
  404 Not Found   -- Issue or worklog not found

--- OAuth 2.0 (3LO) Scopes ---
  Classic:  write:jira-work
  Granular: write:issue-worklog:jira, write:issue-worklog.property:jira,
            read:issue-worklog:jira, read:avatar:jira, read:group:jira,
            read:project-role:jira, read:user:jira

--- Jira Permissions ---
  Browse projects (project-level)
  Edit all worklogs (project-level) to update any worklog
    OR Edit own worklogs (project-level) to update worklogs created by the user


================================================================================
5. DELETE WORKLOG
================================================================================

DELETE /rest/api/3/issue/{issueIdOrKey}/worklog/{id}

--- Path Parameters ---
  issueIdOrKey   string   REQUIRED   Issue ID or key
  id             string   REQUIRED   Worklog ID

--- Query Parameters ---
  notifyUsers          boolean  optional  default: true     Send email notifications
  adjustEstimate       string   optional  default: "auto"   How to adjust remaining estimate
                                          Valid values: "new", "leave", "manual", "auto"
                                            "auto"     - increase estimate by timeSpent of deleted worklog
                                            "leave"    - leave estimate unchanged
                                            "new"      - set estimate to newEstimate value
                                            "manual"   - increase estimate by increaseBy value
  newEstimate          string   optional  default: none     Required when adjustEstimate="new"
                                          Format: Jira duration
  increaseBy           string   optional  default: none     Required when adjustEstimate="manual"
                                          Format: Jira duration
                                          NOTE: This is "increaseBy" for DELETE (not "reduceBy" as in POST/PUT)
  overrideEditableFlag boolean  optional  default: false    Connect/Forge apps only

--- Request Body ---
  None (empty body)

--- Response ---
  204 No Content  -- Successfully deleted
  400 Bad Request -- Invalid parameters
  401 Unauthorized
  404 Not Found   -- Issue or worklog not found

--- OAuth 2.0 (3LO) Scopes ---
  Classic:  write:jira-work
  Granular: delete:issue-worklog:jira, delete:issue-worklog.property:jira,
            write:issue.time-tracking:jira, read:issue-worklog:jira,
            read:group:jira

--- Jira Permissions ---
  Browse projects (project-level)
  Delete all worklogs (project-level) to delete any worklog
    OR Delete own worklogs (project-level) to delete worklogs created by the user


================================================================================
6. BULK GET WORKLOGS BY IDs
================================================================================

POST /rest/api/3/worklog/list

Returns full worklog details for a list of worklog IDs. Useful after calling
/worklog/updated or /worklog/deleted to get the actual worklog data.

--- Query Parameters ---
  expand         string   optional  default: none   Values: "properties"

--- Request Body ---
{
  "ids": [integer]   // REQUIRED -- array of worklog IDs (int64)
                     // Maximum 1000 IDs per request
}

--- Response ---
  200 OK
  [Worklog, Worklog, ...]   // Array of Worklog objects

Only worklogs the user has permission to view are returned. Worklogs the user
cannot see are silently omitted (no error).

  400 Bad Request  -- More than 1000 IDs, or empty array
  401 Unauthorized

--- OAuth 2.0 (3LO) Scopes ---
  Classic:  read:jira-work
  Granular: read:issue-worklog:jira, read:issue-worklog.property:jira,
            read:avatar:jira, read:group:jira, read:project-role:jira,
            read:user:jira

--- Jira Permissions ---
  Browse projects (project-level) for each worklog's issue
  Visibility restrictions apply per worklog


================================================================================
7. GET IDs OF UPDATED WORKLOGS
================================================================================

GET /rest/api/3/worklog/updated

Returns IDs and update timestamps of worklogs updated (created or modified)
after a given time. Use this for incremental sync: poll periodically, then
call /worklog/list to get full details.

--- Query Parameters ---
  since          long     optional  default: 0      Unix timestamp in MILLISECONDS.
                                    Returns worklogs updated after this time.
  expand         string   optional  default: none   Values: "properties"

--- Response ---
  200 OK
  {
    "values": [                   // Array of ChangedWorklog objects
      {
        "worklogId":   integer,   // int64 -- worklog ID
        "updatedTime": integer,   // int64 -- Unix timestamp in ms of the update
        "properties":  EntityProperty[]  // only if expand=properties
      }
    ],
    "since":    integer,          // int64 -- timestamp of oldest item in this page
    "until":    integer,          // int64 -- timestamp of newest item in this page
    "self":     string,           // URL of this response
    "nextPage": string,           // URL of next page (absent on last page)
    "lastPage": boolean           // true if this is the last page
  }

Pagination: 1000 worklogs per page max. Follow "nextPage" URL until "lastPage" is true.

IMPORTANT: This endpoint does NOT return worklogs updated during the minute
preceding the request. Build in a ~60-second buffer when syncing.

  401 Unauthorized

--- OAuth 2.0 (3LO) Scopes ---
  Classic:  read:jira-work
  Granular: read:issue-worklog:jira, read:issue-worklog.property:jira

--- Jira Permissions ---
  None specific -- but worklogs are filtered by Browse projects + visibility


================================================================================
8. GET IDs OF DELETED WORKLOGS
================================================================================

GET /rest/api/3/worklog/deleted

Same structure as /worklog/updated but for deleted worklogs.

--- Query Parameters ---
  since          long     optional  default: 0      Unix timestamp in MILLISECONDS

--- Response ---
  200 OK
  {
    "values": [
      {
        "worklogId":   integer,   // int64
        "updatedTime": integer,   // int64 -- timestamp of deletion
        "properties":  EntityProperty[]
      }
    ],
    "since":    integer,
    "until":    integer,
    "self":     string,
    "nextPage": string,
    "lastPage": boolean
  }

Pagination: Same as /worklog/updated -- 1000 per page, follow nextPage.

IMPORTANT: Same ~60-second exclusion window as /worklog/updated.

  401 Unauthorized

--- OAuth 2.0 (3LO) Scopes ---
  Classic:  read:jira-work
  Granular: read:issue-worklog:jira, read:issue-worklog.property:jira

--- Jira Permissions ---
  None specific


================================================================================
9. BULK DELETE WORKLOGS
================================================================================

DELETE /rest/api/3/issue/{issueIdOrKey}/worklog

Deletes multiple worklogs from a single issue in one call.
This is a PERMANENT operation -- deleted worklogs CANNOT be restored.

--- Path Parameters ---
  issueIdOrKey   string   REQUIRED   Issue ID or key (source of the worklogs)

--- Query Parameters ---
  adjustEstimate       string   REQUIRED   How to adjust remaining estimate
                                           Valid values: "auto", "leave"
                                             "auto"  - reduce estimate by sum of timeSpent
                                             "leave" - leave estimate unchanged
                                           NOTE: "new" and "manual" are NOT supported for bulk delete

--- Request Body ---
{
  "ids": [integer]   // REQUIRED -- array of worklog IDs (int64)
                     // Maximum 5000 IDs per request
                     // All worklog IDs must belong to the specified issue
}

--- Response ---
  204 No Content    -- Successfully deleted
  400 Bad Request   -- Invalid input (IDs from wrong issue, etc.)
  401 Unauthorized
  404 Not Found     -- Issue not found

--- Side Effects ---
  - Issue change history IS updated
  - No email notifications are sent

--- OAuth 2.0 (3LO) Scopes ---
  Classic:  write:jira-work
  Granular: delete:issue-worklog:jira, write:issue.time-tracking:jira

--- Jira Permissions ---
  Browse projects (project-level)
  Delete all worklogs (project-level) to delete any worklog
    OR Delete own worklogs (project-level) for worklogs created by the user


================================================================================
10. BULK MOVE WORKLOGS
================================================================================

POST /rest/api/3/issue/{issueIdOrKey}/worklog/move

Moves multiple worklogs from one issue to another in one call.
Reversible by calling the same endpoint with source/destination swapped.

--- Path Parameters ---
  issueIdOrKey   string   REQUIRED   Source issue ID or key (where worklogs currently are)

--- Request Body ---
{
  "issueIdOrKey": string,    // REQUIRED -- destination issue ID or key
  "ids":          [integer]  // REQUIRED -- array of worklog IDs (int64) to move
                             // Maximum 5000 IDs per request
                             // All worklog IDs must belong to the source issue
}

--- Response ---
  204 No Content    -- Successfully moved
  400 Bad Request   -- Invalid input
  401 Unauthorized
  404 Not Found     -- Source or destination issue not found

--- Side Effects ---
  - Time-tracking fields are NOT updated on either issue
  - Issue change history is NOT updated
  - No email notifications are sent
  - Worklogs with attachments CANNOT be moved

--- OAuth 2.0 (3LO) Scopes ---
  Classic:  write:jira-work
  Granular: write:issue-worklog:jira

--- Jira Permissions ---
  Browse projects (project-level) for both source and destination issues
  Work on issues (project-level) for the destination issue
  Edit all worklogs or Edit own worklogs for the source issue


================================================================================
ADDITIONAL ENDPOINT: GET SINGLE WORKLOG (not in original list but exists)
================================================================================

Covered as endpoint #3 above.


================================================================================
OAUTH SCOPE SUMMARY
================================================================================

Classic scopes (recommended for simplicity):
  read:jira-work    -- all read operations (GET endpoints, POST /worklog/list)
  write:jira-work   -- all write operations (POST create, PUT update, DELETE, bulk ops)

Granular scopes:
  read:issue-worklog:jira             -- view worklogs
  write:issue-worklog:jira            -- create and update worklogs
  delete:issue-worklog:jira           -- delete worklogs
  read:issue-worklog.property:jira    -- view worklog properties
  write:issue-worklog.property:jira   -- create/update worklog properties
  delete:issue-worklog.property:jira  -- delete worklog properties
  write:issue.time-tracking:jira      -- modify time tracking (used by delete)
  read:avatar:jira                    -- read user avatars in response
  read:group:jira                     -- read group info (visibility)
  read:project-role:jira              -- read project role info (visibility)
  read:user:jira                      -- read user details in response

Scopes are only enforced for OAuth 2.0 (3LO) and Forge apps. Basic auth with
API tokens does not enforce scopes.


================================================================================
PERMISSION SUMMARY
================================================================================

Operation            Required Permission
---                  ---
Create worklog       Browse projects + Work on issues
Read worklogs        Browse projects (+ group/role for restricted worklogs)
Update worklog       Browse projects + Edit all worklogs (or Edit own worklogs)
Delete worklog       Browse projects + Delete all worklogs (or Delete own worklogs)
Bulk delete          Browse projects + Delete all worklogs (or Delete own worklogs)
Bulk move            Browse projects (both) + Work on issues (dest) + Edit worklogs (source)


================================================================================
overrideEditableFlag DEEP DIVE
================================================================================

What it does:
  When jira.issue.editable is false (e.g., issue is in a terminal workflow status
  like "Closed" or "Done"), normal worklog create/update/delete operations fail.
  Setting overrideEditableFlag=true bypasses this restriction.

Who can use it:
  - Connect apps with admin scope
  - Forge apps with appropriate admin-level permissions
  - Regular OAuth 2.0 (3LO) apps and basic auth users CANNOT use this flag

Available on:
  - POST (create worklog)
  - PUT (update worklog)
  - DELETE (single delete worklog)

Known issue (JRACLOUD-75862):
  There have been reports that overrideEditableFlag is not always respected
  when updating a worklog. Test this in your target environment.


================================================================================
adjustEstimate DEEP DIVE
================================================================================

The adjustEstimate parameter controls how the issue's "Remaining Estimate"
(timetracking.remainingEstimate) is modified when a worklog is created, updated,
or deleted.

For CREATE (POST) and UPDATE (PUT):
  "auto"   -- (default) Automatically reduces remaining estimate by timeSpentSeconds
  "leave"  -- Leave remaining estimate unchanged
  "new"    -- Set remaining estimate to the value of newEstimate query parameter
  "manual" -- Reduce remaining estimate by the value of reduceBy query parameter

For DELETE (single):
  "auto"   -- (default) Increases remaining estimate by the deleted worklog's timeSpent
  "leave"  -- Leave remaining estimate unchanged
  "new"    -- Set remaining estimate to newEstimate
  "manual" -- Increase remaining estimate by increaseBy query parameter
             (NOTE: parameter is "increaseBy" for delete, "reduceBy" for create/update)

For BULK DELETE:
  Only "auto" and "leave" are supported. "new" and "manual" are NOT available.


================================================================================
EXAMPLE: CREATE WORKLOG
================================================================================

POST /rest/api/3/issue/PROJ-123/worklog?adjustEstimate=auto&notifyUsers=false

{
  "timeSpentSeconds": 7200,
  "started": "2024-03-15T09:00:00.000+0000",
  "comment": {
    "version": 1,
    "type": "doc",
    "content": [
      {
        "type": "paragraph",
        "content": [
          {
            "type": "text",
            "text": "Implemented OAuth integration with Jira"
          }
        ]
      }
    ]
  },
  "visibility": {
    "type": "group",
    "identifier": "276f955c-63d7-42c8-9520-92d01dca0625"
  },
  "properties": [
    {
      "key": "com.example.app.source",
      "value": {
        "calendarEventId": "abc123",
        "syncedAt": "2024-03-15T10:00:00Z"
      }
    }
  ]
}


================================================================================
EXAMPLE: INCREMENTAL SYNC PATTERN
================================================================================

1. GET /rest/api/3/worklog/updated?since=1710460800000
   --> Returns { values: [{worklogId: 12345, updatedTime: ...}, ...], nextPage, lastPage }

2. Collect all worklogIds from all pages (follow nextPage until lastPage=true)

3. POST /rest/api/3/worklog/list?expand=properties
   Body: { "ids": [12345, 12346, ...] }   // max 1000 per call
   --> Returns full Worklog objects

4. Store the "until" timestamp from step 1 as your next "since" value

5. Also check /worklog/deleted?since=... to remove deleted worklogs from your cache


================================================================================
RATE LIMITS AND PRACTICAL NOTES
================================================================================

- Standard Jira Cloud rate limits apply (varies by plan, typically ~100 req/s)
- GET issue worklogs: max 1000 worklogs per page
- POST /worklog/list: max 1000 IDs per request
- GET /worklog/updated and /worklog/deleted: max 1000 items per page
- Bulk delete: max 5000 worklog IDs per request
- Bulk move: max 5000 worklog IDs per request
- Entity property value: max 32,768 characters
- Entity property key: max 255 characters
- /worklog/updated and /worklog/deleted exclude worklogs changed in the last ~60 seconds


================================================================================
SOURCES
================================================================================

- https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-worklogs/
- https://developer.atlassian.com/cloud/jira/platform/scopes-for-oauth-2-3LO-and-forge-apps/
- https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/
- https://developer.atlassian.com/cloud/jira/platform/jira-entity-properties/
- https://github.com/vinu/jira-cloud-rest-api/blob/master/docs/IssueWorklogsApi.md
- https://support.atlassian.com/jira/kb/runbook-bulk-delete-worklogs/
- https://support.atlassian.com/jira/kb/runbook-bulk-move-worklogs-in-jira-cloud/
- https://community.atlassian.com/forums/Jira-articles/Introducing-Bulk-Move-and-Bulk-Delete-Worklog-APIs/ba-p/2792183
- https://jira.atlassian.com/browse/JRACLOUD-75862
- https://jira.atlassian.com/browse/JRACLOUD-61378
