  Google recommends using the Google Identity Services (GIS) library rather than raw OAuth endpoints for browser apps.

  Flow:
  1. Register app in Google Cloud Console, enable Calendar API, create OAuth 2.0 credentials (Web application type)
  2. Load the GIS library: <script src="https://accounts.google.com/gsi/client"></script>
  3. Request a token with the scope https://www.googleapis.com/auth/calendar.events.readonly
  4. Token comes back in-memory — store it in browser (our app is fully client-side, so this fits)

  Key scope: calendar.events.readonly — read-only access to events is all we need for timesheet data.

  Events.list Endpoint

  GET https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events

  Critical params for timesheet use:
    - calendarId = "primary" — User's main calendar
    - timeMin = RFC3339 datetime — Start of timesheet period
    - timeMax = RFC3339 datetime — End of timesheet period
    - singleEvents = true — Expands recurring events into individual instances
    - orderBy = "startTime" — Chronological order (requires singleEvents=true)
    - maxResults = up to 2500 — Paginate with nextPageToken

  What Matters for Timesheet Mapping

  For our AI-powered mapping to Jira Tempo, the most useful fields are:

  - summary + description — AI parses these to match Jira issues (e.g. "PROJ-123 review" or "sprint planning")
  - start.dateTime / end.dateTime — duration calculation for time logging
  - attendees — context clues (meeting with QA team → testing work)
  - eventType — filter out birthday, outOfOffice; keep default and focusTime
  - transparency — skip transparent events (FYI items, not actual time spent)
  - status — skip cancelled events
  - responseStatus on the user's attendee entry — skip declined events

  The pagination via nextPageToken / nextSyncToken means we can do incremental sync after the initial fetch — only pulling changed events, which is
  efficient for repeated timesheet runs.
