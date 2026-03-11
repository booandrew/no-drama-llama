import { useEffect, useRef } from 'react'

import { useCalendarStore } from '@/store/calendar'
import { useJiraStore } from '@/store/jira'
import { useTempoStore } from '@/store/tempo'

const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000 // 5 minutes

const isConnected = (status: string) =>
  status === 'connected' || status === 'done' || status === 'loading'

/**
 * Periodically health-checks all connected integrations.
 * Only runs when the tab is visible.
 * For Google Calendar, attempts silent GIS token renewal on expiry.
 */
export function useConnectionHealth() {
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)

  useEffect(() => {
    const runHealthChecks = () => {
      if (document.visibilityState !== 'visible') return

      const calStatus = useCalendarStore.getState().status
      const jiraStatus = useJiraStore.getState().status
      const tempoStatus = useTempoStore.getState().status

      if (isConnected(calStatus) || calStatus === 'expired') {
        useCalendarStore.getState().checkHealth()
      }
      if (isConnected(jiraStatus) || jiraStatus === 'expired') {
        useJiraStore.getState().checkHealth()
      }
      if (isConnected(tempoStatus) || tempoStatus === 'expired') {
        useTempoStore.getState().checkHealth()
      }
    }

    // Run initial health check after a short delay (status checks run first on hydration)
    const initialTimeout = setTimeout(runHealthChecks, 3000)

    intervalRef.current = setInterval(runHealthChecks, HEALTH_CHECK_INTERVAL)

    // Re-check when tab becomes visible after being hidden
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runHealthChecks()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearTimeout(initialTimeout)
      clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])
}

export type AggregateStatus = 'none' | 'healthy' | 'unhealthy'

/**
 * Returns an aggregate connection status for the indicator dot:
 * - 'none': zero connections configured
 * - 'healthy': all configured connections are working
 * - 'unhealthy': at least one configured connection is not working
 */
export function useAggregateConnectionStatus(): AggregateStatus {
  const calStatus = useCalendarStore((s) => s.status)
  const calHealth = useCalendarStore((s) => s.connectionHealth)
  const jiraStatus = useJiraStore((s) => s.status)
  const jiraHealth = useJiraStore((s) => s.connectionHealth)
  const tempoStatus = useTempoStore((s) => s.status)
  const tempoHealth = useTempoStore((s) => s.connectionHealth)

  const connections = [
    { status: calStatus, health: calHealth },
    { status: jiraStatus, health: jiraHealth },
    { status: tempoStatus, health: tempoHealth },
  ]

  const configured = connections.filter((c) => c.status !== 'idle')
  if (configured.length === 0) return 'none'

  const hasUnhealthy = configured.some(
    (c) =>
      c.health === 'unhealthy' ||
      c.status === 'error' ||
      c.status === 'expired',
  )
  return hasUnhealthy ? 'unhealthy' : 'healthy'
}
