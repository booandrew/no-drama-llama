# Google Calendar Session Persistence

## Problem

After connecting Google Calendar via OAuth, the connection state (access token) is lost on page reload because it's stored only in React refs (in-memory).

## Solution

Store the access token + expiration timestamp in `localStorage`. On page load, check if a valid token exists and restore the "connected" state without auto-fetching data.

## Decisions

- **Storage**: `localStorage` (survives tab close; user's choice over sessionStorage)
- **Token expiry handling**: Show "Token expired" + "Reconnect" button
- **After reload with valid token**: Show "Connected" + "Fetch Events" button (no auto-fetch to limit API calls)
- **Approach**: Minimal changes in App.tsx only (no new files/hooks/contexts)

## UI States

| State | Trigger | UI |
|-------|---------|-----|
| `idle` | No token in localStorage | "Connect Google Calendar" button |
| `connected` | Valid token restored from storage | "Connected" + "Fetch Events" button |
| `loading` | Fetching events | "Fetching events..." |
| `done` | Events loaded | "Connected — N events" + "Fetch Events" button |
| `error` | API error | "Error" message |
| `expired` | Token expired (TTL ~1 hour) | "Token expired" + "Reconnect" button |

## localStorage Format

Key: `gcal_token`

```typescript
interface StoredToken {
  access_token: string
  expires_at: number // Date.now() + expires_in * 1000
}
```

## Page Load Logic

```
Check localStorage('gcal_token')
├─ No token → status = 'idle'
├─ Token valid (expires_at > now + 60s) → status = 'connected'
└─ Token expired → clear storage, status = 'expired'
```

## Error Handling

- 401 from Calendar API → clear localStorage, status = 'expired'
- Other errors → status = 'error'

## Security Notes

- Scope is `calendar.readonly` — minimal risk if token is leaked
- Access token TTL is ~1 hour — short exposure window
- No backend available, so BFF pattern not applicable
- Google's own examples use localStorage for implicit flow tokens

## Scope

Changes only in `src/App.tsx`, ~40-50 lines modified.
