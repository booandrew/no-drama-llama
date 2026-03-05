import { useEffect, useRef } from 'react'
import { useCalendarStore } from '@/store/calendar'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly'

export function useGoogleCalendarConnect() {
  const { status, accessToken, setConnected, setStatus, setExpired, disconnect, isTokenValid } =
    useCalendarStore()
  const tokenClientRef = useRef<google.accounts.oauth2.TokenClient | null>(null)

  useEffect(() => {
    if (accessToken) {
      if (isTokenValid()) {
        setStatus('connected')
      } else {
        setExpired()
      }
    }
  }, [])

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
            setConnected(response.access_token, Number(response.expires_in) || 3600)
          },
          error_callback: () => {
            setStatus('error')
          },
        })
      }
    }, 100)
    return () => clearInterval(interval)
  }, [])

  const connect = () => {
    tokenClientRef.current?.requestAccessToken()
  }

  const isConnected = status === 'connected' || status === 'done' || status === 'loading'

  return { status, isConnected, connect, disconnect }
}
