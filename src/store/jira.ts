import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { fetchIssues, fetchProjects } from '@/lib/jira'
import type { JiraIssue, JiraProject } from '@/lib/jira'

type JiraStatus = 'idle' | 'connected' | 'loading' | 'done' | 'error' | 'expired'

const JIRA_SCOPES = 'read:jira-work offline_access'
const REDIRECT_URI = () => window.location.origin

interface JiraState {
  status: JiraStatus
  clientId: string | null
  clientSecret: string | null
  accessToken: string | null
  refreshToken: string | null
  expiresAt: number | null
  cloudId: string | null

  projects: JiraProject[]
  issues: JiraIssue[]
  loading: boolean
  error: string | null

  setCredentials: (clientId: string, clientSecret: string) => void
  setStatus: (status: JiraStatus) => void
  disconnect: () => void
  isTokenValid: () => boolean
  setExpired: () => void
  exchangeCode: (code: string) => Promise<void>
  refreshAccessToken: () => Promise<boolean>
  startOAuth: () => void
  loadAll: () => Promise<void>
}

export const useJiraStore = create<JiraState>()(
  persist(
    (set, get) => ({
      status: 'idle',
      clientId: null,
      clientSecret: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      cloudId: null,

      projects: [],
      issues: [],
      loading: false,
      error: null,

      setCredentials: (clientId, clientSecret) => set({ clientId, clientSecret }),

      setStatus: (status) => set({ status }),

      disconnect: () =>
        set({
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
          cloudId: null,
          status: 'idle',
          projects: [],
          issues: [],
          error: null,
        }),

      isTokenValid: () => {
        const { expiresAt } = get()
        if (!expiresAt) return false
        return expiresAt > Date.now() + 60_000
      },

      setExpired: () =>
        set({
          accessToken: null,
          expiresAt: null,
          status: 'expired',
        }),

      startOAuth: () => {
        const { clientId } = get()
        if (!clientId) return

        const state = crypto.randomUUID()
        sessionStorage.setItem('jira_oauth_state', state)

        const params = new URLSearchParams({
          audience: 'api.atlassian.com',
          client_id: clientId,
          scope: JIRA_SCOPES,
          redirect_uri: REDIRECT_URI(),
          state,
          response_type: 'code',
          prompt: 'consent',
        })

        window.location.href = `https://auth.atlassian.com/authorize?${params}`
      },

      exchangeCode: async (code) => {
        const { clientId, clientSecret } = get()
        if (!clientId || !clientSecret) return

        set({ status: 'loading' })
        try {
          const tokenRes = await fetch('/jira-auth/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              grant_type: 'authorization_code',
              client_id: clientId,
              client_secret: clientSecret,
              code,
              redirect_uri: REDIRECT_URI(),
            }),
          })

          if (!tokenRes.ok) {
            const err = await tokenRes.text()
            throw new Error(`Token exchange failed: ${tokenRes.status} ${err}`)
          }

          const tokenData = await tokenRes.json()
          const { access_token, refresh_token, expires_in } = tokenData

          // Get cloud ID from accessible resources
          const resourcesRes = await fetch('/jira-api/oauth/token/accessible-resources', {
            headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json' },
          })

          if (!resourcesRes.ok) {
            throw new Error(`Accessible resources failed: ${resourcesRes.status}`)
          }

          const resources = await resourcesRes.json()
          if (!resources.length) {
            throw new Error('No accessible Jira sites found')
          }

          const cloudId = resources[0].id

          set({
            accessToken: access_token,
            refreshToken: refresh_token,
            expiresAt: Date.now() + expires_in * 1000,
            cloudId,
            status: 'connected',
            error: null,
          })
        } catch (e) {
          console.error('[Jira] OAuth exchange failed:', e)
          set({ status: 'error', error: (e as Error).message })
        }
      },

      refreshAccessToken: async () => {
        const { clientId, clientSecret, refreshToken } = get()
        if (!clientId || !clientSecret || !refreshToken) {
          get().setExpired()
          return false
        }

        try {
          const res = await fetch('/jira-auth/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              grant_type: 'refresh_token',
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: refreshToken,
            }),
          })

          if (!res.ok) {
            get().setExpired()
            return false
          }

          const data = await res.json()
          set({
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + data.expires_in * 1000,
            status: 'connected',
          })
          return true
        } catch {
          get().setExpired()
          return false
        }
      },

      loadAll: async () => {
        const { isTokenValid, refreshAccessToken, setExpired } = get()

        if (!isTokenValid()) {
          const refreshed = await refreshAccessToken()
          if (!refreshed) {
            setExpired()
            return
          }
        }

        set({ loading: true, error: null })
        try {
          const projects = await fetchProjects()
          const issues = await fetchIssues(projects.map((p) => p.key))
          set({ projects, issues, loading: false })
        } catch (e) {
          set({ error: (e as Error).message, loading: false })
        }
      },
    }),
    {
      name: 'jira-storage',
      partialize: (state) => ({
        clientId: state.clientId,
        clientSecret: state.clientSecret,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        expiresAt: state.expiresAt,
        cloudId: state.cloudId,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state?.accessToken) return
        if (state.isTokenValid()) {
          state.setStatus('connected')
        } else if (state.refreshToken) {
          state.refreshAccessToken()
        } else {
          state.setExpired()
        }
      },
    },
  ),
)
