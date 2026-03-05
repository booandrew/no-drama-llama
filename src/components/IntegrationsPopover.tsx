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
import { useGoogleCalendarConnect } from '@/hooks/use-google-calendar-connect'
import { useAppStore } from '@/store/app'

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
