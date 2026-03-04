import { useCallback, useEffect, useRef, useState } from 'react'

import llamaSvg from '@/assets/llama-svgrepo-com.svg'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string
const SCOPES = 'https://www.googleapis.com/auth/calendar.events.readonly'
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
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const tokenClientRef = useRef<google.accounts.oauth2.TokenClient | null>(null)
  const accessTokenRef = useRef<string | null>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(interval)
        tokenClientRef.current = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (response) => {
            if (response.error) {
              console.error('[GIS] Token error:', response)
              setStatus('error')
              return
            }
            accessTokenRef.current = response.access_token
            console.log('[GIS] Got access token')
            fetchEvents(response.access_token)
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
          throw new Error(`Calendar API error: ${res.status} ${res.statusText}`)
        }

        const data = await res.json()
        allEvents.push(...(data.items ?? []))
        pageToken = data.nextPageToken
      } while (pageToken)

      console.log(`[Calendar] Fetched ${allEvents.length} events:`, allEvents)
      setEvents(allEvents)
      setStatus('done')
    } catch (err) {
      console.error('[Calendar] Fetch failed:', err)
      setStatus('error')
    }
  }, [])

  const handleConnect = () => {
    if (!tokenClientRef.current) {
      console.error('[GIS] Token client not initialized yet')
      return
    }
    tokenClientRef.current.requestAccessToken()
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col items-center gap-6 p-8">
      <img src={llamaSvg} alt="Llama" className="h-32 w-32" />

      <button
        onClick={handleConnect}
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-6 py-2 text-sm font-medium"
      >
        Connect Google Calendar
      </button>

      <p className="text-muted-foreground text-sm">
        {status === 'idle' && 'Not connected'}
        {status === 'loading' && 'Fetching events...'}
        {status === 'done' && `Connected — ${events.length} events`}
        {status === 'error' && 'Error — check console'}
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
