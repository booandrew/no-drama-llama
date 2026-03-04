Jira Cloud REST API — Getting User's Issues via OAuth 2.0

  OAuth 2.0 (3LO) Flow

  Steps:
  1. Authorize (https://auth.atlassian.com/authorize   )
  2. Token exchange/refresh (https://auth.atlassian.com/oauth/token   )
  3. Get cloud ID (GET https://api.atlassian.com/oauth/token/accessible-resources)

  Required scopes: read:jira-work read:jira-user offline_access

  Authorization URL params: audience=api.atlassian.com, client_id, scope, redirect_uri, state, response_type=code, prompt=consent

  Token exchange body:
  {
    "grant_type": "authorization_code",
    "client_id": "...",
    "client_secret": "...",
    "code": "...",
    "redirect_uri": "..."
  }

  Refresh tokens are rotating — each refresh returns a new one (90-day inactivity expiry).

  Important: After getting a token, call accessible-resources to get the cloudId needed for all API calls.

  ---
  Issue Search

  Endpoint: GET/POST https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/search/jql

  Note: The old /rest/api/3/search is deprecated. Use /search/jql.

  GET .../rest/api/3/search/jql
    ?jql=assignee=currentUser() ORDER BY updated DESC
    &fields=summary,status,project,timetracking,issuetype
    &maxResults=50

  Header: Authorization: Bearer {access_token}

  Pagination is token-based — response includes nextPageToken and isLast. No total count available; iterate until nextPageToken is absent.

  Key Response Shape

  {
    "issues": [{
      "key": "PROJ-123",
      "fields": {
        "summary": "Implement OAuth integration",
        "status": { "name": "In Progress", "statusCategory": { "name": "In Progress" } },
        "project": { "key": "PROJ", "name": "My Project" },
        "issuetype": { "name": "Story" },
        "timetracking": {
          "originalEstimate": "2d",
          "timeSpent": "4h",
          "remainingEstimate": "1d 4h"
        }
      }
    }],
    "nextPageToken": "...",
    "isLast": false
  }
