import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  Info,
  Loader2,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDuckDB } from '@/lib/duckdb/use-duckdb'
import { useActivityLogStore, type ActionStatus } from '@/store/activity-log'

function statusIcon(status: ActionStatus) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
    case 'error':
      return <XCircle className="size-3.5 shrink-0 text-red-500" />
    case 'info':
      return <Info className="size-3.5 shrink-0 text-blue-500" />
    case 'pending':
      return <Loader2 className="size-3.5 shrink-0 animate-spin text-amber-500" />
  }
}

function timeAgo(date: Date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h`
}

export function ActivityLogCard() {
  const entries = useActivityLogStore((s) => s.entries)
  const loadEntries = useActivityLogStore((s) => s.loadEntries)
  const { isReady } = useDuckDB()
  const [expanded, setExpanded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [, setTick] = useState(0)

  // Load persisted entries from DuckDB once ready
  useEffect(() => {
    if (isReady) loadEntries()
  }, [isReady, loadEntries])

  // Update relative times every 30s
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries.length])

  const visibleEntries = expanded ? entries : entries.slice(-5)

  if (!expanded) {
    return (
      <Card className="flex-1 gap-0 py-0">
        <CardHeader className="shrink-0 px-4 py-3">
          <div className="flex items-center justify-between">
            <CardTitle>Activity Log</CardTitle>
            <button
              onClick={() => setExpanded(true)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Expand activity log"
            >
              <Maximize2 className="size-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No actions yet — start by connecting an integration.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {visibleEntries.map((entry) => (
                <li key={entry.id} className="flex items-start gap-2 text-xs">
                  {statusIcon(entry.status)}
                  <span className="min-w-0 flex-1 truncate">{entry.message}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {timeAgo(entry.timestamp)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="absolute inset-0 z-10 flex flex-col gap-0 py-0">
      <CardHeader className="shrink-0 px-4 py-3">
        <div className="flex items-center justify-between">
          <CardTitle>Activity Log</CardTitle>
          <button
            onClick={() => setExpanded(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Collapse activity log"
          >
            <Minimize2 className="size-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-3">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No actions yet — start by connecting an integration.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-start gap-2 text-xs">
                {statusIcon(entry.status)}
                <span className="min-w-0 flex-1">{entry.message}</span>
                <span className="shrink-0 text-muted-foreground">
                  {timeAgo(entry.timestamp)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
