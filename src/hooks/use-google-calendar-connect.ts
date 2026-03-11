import { useEffect, useRef } from 'react'
import { useCalendarStore } from '@/store/calendar'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly'

/**
 * Shared GIS token client — initialised once by `useGoogleCalendarConnect`,
 * reused by `trySilentGCalRefresh` for background renewal.
 */
let sharedTokenClient: google.accounts.oauth2.TokenClient | null = null

/**
 * Attempt a silent (no-popup) token refresh via Google Identity Services.
 * Returns `true` if the refresh succeeded, `false` otherwise.
 */
export function trySilentGCalRefresh(): Promise<boolean> {
  if (!sharedTokenClient) return Promise.resolve(false)

  return new Promise((resolve) => {
    // GIS calls the callback/error_callback configured at init time,
    // but we need a one-shot result here — so we wrap in a timeout.
    const timeout = setTimeout(() => resolve(false), 10_000)

    // `prompt: ''` skips the consent popup (works when user already granted)
    try {
      sharedTokenClient!.requestAccessToken({ prompt: '' })
    } catch {
      clearTimeout(timeout)
      resolve(false)
      return
    }

    // Listen for the store change that setConnected triggers
    const unsub = useCalendarStore.subscribe((state, prev) => {
      if (state.status === 'connected' && prev.status !== 'connected') {
        clearTimeout(timeout)
        unsub()
        resolve(true)
      }
      if (state.status === 'error') {
        clearTimeout(timeout)
        unsub()
        resolve(false)
      }
    })
  })
}

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
        sharedTokenClient = tokenClientRef.current
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
