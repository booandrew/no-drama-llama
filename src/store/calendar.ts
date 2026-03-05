import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type CalendarStatus = 'idle' | 'connected' | 'loading' | 'done' | 'error' | 'expired'

export interface CalendarEvent {
  id: string
  summary?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  status?: string
  eventType?: string
  attendees?: { email: string; responseStatus?: string }[]
}

export interface Period {
  year: number
  month: number
}

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

function currentPeriod(): Period {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() }
}

interface CalendarState {
  status: CalendarStatus
  accessToken: string | null
  expiresAt: number | null
  selectedPeriod: Period
  events: CalendarEvent[]
  eventsLoading: boolean

  setConnected: (accessToken: string, expiresIn: number) => void
  setStatus: (status: CalendarStatus) => void
  setExpired: () => void
  disconnect: () => void
  isTokenValid: () => boolean
  setSelectedPeriod: (period: Period) => void
  fetchEvents: () => Promise<void>
}

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set, get) => ({
      status: 'idle',
      accessToken: null,
      expiresAt: null,
      selectedPeriod: currentPeriod(),
      events: [],
      eventsLoading: false,

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
          events: [],
        }),

      isTokenValid: () => {
        const { expiresAt } = get()
        if (!expiresAt) return false
        return expiresAt > Date.now() + 60_000
      },

      setSelectedPeriod: (period) => set({ selectedPeriod: period }),

      fetchEvents: async () => {
        const { accessToken, selectedPeriod, isTokenValid, setExpired } = get()
        if (!accessToken || !isTokenValid()) {
          setExpired()
          return
        }

        set({ eventsLoading: true })
        try {
          const timeMin = new Date(selectedPeriod.year, selectedPeriod.month, 1)
          const timeMax = new Date(selectedPeriod.year, selectedPeriod.month + 1, 1)

          const allEvents: CalendarEvent[] = []
          let pageToken: string | undefined

          do {
            const params = new URLSearchParams({
              timeMin: timeMin.toISOString(),
              timeMax: timeMax.toISOString(),
              singleEvents: 'true',
              orderBy: 'startTime',
              maxResults: '250',
            })
            if (pageToken) params.set('pageToken', pageToken)

            const res = await fetch(`${CALENDAR_API}?${params}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            })

            if (!res.ok) {
              if (res.status === 401) {
                setExpired()
                return
              }
              throw new Error(`Calendar API error: ${res.status}`)
            }

            const data = await res.json()
            allEvents.push(...(data.items ?? []))
            pageToken = data.nextPageToken
          } while (pageToken)

          set({ events: allEvents, eventsLoading: false })
        } catch (err) {
          console.error('[Calendar] Fetch failed:', err)
          set({ eventsLoading: false })
        }
      },
    }),
    {
      name: 'gcal-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        expiresAt: state.expiresAt,
        selectedPeriod: state.selectedPeriod,
      }),
    },
  ),
)
