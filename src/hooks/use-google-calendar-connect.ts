import { useEffect, useRef } from 'react'
import { useCalendarStore } from '@/store/calendar'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly'

export function useGoogleCalendarConnect() {
  const { status, setConnected, setStatus, disconnect } = useCalendarStore()
  const tokenClientRef = useRef<google.accounts.oauth2.TokenClient | null>(null)

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
            setConnected(response.access_token, Number(response.expires_in) || 3600, 'org')
          },
          error_callback: () => {
            setStatus('error')
          },
        })
      }
    }, 100)
    return () => clearInterval(interval)
  }, [setConnected, setStatus])

  const connect = () => {
    tokenClientRef.current?.requestAccessToken()
  }

  const isConnected = status === 'connected' || status === 'done' || status === 'loading'

  return { status, isConnected, connect, disconnect }
}
