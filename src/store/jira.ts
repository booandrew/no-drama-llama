import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { fetchIssues } from '@/lib/jira'
import type { JiraIssue } from '@/lib/jira'
import { generateCodeChallenge, generateCodeVerifier } from '@/lib/pkce'
import { logAction, updateLogEntry } from '@/store/activity-log'

type JiraStatus = 'idle' | 'connected' | 'loading' | 'done' | 'error' | 'expired'
export type JiraAuthMethod = 'oauth-org' | 'token'
export type ConnectionHealth = 'unknown' | 'healthy' | 'unhealthy'

const JIRA_SCOPES = 'read:jira-work read:me offline_access'
const REDIRECT_URI = () => window.location.origin
const ORG_CLIENT_ID = import.meta.env.VITE_JIRA_CLIENT_ID as string | undefined

interface JiraState {
  status: JiraStatus
  authMethod: JiraAuthMethod
  cloudId: string | null
  accountId: string | null
  siteUrl: string | null
  connectionHealth: ConnectionHealth
  _authChecked: boolean
  expiresAt: number | null

  issues: JiraIssue[]
  loading: boolean
  error: string | null

  _hasHydrated: boolean
  setHydrated: () => void
  setStatus: (status: JiraStatus) => void
  disconnect: () => Promise<void>
  setExpired: () => void
  isTokenValid: () => boolean
  exchangeCode: (code: string) => Promise<void>
  startOAuth: () => Promise<void>
  connectWithToken: (siteUrl: string, email: string, apiToken: string) => Promise<void>
  checkAuthStatus: () => Promise<void>
  checkHealth: () => Promise<void>
  loadAll: () => Promise<void>
}

export const useJiraStore = create<JiraState>()(
  persist(
    (set, get) => ({
      status: 'idle',
      authMethod: 'oauth-org',
      cloudId: null,
      accountId: null,
      siteUrl: null,
      connectionHealth: 'unknown',
      _authChecked: false,
      expiresAt: null,

      _hasHydrated: false,
      setHydrated: () => set({ _hasHydrated: true }),

      issues: [],
      loading: false,
      error: null,

      setStatus: (status) => set({ status }),

      disconnect: async () => {
        try {
          await fetch('/jira-api/.auth/disconnect', { method: 'DELETE' })
        } catch {
          // best-effort
        }
        set({
          authMethod: 'oauth-org',
          cloudId: null,
          accountId: null,
          siteUrl: null,
          status: 'idle',
          connectionHealth: 'unknown',
          issues: [],
          error: null,
        })
        logAction('connection', 'info', 'Disconnected from Jira')
      },

      isTokenValid: () => {
        const { authMethod, expiresAt } = get()
        if (authMethod === 'token') return true
        if (!expiresAt) return false
        return expiresAt > Date.now() + 60_000
      },

      setExpired: () => set({ status: 'expired' }),

      startOAuth: async () => {
        if (!ORG_CLIENT_ID) return

        set({ authMethod: 'oauth-org' })

        const state = crypto.randomUUID()
        sessionStorage.setItem('jira_oauth_state', state)

        const codeVerifier = generateCodeVerifier()
        const codeChallenge = await generateCodeChallenge(codeVerifier)
        sessionStorage.setItem('jira_pkce_verifier', codeVerifier)

        const params = new URLSearchParams({
          audience: 'api.atlassian.com',
          client_id: ORG_CLIENT_ID,
          scope: JIRA_SCOPES,
          redirect_uri: REDIRECT_URI(),
          state,
          response_type: 'code',
          prompt: 'consent',
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
        })

        window.location.href = `https://auth.atlassian.com/authorize?${params}`
      },

      exchangeCode: async (code) => {
        if (!ORG_CLIENT_ID) return

        const codeVerifier = sessionStorage.getItem('jira_pkce_verifier')
        if (!codeVerifier) {
          set({ status: 'error', error: 'Missing PKCE code verifier' })
          return
        }
        sessionStorage.removeItem('jira_pkce_verifier')

        set({ status: 'loading' })
        const logId = logAction('connection', 'pending', 'Connecting to Jira...')
        try {
          const res = await fetch('/jira-auth/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              grant_type: 'authorization_code',
              client_id: ORG_CLIENT_ID,
              code,
              redirect_uri: REDIRECT_URI(),
              code_verifier: codeVerifier,
            }),
          })

          if (!res.ok) {
            const err = await res.text()
            throw new Error(`Token exchange failed: ${res.status} ${err}`)
          }

          const data = await res.json()
          set({
            cloudId: data.cloudId,
            accountId: data.accountId,
            authMethod: data.authMethod ?? 'oauth-org',
            status: 'connected',
            connectionHealth: 'healthy',
            error: null,
          })
          updateLogEntry(logId, { status: 'success', message: 'Connected to Jira via OAuth' })
        } catch (e) {
          console.error('[Jira] OAuth exchange failed:', e)
          updateLogEntry(logId, { status: 'error', message: 'Failed to connect to Jira' })
          set({ status: 'error', connectionHealth: 'unhealthy', error: (e as Error).message })
        }
      },

      connectWithToken: async (siteUrl, email, apiToken) => {
        set({ status: 'loading', error: null })
        try {
          const res = await fetch('/jira-auth/.auth/connect-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ siteUrl, email, apiToken }),
          })

          if (!res.ok) {
            const data = await res.json().catch(() => null)
            throw new Error(data?.error ?? `Auth failed: ${res.status}`)
          }

          const data = await res.json()
          set({
            authMethod: 'token',
            accountId: data.accountId,
            siteUrl: siteUrl,
            status: 'connected',
            connectionHealth: 'healthy',
            error: null,
          })
          logAction('connection', 'success', 'Connected to Jira via API token')
        } catch (e) {
          console.error('[Jira] API token connect failed:', e)
          logAction('connection', 'error', 'Failed to connect to Jira')
          set({ status: 'error', connectionHealth: 'unhealthy', error: (e as Error).message })
        }
      },

      checkAuthStatus: async () => {
        try {
          const res = await fetch('/jira-api/.auth/status')
          if (!res.ok) return
          const data = await res.json()
          if (data.connected) {
            set({
              status: 'connected',
              authMethod: data.authMethod ?? 'oauth-org',
              accountId: data.accountId ?? null,
              cloudId: data.cloudId ?? null,
              siteUrl: data.siteUrl ?? null,
            })
            get().checkHealth()
          } else {
            set({ status: 'idle', connectionHealth: 'unknown' })
          }
        } catch {
          // offline or not deployed yet — keep current state
        } finally {
          set({ _authChecked: true })
        }
      },

      checkHealth: async () => {
        const { status } = get()
        if (status === 'idle') return
        try {
          const res = await fetch('/jira-api/.auth/health')
          if (!res.ok) return
          const data = await res.json()
          set({ connectionHealth: data.healthy ? 'healthy' : 'unhealthy' })
          if (!data.healthy) set({ status: 'expired' })
        } catch {
          // network error — don't change state
        }
      },

      loadAll: async () => {
        set({ loading: true, error: null })
        const logId = logAction('sync', 'pending', 'Syncing Jira issues...')
        try {
          const issues = await fetchIssues()
          set({ issues, loading: false })
          updateLogEntry(logId, {
            status: 'success',
            message: `Loaded ${issues.length} Jira issues`,
          })
        } catch (e) {
          if ((e as Error).message.includes('401') || (e as Error).message.includes('expired')) {
            get().setExpired()
          }
          set({ error: (e as Error).message, loading: false })
          updateLogEntry(logId, { status: 'error', message: 'Failed to sync Jira issues' })
        }
      },
    }),
    {
      name: 'jira-storage',
      partialize: (state) => ({
        authMethod: state.authMethod,
        cloudId: state.cloudId,
        accountId: state.accountId,
        siteUrl: state.siteUrl,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (!error) state?.setHydrated()
        // Check server-side auth status instead of inspecting tokens
        state?.checkAuthStatus()
      },
    },
  ),
)
