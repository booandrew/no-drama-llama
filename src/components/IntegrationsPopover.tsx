import { useRef, useState } from 'react'
import { Blocks, Settings2 } from 'lucide-react'

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

export function IntegrationsPopover() {
  const calStatus = useCalendarStore((s) => s.status)
  const calHealth = useCalendarStore((s) => s.connectionHealth)
  const jiraStatus = useJiraStore((s) => s.status)
  const jiraHealth = useJiraStore((s) => s.connectionHealth)
  const tempoStatus = useTempoStore((s) => s.status)
  const tempoHealth = useTempoStore((s) => s.connectionHealth)
  const [manageOpen, setManageOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleMouseEnter = () => {
    clearTimeout(closeTimeoutRef.current)
    setDropdownOpen(true)
  }

  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => setDropdownOpen(false), 150)
  }

  const statusLabel = (status: string) => {
    if (status === 'idle') return 'Not connected'
    if (status === 'expired') return 'Expired'
    if (status === 'error') return 'Error'
    return 'Connected'
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
            <div className="mb-3 flex flex-col gap-1 text-sm">
              <div className="font-medium">Integrations</div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="flex items-center gap-2">
                  <StatusDot health={calHealth} status={calStatus} />
                  <span className="text-sm font-medium">Google Calendar</span>
                </div>
                <span className="text-xs text-muted-foreground">{statusLabel(calStatus)}</span>
              </div>

              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="flex items-center gap-2">
                  <StatusDot health={jiraHealth} status={jiraStatus} />
                  <span className="text-sm font-medium">Jira</span>
                </div>
                <span className="text-xs text-muted-foreground">{statusLabel(jiraStatus)}</span>
              </div>

              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="flex items-center gap-2">
                  <StatusDot health={tempoHealth} status={tempoStatus} />
                  <span className="text-sm font-medium">Tempo</span>
                </div>
                <span className="text-xs text-muted-foreground">{statusLabel(tempoStatus)}</span>
              </div>

              <div className="mt-2 border-t pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={() => {
                    setDropdownOpen(false)
                    setManageOpen(true)
                  }}
                >
                  <Settings2 className="size-4" />
                  Manage Connections
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ManageConnectionsDialog open={manageOpen} onOpenChange={setManageOpen} />
    </>
  )
}
