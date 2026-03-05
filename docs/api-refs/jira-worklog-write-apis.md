Jira Cloud REST API v3 (Native Worklogs)

  Base URL: https://{instance}.atlassian.net/rest/api/3

  - Create — POST /issue/{issueIdOrKey}/worklog
  - Read all for issue — GET /issue/{issueIdOrKey}/worklog
  - Update — PUT /issue/{issueIdOrKey}/worklog/{id}
  - Delete — DELETE /issue/{issueIdOrKey}/worklog/{id}
  - Bulk read by IDs — POST /worklog/list
  - Get updated IDs — GET /worklog/updated?since=
  - Get deleted IDs — GET /worklog/deleted?since=
  - Bulk delete (all on issue) — DELETE /issue/{key}/worklog
  - Bulk move — POST /issue/{key}/worklog/move

IMPORTANT:
  - Hard limit: 20 writes per 2s / 100 writes per 30s per issue.
  - Email notifications — sent by default (notifyUsers=true) on Create, Update, Delete;
    ALWAYS USE notifyUsers=false to suppress. Bulk delete and Bulk move never send notifications.
  - timetracking.remainingEstimate — modified according to adjustEstimate (default "auto"):
    ALWAYS pass ?adjustEstimate=leave&notifyUsers=false on any worklog edit call (Create/Up date/Delete)!
