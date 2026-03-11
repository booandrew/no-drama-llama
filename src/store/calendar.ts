import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { logAction } from '@/store/activity-log'

type CalendarStatus = 'idle' | 'connected' | 'loading' | 'done' | 'error' | 'expired'
export type CalendarAuthMethod = 'org' | 'personal'
export type ConnectionHealth = 'unknown' | 'healthy' | 'unhealthy'

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

const CALENDAR_API = '/gcal-api/calendar/v3/calendars/primary/events'

function currentPeriod(): Period {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() }
}

interface CalendarState {
  status: CalendarStatus
  authMethod: CalendarAuthMethod | null
  personalClientId: string | null
  connectionHealth: ConnectionHealth
  selectedPeriod: Period
  events: CalendarEvent[]
  eventsLoading: boolean

  setConnected: (accessToken: string, expiresIn: number, method: CalendarAuthMethod) => void
  setPersonalClientId: (clientId: string) => void
  setStatus: (status: CalendarStatus) => void
  setExpired: () => void
  disconnect: () => Promise<void>
  setSelectedPeriod: (period: Period) => void
  fetchEvents: () => Promise<void>
  checkAuthStatus: () => Promise<void>
  checkHealth: () => Promise<void>
}

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set, get) => ({
      status: 'idle',
      authMethod: null,
      personalClientId: null,
      connectionHealth: 'unknown',
      selectedPeriod: currentPeriod(),
      events: [],
      eventsLoading: false,

      setConnected: async (accessToken, expiresIn, method) => {
        try {
          const res = await fetch('/gcal-api/.auth/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken, expiresIn, authMethod: method }),
          })
          if (!res.ok) throw new Error(`Failed to store token: ${res.status}`)
          set({ authMethod: method, status: 'connected', connectionHealth: 'healthy' })
        } catch (e) {
          console.error('[Calendar] Connect failed:', e)
          set({ status: 'error', connectionHealth: 'unhealthy' })
        }
      },

      setPersonalClientId: (clientId) => set({ personalClientId: clientId }),

      setStatus: (status) => set({ status }),

      setExpired: () => set({ status: 'expired' }),

      disconnect: async () => {
        try {
          await fetch('/gcal-api/.auth/disconnect', { method: 'DELETE' })
        } catch {
          // best-effort
        }
        set({
          authMethod: null,
          personalClientId: null,
          status: 'idle',
          connectionHealth: 'unknown',
          events: [],
        })
      },

      setSelectedPeriod: (period) => set({ selectedPeriod: period }),

      fetchEvents: async () => {
        const { selectedPeriod, status } = get()
        if (status !== 'connected' && status !== 'done' && status !== 'loading') {
          return
        }

        set({ eventsLoading: true })
        logAction('sync', 'pending', 'Syncing Google Calendar...')
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

            const res = await fetch(`${CALENDAR_API}?${params}`)

            if (!res.ok) {
              if (res.status === 401) {
                get().setExpired()
                set({ eventsLoading: false })
                logAction('sync', 'error', 'Google Calendar token expired')
                return
              }
              throw new Error(`Calendar API error: ${res.status}`)
            }

            const data = await res.json()
            allEvents.push(...(data.items ?? []))
            pageToken = data.nextPageToken
          } while (pageToken)

          set({ events: allEvents, eventsLoading: false })
          logAction('sync', 'success', `Synced ${allEvents.length} events from Google Calendar`)
        } catch (err) {
          console.error('[Calendar] Fetch failed:', err)
          logAction('sync', 'error', 'Failed to sync Google Calendar')
          set({ eventsLoading: false })
        }
      },

      checkAuthStatus: async () => {
        try {
          const res = await fetch('/gcal-api/.auth/status')
          if (!res.ok) return
          const data = await res.json()
          if (data.connected) {
            set({
              status: 'connected',
              authMethod: data.authMethod ?? null,
            })
            get().checkHealth()
          } else {
            set({ status: 'idle', connectionHealth: 'unknown' })
          }
        } catch {
          // offline or not deployed yet
        }
      },

      checkHealth: async () => {
        const { status } = get()
        if (status === 'idle') return
        try {
          const res = await fetch('/gcal-api/.auth/health')
          if (!res.ok) return
          const data = await res.json()
          set({ connectionHealth: data.healthy ? 'healthy' : 'unhealthy' })
          if (!data.healthy) set({ status: 'expired' })
        } catch {
          // network error — don't change state
        }
      },
    }),
    {
      name: 'gcal-storage',
      partialize: (state) => ({
        authMethod: state.authMethod,
        personalClientId: state.personalClientId,
        selectedPeriod: state.selectedPeriod,
      }),
      onRehydrateStorage: () => (state) => {
        state?.checkAuthStatus()
      },
    },
  ),
)
