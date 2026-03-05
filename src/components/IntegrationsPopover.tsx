import { useEffect, useRef } from 'react'
import { Blocks } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useAppStore } from '@/store/app'
import { useCalendarStore } from '@/store/calendar'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly'

function useGoogleCalendarConnect() {
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

export function IntegrationsPopover() {
  const integrations = useAppStore((s) => s.integrations)
  const toggleIntegration = useAppStore((s) => s.toggleIntegration)
  const { isConnected, connect, disconnect } = useGoogleCalendarConnect()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Blocks className="size-4" />
          Integrations
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <PopoverHeader className="mb-3">
          <PopoverTitle>Integrations</PopoverTitle>
        </PopoverHeader>
        <div className="flex flex-col gap-2">
          {/* Google Calendar — real integration */}
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <span className="text-sm font-medium">Google Calendar</span>
            {isConnected ? (
              <Badge
                variant="secondary"
                className="cursor-pointer select-none"
                onClick={disconnect}
              >
                Connected
              </Badge>
            ) : (
              <Button variant="outline" size="xs" onClick={connect}>
                Connect
              </Button>
            )}
          </div>

          {/* Mock integrations */}
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <span className="text-sm font-medium">{integration.name}</span>
              {integration.connected ? (
                <Badge
                  variant="secondary"
                  className="cursor-pointer select-none"
                  onClick={() => toggleIntegration(integration.id)}
                >
                  Connected
                </Badge>
              ) : (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => toggleIntegration(integration.id)}
                >
                  Connect
                </Button>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
