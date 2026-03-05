import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { fetchIssues } from '@/lib/jira'
import type { JiraIssue } from '@/lib/jira'

type JiraStatus = 'idle' | 'connected' | 'loading' | 'done' | 'error' | 'expired'
export type JiraAuthMethod = 'oauth' | 'token'

const JIRA_SCOPES = 'read:jira-work read:me offline_access'
const REDIRECT_URI = () => window.location.origin

interface JiraState {
  status: JiraStatus
  authMethod: JiraAuthMethod
  clientId: string | null
  clientSecret: string | null
  accessToken: string | null
  refreshToken: string | null
  expiresAt: number | null
  cloudId: string | null
  accountId: string | null

  // API token auth fields
  siteUrl: string | null
  email: string | null
  apiToken: string | null

  issues: JiraIssue[]
  loading: boolean
  error: string | null

  _hasHydrated: boolean
  setHydrated: () => void
  setCredentials: (clientId: string, clientSecret: string) => void
  setStatus: (status: JiraStatus) => void
  disconnect: () => void
  isTokenValid: () => boolean
  setExpired: () => void
  exchangeCode: (code: string) => Promise<void>
  refreshAccessToken: () => Promise<boolean>
  startOAuth: () => void
  connectWithToken: (siteUrl: string, email: string, apiToken: string) => Promise<void>
  loadAll: () => Promise<void>
}

export const useJiraStore = create<JiraState>()(
  persist(
    (set, get) => ({
      status: 'idle',
      authMethod: 'oauth',
      clientId: null,
      clientSecret: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      cloudId: null,
      accountId: null,

      siteUrl: null,
      email: null,
      apiToken: null,

      _hasHydrated: false,
      setHydrated: () => set({ _hasHydrated: true }),

      issues: [],
      loading: false,
      error: null,

      setCredentials: (clientId, clientSecret) => set({ clientId, clientSecret }),

      setStatus: (status) => set({ status }),

      disconnect: () =>
        set({
          authMethod: 'oauth',
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
          cloudId: null,
          accountId: null,
          siteUrl: null,
          email: null,
          apiToken: null,
          status: 'idle',
          issues: [],
          error: null,
        }),

      isTokenValid: () => {
        const { authMethod, expiresAt } = get()
        if (authMethod === 'token') return true
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

          // Fetch current user's accountId (currentUser() doesn't work with OAuth 2.0 3LO)
          const meRes = await fetch('/jira-api/me', {
            headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json' },
          })
          if (!meRes.ok) {
            throw new Error(`Failed to fetch Jira user: ${meRes.status}`)
          }
          const me = await meRes.json()

          set({
            accessToken: access_token,
            refreshToken: refresh_token,
            expiresAt: Date.now() + expires_in * 1000,
            cloudId,
            accountId: me.account_id,
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

      connectWithToken: async (siteUrl, email, apiToken) => {
        set({ status: 'loading', error: null })
        try {
          const basicAuth = btoa(`${email}:${apiToken}`)
          const res = await fetch(`/jira-site/rest/api/3/myself`, {
            headers: {
              Authorization: `Basic ${basicAuth}`,
              Accept: 'application/json',
              'X-Jira-Host': siteUrl,
            },
          })
          if (!res.ok) {
            const text = await res.text()
            throw new Error(`Auth failed: ${res.status} ${text}`)
          }
          const me = await res.json()
          set({
            authMethod: 'token',
            siteUrl,
            email,
            apiToken,
            accountId: me.accountId,
            status: 'connected',
            error: null,
          })
        } catch (e) {
          console.error('[Jira] API token connect failed:', e)
          set({ status: 'error', error: (e as Error).message })
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
          const issues = await fetchIssues()
          set({ issues, loading: false })
        } catch (e) {
          set({ error: (e as Error).message, loading: false })
        }
      },
    }),
    {
      name: 'jira-storage',
      partialize: (state) => ({
        authMethod: state.authMethod,
        clientId: state.clientId,
        clientSecret: state.clientSecret,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        expiresAt: state.expiresAt,
        cloudId: state.cloudId,
        accountId: state.accountId,
        siteUrl: state.siteUrl,
        email: state.email,
        apiToken: state.apiToken,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (!error) state?.setHydrated()
        if (state?.authMethod === 'token') {
          if (state.apiToken && state.email && state.siteUrl) {
            state.setStatus('connected')
          }
          return
        }
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
