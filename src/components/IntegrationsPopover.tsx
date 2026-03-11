import { useRef, useState } from 'react'
import { Blocks, Loader2, Settings2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ManageConnectionsDialog } from '@/components/ManageConnectionsDialog'
import { useAggregateConnectionStatus } from '@/hooks/use-connection-health'
import { useCalendarStore } from '@/store/calendar'
import type { ConnectionHealth } from '@/store/calendar'
import { useJiraStore } from '@/store/jira'
import { useTempoStore } from '@/store/tempo'

function StatusDot({ health, status }: { health: ConnectionHealth; status: string }) {
  if (status === 'idle') {
    return <span className="inline-block size-2 shrink-0 rounded-full bg-muted-foreground/40" />
  }
  const isUnhealthy =
    health === 'unhealthy' || status === 'error' || status === 'expired'
  const color = isUnhealthy ? 'bg-red-500' : 'bg-green-500'
  return <span className={`inline-block size-2 shrink-0 rounded-full ${color}`} />
}

function AggregateStatusDot() {
  const aggregate = useAggregateConnectionStatus()
  if (aggregate === 'none') {
    return <span className="inline-block size-2 rounded-full bg-muted-foreground/40" />
  }
  const color = aggregate === 'unhealthy' ? 'bg-red-500' : 'bg-green-500'
  return <span className={`inline-block size-2 rounded-full ${color}`} />
}

function isBroken(status: string, health: ConnectionHealth) {
  return health === 'unhealthy' || status === 'error' || status === 'expired'
}

interface ActionButtonProps {
  status: string
  health: ConnectionHealth
  onConnect: () => void
  onDisconnect: () => void
  onReconnect: () => void
}

function ActionButton({ status, health, onConnect, onDisconnect, onReconnect }: ActionButtonProps) {
  if (status === 'loading') {
    return (
      <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" disabled>
        <Loader2 className="size-3 animate-spin" />
      </Button>
    )
  }
  if (status === 'idle') {
    return (
      <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={onConnect}>
        Connect
      </Button>
    )
  }
  if (isBroken(status, health)) {
    return (
      <Button variant="default" size="sm" className="h-7 px-2.5 text-xs" onClick={onReconnect}>
        Re-connect
      </Button>
    )
  }
  return (
    <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs" onClick={onDisconnect}>
      Disconnect
    </Button>
  )
}

export function IntegrationsPopover() {
  const calStatus = useCalendarStore((s) => s.status)
  const calHealth = useCalendarStore((s) => s.connectionHealth)
  const calDisconnect = useCalendarStore((s) => s.disconnect)
  const jiraStatus = useJiraStore((s) => s.status)
  const jiraHealth = useJiraStore((s) => s.connectionHealth)
  const jiraDisconnect = useJiraStore((s) => s.disconnect)
  const tempoStatus = useTempoStore((s) => s.status)
  const tempoHealth = useTempoStore((s) => s.connectionHealth)
  const tempoDisconnect = useTempoStore((s) => s.disconnect)
  const [manageOpen, setManageOpen] = useState(false)
  const [manageTab, setManageTab] = useState<string | undefined>()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleMouseEnter = () => {
    clearTimeout(closeTimeoutRef.current)
    setDropdownOpen(true)
  }

  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => setDropdownOpen(false), 150)
  }

  const openDialog = (tab: string) => {
    setDropdownOpen(false)
    setManageTab(tab)
    setManageOpen(true)
  }

  return (
    <>
      <div
        className="relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Button variant="outline" size="sm" className="gap-1.5">
          <Blocks className="size-4" />
          Integrations
          <AggregateStatusDot />
        </Button>
        {dropdownOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md">
            <div className="mb-3 text-sm font-medium">Integrations</div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="flex items-center gap-2">
                  <StatusDot health={calHealth} status={calStatus} />
                  <span className="text-sm font-medium">Google Calendar</span>
                </div>
                <ActionButton
                  status={calStatus}
                  health={calHealth}
                  onConnect={() => openDialog('gcal')}
                  onDisconnect={calDisconnect}
                  onReconnect={() => openDialog('gcal')}
                />
              </div>

              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="flex items-center gap-2">
                  <StatusDot health={jiraHealth} status={jiraStatus} />
                  <span className="text-sm font-medium">Jira</span>
                </div>
                <ActionButton
                  status={jiraStatus}
                  health={jiraHealth}
                  onConnect={() => openDialog('jira')}
                  onDisconnect={jiraDisconnect}
                  onReconnect={() => openDialog('jira')}
                />
              </div>

              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="flex items-center gap-2">
                  <StatusDot health={tempoHealth} status={tempoStatus} />
                  <span className="text-sm font-medium">Tempo</span>
                </div>
                <ActionButton
                  status={tempoStatus}
                  health={tempoHealth}
                  onConnect={() => openDialog('tempo')}
                  onDisconnect={tempoDisconnect}
                  onReconnect={() => openDialog('tempo')}
                />
              </div>

              <div className="mt-2 border-t pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={() => openDialog('gcal')}
                >
                  <Settings2 className="size-4" />
                  Manage Connections
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ManageConnectionsDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        defaultTab={manageTab}
      />
    </>
  )
}
