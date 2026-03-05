import { useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'

import llamaAvatarSvg from '@/assets/73897352_JEMA LUIS 283-03.svg'
import { AppHeader } from '@/components/AppHeader'
import { LandingPage } from '@/components/LandingPage'
import { CustomInputsTab } from '@/components/CustomInputsTab'
import { MappingsTab } from '@/components/MappingsTab'
import { LlamaTimeTab, LlamaTimeToolbar } from '@/components/LlamaTimeTab'
import { SourcesTab } from '@/components/SourcesTab'
import { WoolInsightsTab } from '@/components/WoolInsightsTab'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { durationToMinutes } from '@/lib/duration'
import { useDuckDB } from '@/lib/duckdb'
import { getLatestDataMonth } from '@/lib/duckdb/latest-data-month'
import { mockDdsTasks } from '@/lib/mock-data'
import type { DdsTask } from '@/lib/duckdb/queries'
import { useAppStore } from '@/store/app'
import { useCalendarStore } from '@/store/calendar'
import { useCustomInputsStore } from '@/store/custom-inputs'
import { useJiraStore } from '@/store/jira'
import { useSourcesStore } from '@/store/sources'

function useOAuthCallback(
  sessionKey: string,
  exchangeCode: (code: string) => Promise<void>,
  isRehydrated: boolean,
) {
  useEffect(() => {
    if (!isRehydrated) return

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const savedState = sessionStorage.getItem(sessionKey)

    if (!code || !state || state !== savedState) return

    sessionStorage.removeItem(sessionKey)
    window.history.replaceState({}, '', window.location.pathname)

    exchangeCode(code)
  }, [sessionKey, exchangeCode, isRehydrated])
}

function LlamaSidebar() {
  const totalHours = 160
  const [logged, setLogged] = useState(142)
  const pct = Math.round((logged / totalHours) * 100)

  const randomize = () => {
    setLogged(Math.floor(Math.random() * (totalHours + 1)))
  }

  return (
    <Card className="self-stretch overflow-hidden">
      <CardContent className="flex flex-1 flex-col items-center gap-3 p-4">
        <button
          onClick={randomize}
          className="cursor-pointer rounded-xl bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-md transition-transform hover:scale-105 active:scale-95"
        >
          <RefreshCw className="inline size-3.5" /> {logged}h / {totalHours}h logged
        </button>
        <div
          className="relative flex w-full flex-1 items-center justify-center"
          role="img"
          aria-label="Llama Avatar"
        >
          <div className="relative">
            {/* Greyscale layer (unfilled) */}
            <img
              src={llamaAvatarSvg}
              alt=""
              className="block max-h-full w-full opacity-30 grayscale"
            />
            {/* Colored layer (filled from bottom) */}
            <img
              src={llamaAvatarSvg}
              alt=""
              className="absolute inset-0 block max-h-full w-full transition-[clip-path] duration-700 ease-in-out"
              style={{ clipPath: `inset(${100 - pct}% 0 0 0)` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SummaryCard() {
  const isMockMode = useAppStore((s) => s.isMockMode)
  const selectedPeriod = useCalendarStore((s) => s.selectedPeriod)

  const tasks = useMemo<DdsTask[]>(() => {
    if (!isMockMode) return []
    const start = new Date(selectedPeriod.year, selectedPeriod.month, 1).toISOString()
    const end = new Date(selectedPeriod.year, selectedPeriod.month + 1, 1).toISOString()
    return mockDdsTasks.filter((t) => t.start_time && t.start_time >= start && t.start_time < end)
  }, [isMockMode, selectedPeriod.year, selectedPeriod.month])

  const totalMinutes = useMemo(
    () => tasks.reduce((sum, t) => sum + durationToMinutes(t.duration), 0),
    [tasks],
  )

  // Per-project aggregation
  const projectStats = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of tasks) {
      const key = t.project_key ?? 'Unassigned'
      map.set(key, (map.get(key) ?? 0) + durationToMinutes(t.duration))
    }
    return Array.from(map.entries())
      .map(([project, minutes]) => ({
        project,
        minutes,
        pct: totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 100) : 0,
      }))
      .sort((a, b) => b.minutes - a.minutes)
  }, [tasks, totalMinutes])

  // Per-issue aggregation
  const issueStats = useMemo(() => {
    const map = new Map<string, { name: string; minutes: number }>()
    for (const t of tasks) {
      const key = t.issue_key ?? 'Unassigned'
      const existing = map.get(key)
      if (existing) {
        existing.minutes += durationToMinutes(t.duration)
      } else {
        map.set(key, {
          name: t.issue_name ?? 'No issue',
          minutes: durationToMinutes(t.duration),
        })
      }
    }
    return Array.from(map.entries())
      .map(([issue, data]) => ({
        issue,
        name: data.name,
        minutes: data.minutes,
        pct: totalMinutes > 0 ? Math.round((data.minutes / totalMinutes) * 100) : 0,
      }))
      .sort((a, b) => b.minutes - a.minutes)
  }, [tasks, totalMinutes])

  const formatDuration = (min: number) => {
    const h = Math.floor(min / 60)
    const m = min % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }

  return (
    <Card className="flex-1 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle>Summary</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="project" className="gap-0">
          <TabsList className="mx-4 mb-2 w-auto">
            <TabsTrigger value="project">By Project</TabsTrigger>
            <TabsTrigger value="issue">By Issue</TabsTrigger>
          </TabsList>
          <TabsContent value="project" className="px-4 pb-4">
            <ul className="space-y-1.5 text-sm">
              {projectStats.map((s) => (
                <li key={s.project} className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{s.project}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {formatDuration(s.minutes)} ({s.pct}%)
                  </span>
                </li>
              ))}
              {projectStats.length === 0 && (
                <li className="text-muted-foreground">No tasks</li>
              )}
            </ul>
          </TabsContent>
          <TabsContent value="issue" className="max-h-60 overflow-y-auto px-4 pb-4">
            <ul className="space-y-1.5 text-sm">
              {issueStats.map((s) => (
                <li key={s.issue} className="flex items-center justify-between gap-2">
                  <div className="min-w-0 shrink">
                    <span className="font-medium">{s.issue}</span>
                    {s.issue !== 'Unassigned' && (
                      <span className="ml-1 truncate text-xs text-muted-foreground">
                        {s.name}
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-muted-foreground">
                    {formatDuration(s.minutes)} ({s.pct}%)
                  </span>
                </li>
              ))}
              {issueStats.length === 0 && (
                <li className="text-muted-foreground">No tasks</li>
              )}
            </ul>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function App() {
  const activeTab = useAppStore((s) => s.activeTab)
  const isMockMode = useAppStore((s) => s.isMockMode)
  const jiraExchangeCode = useJiraStore((s) => s.exchangeCode)
  const jiraHydrated = useJiraStore((s) => s._hasHydrated)
  useOAuthCallback('jira_oauth_state', jiraExchangeCode, jiraHydrated)

  const [page, setPage] = useState(() => (window.location.hash === '#app' ? 'app' : 'landing'))

  const goToApp = () => {
    window.location.hash = '#app'
    setPage('app')
  }

  useEffect(() => {
    const onHash = () => setPage(window.location.hash === '#app' ? 'app' : 'landing')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const { isReady: isDuckDbReady } = useDuckDB()
  const hasAutoSelected = useRef(false)

  useEffect(() => {
    if (hasAutoSelected.current) return
    if (!isMockMode && !isDuckDbReady) return

    hasAutoSelected.current = true

    getLatestDataMonth(isMockMode).then((period) => {
      const now = new Date()
      const isCurrentMonth = period.year === now.getFullYear() && period.month === now.getMonth()
      if (isCurrentMonth) return

      // Calendar store: only override if still on current month (user hasn't changed it)
      const calPeriod = useCalendarStore.getState().selectedPeriod
      if (calPeriod.year === now.getFullYear() && calPeriod.month === now.getMonth()) {
        useCalendarStore.getState().setSelectedPeriod(period)
      }

      // Sources & custom inputs: always set (not persisted, resets on reload)
      const firstDay = `${period.year}-${String(period.month + 1).padStart(2, '0')}-01`
      useSourcesStore.getState().setSelectedDate(firstDay)
      useCustomInputsStore.getState().setSelectedDate(firstDay)
    })
  }, [isMockMode, isDuckDbReady])

  if (page === 'landing') {
    return <LandingPage onEnterApp={goToApp} />
  }

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <AppHeader />
      <main className="flex flex-1 flex-col overflow-y-auto px-6 pt-6">
        {activeTab === 'llama-time' && (
          <div className="flex flex-1 flex-col gap-4 min-h-0">
            <LlamaTimeToolbar />
            <div className="grid flex-1 min-h-0 grid-cols-[280px_minmax(0,1fr)_280px] grid-rows-[minmax(0,1fr)] gap-4">
              {/* Left sidebar */}
              <LlamaSidebar />

              {/* Center — chart */}
              <LlamaTimeTab />

              {/* Right sidebar */}
              <div className="flex flex-col gap-4">
                <SummaryCard />
                <Card className="flex-1">
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Submit to Jira, auto-fill gaps, export CSV — coming soon.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'sources' && <SourcesTab />}
        {activeTab === 'custom-inputs' && <CustomInputsTab />}
        {activeTab === 'mappings' && <MappingsTab />}
        {activeTab === 'wool-insights' && <WoolInsightsTab />}
        {activeTab === 'logs-history' && (
          <div className="text-muted-foreground text-sm">Logs History content</div>
        )}
      </main>
    </div>
  )
}

export default App
