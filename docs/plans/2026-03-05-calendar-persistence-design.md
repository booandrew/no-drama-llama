# Google Calendar Session Persistence — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist Google Calendar OAuth connection across page reloads using Zustand store with persist middleware.

**Architecture:** Create a dedicated Zustand store (`src/store/calendar.ts`) with `persist` middleware that stores `{ accessToken, expiresAt }` in localStorage. On page load, Zustand automatically restores state. App.tsx reads from store and shows "Connected" state with a manual "Fetch Events" button. Token expiry is checked on mount and on fetch attempts.

**Tech Stack:** React 19, TypeScript 5.9, Zustand 5 with persist middleware, Google Identity Services (GIS) Token Model

---

## Design Reference

### UI States

| State | Trigger | UI |
|-------|---------|-----|
| `idle` | No token in store | "Connect Google Calendar" button |
| `connected` | Valid token restored from store | "Connected" + "Fetch Events" button |
| `loading` | Fetching events | "Fetching events..." |
| `done` | Events loaded | "Connected — N events" + "Fetch Events" button |
| `error` | API error | "Error" message |
| `expired` | Token expired (TTL ~1 hour) | "Token expired" + "Reconnect" button |

### localStorage Key

`gcal-storage` (managed by Zustand persist middleware)

---

## Task 1: Create Zustand calendar store with persist middleware

**Files:**
- Create: `src/store/calendar.ts`

**Step 1: Create the store**

Create `src/store/calendar.ts`:

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type CalendarStatus = 'idle' | 'connected' | 'loading' | 'done' | 'error' | 'expired'

interface CalendarState {
  status: CalendarStatus
  accessToken: string | null
  expiresAt: number | null

  setConnected: (accessToken: string, expiresIn: number) => void
  setStatus: (status: CalendarStatus) => void
  setExpired: () => void
  disconnect: () => void
  isTokenValid: () => boolean
}

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set, get) => ({
      status: 'idle',
      accessToken: null,
      expiresAt: null,

      setConnected: (accessToken, expiresIn) =>
        set({
          accessToken,
          expiresAt: Date.now() + expiresIn * 1000,
          status: 'connected',
        }),

      setStatus: (status) => set({ status }),

      setExpired: () =>
        set({
          accessToken: null,
          expiresAt: null,
          status: 'expired',
        }),

      disconnect: () =>
        set({
          accessToken: null,
          expiresAt: null,
          status: 'idle',
        }),

      isTokenValid: () => {
        const { expiresAt } = get()
        if (!expiresAt) return false
        return expiresAt > Date.now() + 60_000
      },
    }),
    {
      name: 'gcal-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        expiresAt: state.expiresAt,
      }),
    },
  ),
)
```

Key details:
- `partialize` persists only `accessToken` and `expiresAt` — status is transient
- `isTokenValid()` checks expiry with 60-second buffer
- `setExpired()` clears token data and sets status
- On hydration, Zustand restores `accessToken` and `expiresAt` from localStorage; `status` defaults to `'idle'` (handled in Task 2)

**Step 2: Verify build**

Run: `pnpm build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/store/calendar.ts
git commit -m "feat: add Zustand calendar store with persist middleware"
```

---

## Task 2: Refactor App.tsx to use calendar store

**Files:**
- Modify: `src/App.tsx`

**Step 1: Replace local state with store**

Replace the full `App.tsx` content with:

```typescript
import { useCallback, useEffect, useRef } from 'react'

import llamaSvg from '@/assets/llama-svgrepo-com.svg'
import { useCalendarStore } from '@/store/calendar'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly'
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

interface CalendarEvent {
  id: string
  summary?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  status?: string
  eventType?: string
  attendees?: { email: string; responseStatus?: string }[]
}

function App() {
  const { status, accessToken, setConnected, setStatus, setExpired, isTokenValid } =
    useCalendarStore()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const tokenClientRef = useRef<google.accounts.oauth2.TokenClient | null>(null)

  // On mount: check if restored token is still valid
  useEffect(() => {
    if (accessToken) {
      if (isTokenValid()) {
        setStatus('connected')
      } else {
        setExpired()
      }
    }
  }, [])

  // Initialize GIS token client
  useEffect(() => {
    const interval = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(interval)
        tokenClientRef.current = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (response) => {
            if (response.error) {
              setStatus('error')
              return
            }
            setConnected(response.access_token, response.expires_in ?? 3600)
            fetchEvents(response.access_token)
          },
          error_callback: () => {
            setStatus('error')
          },
        })
      }
    }, 100)
    return () => clearInterval(interval)
  }, [])

  const fetchEvents = useCallback(async (token: string) => {
    setStatus('loading')
    try {
      const now = new Date()
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      const allEvents: CalendarEvent[] = []
      let pageToken: string | undefined

      do {
        const params = new URLSearchParams({
          timeMin: weekAgo.toISOString(),
          timeMax: now.toISOString(),
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: '250',
        })
        if (pageToken) params.set('pageToken', pageToken)

        const res = await fetch(`${CALENDAR_API}?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!res.ok) {
          if (res.status === 401) {
            setExpired()
            return
          }
          throw new Error(`Calendar API error: ${res.status} ${res.statusText}`)
        }

        const data = await res.json()
        allEvents.push(...(data.items ?? []))
        pageToken = data.nextPageToken
      } while (pageToken)

      setEvents(allEvents)
      setStatus('done')
    } catch (err) {
      console.error('[Calendar] Fetch failed:', err)
      setStatus('error')
    }
  }, [])

  const handleConnect = () => {
    if (!tokenClientRef.current) return
    tokenClientRef.current.requestAccessToken()
  }

  const handleFetchEvents = () => {
    if (!accessToken || !isTokenValid()) {
      setExpired()
      return
    }
    fetchEvents(accessToken)
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col items-center gap-6 p-8">
      <img src={llamaSvg} alt="Llama" className="h-32 w-32" />

      {(status === 'idle' || status === 'expired') && (
        <button
          onClick={handleConnect}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-6 py-2 text-sm font-medium"
        >
          {status === 'expired' ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
        </button>
      )}

      {(status === 'connected' || status === 'done') && (
        <button
          onClick={handleFetchEvents}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-6 py-2 text-sm font-medium"
        >
          Fetch Events
        </button>
      )}

      <p className="text-muted-foreground text-sm">
        {status === 'idle' && 'Not connected'}
        {status === 'connected' && 'Connected — click Fetch Events to load data'}
        {status === 'loading' && 'Fetching events...'}
        {status === 'done' && `Connected — ${events.length} events`}
        {status === 'error' && 'Error — check console'}
        {status === 'expired' && 'Token expired — please reconnect'}
      </p>

      {events.length > 0 && (
        <div className="w-full">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="text-muted-foreground px-3 py-2 font-medium">Time</th>
                <th className="text-muted-foreground px-3 py-2 font-medium">Event</th>
                <th className="text-muted-foreground px-3 py-2 font-medium">Duration</th>
                <th className="text-muted-foreground px-3 py-2 font-medium">Type</th>
                <th className="text-muted-foreground px-3 py-2 font-medium">Attendees</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const start = event.start?.dateTime ?? event.start?.date ?? ''
                const end = event.end?.dateTime ?? event.end?.date ?? ''
                const s = start ? new Date(start) : null
                const e = end ? new Date(end) : null
                const diffMin = s && e ? Math.round((e.getTime() - s.getTime()) / 60000) : 0
                const h = Math.floor(diffMin / 60)
                const m = diffMin % 60
                const duration = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`

                return (
                  <tr key={event.id} className="border-border border-b">
                    <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">
                      {s
                        ? s.toLocaleString('ru', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="px-3 py-2 font-medium">{event.summary ?? '(no title)'}</td>
                    <td className="text-muted-foreground px-3 py-2">{duration}</td>
                    <td className="text-muted-foreground px-3 py-2">{event.eventType ?? '—'}</td>
                    <td className="text-muted-foreground px-3 py-2">
                      {event.attendees?.length ?? 0}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default App
```

Note: `useState` import is needed for `events` — add it to the import line:
```typescript
import { useCallback, useEffect, useRef, useState } from 'react'
```

**Step 2: Verify build**

Run: `pnpm build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: refactor App.tsx to use Zustand calendar store for persistence"
```

---

## Task 3: Manual verification in browser

**Step 1: Start dev server**

Run: `pnpm dev`

**Step 2: Test the full flow**

1. Open app → see "Connect Google Calendar" + "Not connected"
2. Click "Connect Google Calendar" → OAuth popup → events load → see table
3. Open DevTools → Application → Local Storage → look for `gcal-storage` key with `accessToken` and `expiresAt`
4. Reload page (F5) → see "Connected — click Fetch Events to load data" + "Fetch Events" button (NOT "Connect Google Calendar")
5. Click "Fetch Events" → events reload
6. Delete `gcal-storage` from DevTools → reload → see "Connect Google Calendar" (idle state)

**Step 3: Final commit (if adjustments needed)**

```bash
git add src/App.tsx src/store/calendar.ts
git commit -m "fix: adjust calendar persistence after manual testing"
```
