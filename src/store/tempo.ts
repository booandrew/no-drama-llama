import { create } from 'zustand'

import { logAction } from '@/store/activity-log'

type TempoStatus = 'idle' | 'connected' | 'error' | 'expired'
export type ConnectionHealth = 'unknown' | 'healthy' | 'unhealthy'

interface TempoHealthResponse {
  healthy: boolean
  code?: 'ok' | 'missing_scope' | 'expired' | 'invalid' | 'probe_failed'
  error?: string
  missingScopes?: string[]
  capabilities?: {
    userSchedule: boolean
    worklogs: boolean
  }
}

interface TempoState {
  status: TempoStatus
  connectionHealth: ConnectionHealth
  error: string | null
  _authChecked: boolean

  setToken: (token: string) => Promise<void>
  setStatus: (status: TempoStatus) => void
  setExpired: (message?: string) => void
  disconnect: () => Promise<void>
  checkAuthStatus: () => Promise<void>
  checkHealth: () => Promise<void>
}

export const useTempoStore = create<TempoState>()((set, get) => ({
  status: 'idle',
  connectionHealth: 'unknown',
  error: null,
  _authChecked: false,

  setToken: async (token) => {
    try {
      const res = await fetch('/tempo-api/.auth/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const data = (await res.json().catch(() => null)) as TempoHealthResponse | null
      if (!res.ok) {
        if (data?.code === 'expired' || data?.code === 'invalid') {
          set({
            status: 'expired',
            connectionHealth: 'unhealthy',
            error: data.error ?? 'Tempo token is invalid, expired, or revoked.',
          })
          return
        }
        throw new Error(data?.error ?? `Failed to validate Tempo token: ${res.status}`)
      }

      set({ status: 'connected', connectionHealth: 'healthy', error: null })
      logAction('connection', 'success', 'Connected to Tempo')
    } catch (e) {
      logAction('connection', 'error', 'Failed to connect to Tempo')
      set({ status: 'error', connectionHealth: 'unhealthy', error: (e as Error).message })
    }
  },

  setStatus: (status) => set({ status }),

  setExpired: (message) =>
    set({
      status: 'expired',
      connectionHealth: 'unhealthy',
      error:
        message ??
        'Tempo token is invalid, expired, or revoked. Generate a new one in Tempo Settings.',
    }),

  disconnect: async () => {
    logAction('connection', 'info', 'Disconnected from Tempo')
    try {
      await fetch('/tempo-api/.auth/disconnect', { method: 'DELETE' })
    } catch {
      // best-effort
    }
    set({ status: 'idle', connectionHealth: 'unknown', error: null })
  },

  checkAuthStatus: async () => {
    try {
      const res = await fetch('/tempo-api/.auth/status')
      if (!res.ok) return
      const data = await res.json()
      if (data.connected) {
        set({ status: 'connected', error: null })
        get().checkHealth()
      } else {
        set({ status: 'idle', connectionHealth: 'unknown', error: null })
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
      const res = await fetch('/tempo-api/.auth/health')
      if (!res.ok) return
      const data = (await res.json()) as TempoHealthResponse

      if (data.healthy) {
        set({ status: 'connected', connectionHealth: 'healthy', error: null })
        return
      }

      if (data.code === 'expired' || data.code === 'invalid') {
        get().setExpired(data.error)
        return
      }

      if (data.code === 'missing_scope') {
        set({
          status: 'error',
          connectionHealth: 'unhealthy',
          error:
            data.error ??
            'Tempo token is missing required scopes. Reconnect with Schemes (View) and Worklogs (View).',
        })
        return
      }

      set({
        connectionHealth: 'unhealthy',
        error: data.error ?? 'Tempo health check failed. Please try again.',
      })
    } catch {
      // network error — don't change state
    }
  },
}))

// Check auth status on app load
useTempoStore.getState().checkAuthStatus()
