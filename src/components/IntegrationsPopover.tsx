import { useState } from 'react'
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
import { GoogleCalendarConnectDialog } from '@/components/GoogleCalendarConnectDialog'
import { JiraConnectDialog } from '@/components/JiraConnectDialog'
import { useGoogleCalendarConnect } from '@/hooks/use-google-calendar-connect'
import { useAppStore } from '@/store/app'
import { useCalendarStore } from '@/store/calendar'
import { useJiraStore } from '@/store/jira'

export function IntegrationsPopover() {
  const integrations = useAppStore((s) => s.integrations)
  const toggleIntegration = useAppStore((s) => s.toggleIntegration)
  const { status: calStatus, authMethod, disconnect: calDisconnect } = useCalendarStore()
  const { status: jiraStatus, disconnect: jiraDisconnect } = useJiraStore()
  const [gcalDialogOpen, setGcalDialogOpen] = useState(false)
  const [jiraDialogOpen, setJiraDialogOpen] = useState(false)

  const isCalConnected = calStatus === 'connected' || calStatus === 'done' || calStatus === 'loading'
  const isJiraConnected =
    jiraStatus === 'connected' || jiraStatus === 'done' || jiraStatus === 'loading'

  const authLabel = authMethod === 'org' ? 'T1A' : authMethod === 'personal' ? 'Personal' : ''

  return (
    <>
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
            {/* Google Calendar */}
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm font-medium">Google Calendar</span>
              {isCalConnected ? (
                <Badge
                  variant="secondary"
                  className="cursor-pointer select-none"
                  onClick={calDisconnect}
                >
                  {authLabel} Connected
                </Badge>
              ) : (
                <Button variant="outline" size="xs" onClick={() => setGcalDialogOpen(true)}>
                  Connect
                </Button>
              )}
            </div>

            {/* Jira */}
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm font-medium">Jira</span>
              {isJiraConnected ? (
                <Badge
                  variant="secondary"
                  className="cursor-pointer select-none"
                  onClick={jiraDisconnect}
                >
                  Connected
                </Badge>
              ) : (
                <Button variant="outline" size="xs" onClick={() => setJiraDialogOpen(true)}>
                  Connect
                </Button>
              )}
            </div>

            {/* Other mock integrations (Git, etc.) */}
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

      <GoogleCalendarConnectDialog open={gcalDialogOpen} onOpenChange={setGcalDialogOpen} />
      <JiraConnectDialog open={jiraDialogOpen} onOpenChange={setJiraDialogOpen} />
    </>
  )
}
