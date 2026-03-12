import { useCallback } from 'react'
import { useCalendarStore } from '@/store/calendar'
import type { CalendarAuthMethod } from '@/store/calendar'

const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly'

export function useGoogleCalendarConnect() {
  const { status, setConnected, setStatus, disconnect } = useCalendarStore()

  const connect = useCallback(
    (clientId: string, method: CalendarAuthMethod, clientSecret?: string, forceConsent?: boolean) => {
      if (!window.google?.accounts?.oauth2) return

      const codeClient = google.accounts.oauth2.initCodeClient({
        client_id: clientId,
        scope: SCOPES,
        ux_mode: 'popup',
        ...(forceConsent ? { prompt: 'consent' } : {}),
        callback: async (response) => {
          if (response.error) {
            setStatus('error')
            return
          }

          try {
            const res = await fetch('/gcal-auth/oauth/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                grant_type: 'authorization_code',
                code: response.code,
                client_id: clientId,
                redirect_uri: 'postmessage',
                ...(clientSecret ? { client_secret: clientSecret } : {}),
              }),
            })

            if (!res.ok) {
              console.error('[GCal] Token exchange failed:', res.status)
              setStatus('error')
              return
            }

            setConnected(method)
          } catch (e) {
            console.error('[GCal] Token exchange error:', e)
            setStatus('error')
          }
        },
        error_callback: () => {
          setStatus('error')
        },
      })

      codeClient.requestCode()
    },
    [setConnected, setStatus],
  )

  const isConnected = status === 'connected' || status === 'done' || status === 'loading'

  return { status, isConnected, connect, disconnect }
}
