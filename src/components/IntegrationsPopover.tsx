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
import { TempoConnectDialog } from '@/components/TempoConnectDialog'
import { useGoogleCalendarConnect } from '@/hooks/use-google-calendar-connect'
import { useAppStore } from '@/store/app'
import { useCalendarStore } from '@/store/calendar'
import { useJiraStore } from '@/store/jira'
import { useTempoStore } from '@/store/tempo'

const isConnectedStatus = (status: string) =>
  status === 'connected' || status === 'done' || status === 'loading'

export function IntegrationsPopover() {
  const integrations = useAppStore((s) => s.integrations)
  const toggleIntegration = useAppStore((s) => s.toggleIntegration)
  const { status: calStatus, authMethod, disconnect: calDisconnect } = useCalendarStore()
  const { status: jiraStatus, authMethod: jiraAuthMethod, disconnect: jiraDisconnect } =
    useJiraStore()
  const { status: tempoStatus, disconnect: tempoDisconnect } = useTempoStore()
  const [gcalDialogOpen, setGcalDialogOpen] = useState(false)
  const [jiraDialogOpen, setJiraDialogOpen] = useState(false)
  const [tempoDialogOpen, setTempoDialogOpen] = useState(false)

  const isCalConnected = isConnectedStatus(calStatus)
  const isJiraConnected = isConnectedStatus(jiraStatus)
  const isTempoConnected = isConnectedStatus(tempoStatus)

  const authLabel = authMethod === 'org' ? 'T1A' : authMethod === 'personal' ? 'Personal' : ''
  const jiraLabel = jiraAuthMethod === 'token' ? 'Token' : 'OAuth'

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
                  {jiraLabel} Connected
                </Badge>
              ) : (
                <Button variant="outline" size="xs" onClick={() => setJiraDialogOpen(true)}>
                  Connect
                </Button>
              )}
            </div>

            {/* Tempo */}
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm font-medium">Tempo</span>
              {isTempoConnected ? (
                <Badge
                  variant="secondary"
                  className="cursor-pointer select-none"
                  onClick={tempoDisconnect}
                >
                  Connected
                </Badge>
              ) : (
                <Button variant="outline" size="xs" onClick={() => setTempoDialogOpen(true)}>
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
      <TempoConnectDialog open={tempoDialogOpen} onOpenChange={setTempoDialogOpen} />
    </>
  )
}
