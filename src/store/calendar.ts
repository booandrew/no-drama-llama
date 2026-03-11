import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { logAction, updateLogEntry } from '@/store/activity-log'

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
  _authChecked: boolean
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
      _authChecked: false,
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
          logAction('connection', 'success', 'Connected to Google Calendar')
        } catch (e) {
          console.error('[Calendar] Connect failed:', e)
          logAction('connection', 'error', 'Failed to connect to Google Calendar')
          set({ status: 'error', connectionHealth: 'unhealthy' })
        }
      },

      setPersonalClientId: (clientId) => set({ personalClientId: clientId }),

      setStatus: (status) => set({ status }),

      setExpired: () => set({ status: 'expired' }),

      disconnect: async () => {
        logAction('connection', 'info', 'Disconnected from Google Calendar')
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
        const logId = logAction('sync', 'pending', 'Syncing Google Calendar...')
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
                // Try silent GIS refresh before giving up
                const { trySilentGCalRefresh } = await import('@/hooks/use-google-calendar-connect')
                const refreshed = await trySilentGCalRefresh()
                if (refreshed) {
                  // Retry the same request with the now-fresh cookie
                  const retry = await fetch(`${CALENDAR_API}?${params}`)
                  if (retry.ok) {
                    const data = await retry.json()
                    allEvents.push(...(data.items ?? []))
                    pageToken = data.nextPageToken
                    continue
                  }
                }
                get().setExpired()
                set({ eventsLoading: false })
                updateLogEntry(logId, { status: 'error', message: 'Google Calendar token expired' })
                return
              }
              throw new Error(`Calendar API error: ${res.status}`)
            }

            const data = await res.json()
            allEvents.push(...(data.items ?? []))
            pageToken = data.nextPageToken
          } while (pageToken)

          set({ events: allEvents, eventsLoading: false })
          updateLogEntry(logId, {
            status: 'success',
            message: `Synced ${allEvents.length} events from Google Calendar`,
          })
        } catch (err) {
          console.error('[Calendar] Fetch failed:', err)
          updateLogEntry(logId, { status: 'error', message: 'Failed to sync Google Calendar' })
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
        } finally {
          set({ _authChecked: true })
        }
      },

      checkHealth: async () => {
        const { status } = get()
        if (status === 'idle') return
        try {
          const res = await fetch('/gcal-api/.auth/health')
          if (!res.ok) return
          const data = await res.json()
          if (data.healthy) {
            set({ connectionHealth: 'healthy' })
            const cur = get().status
            if (cur === 'expired' || cur === 'error') set({ status: 'connected' })
            return
          }

          // Token expired — attempt silent GIS refresh before marking unhealthy
          const { trySilentGCalRefresh } = await import('@/hooks/use-google-calendar-connect')
          const refreshed = await trySilentGCalRefresh()
          if (!refreshed) {
            set({ connectionHealth: 'unhealthy', status: 'expired' })
          }
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
