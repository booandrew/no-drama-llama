import { useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Bar, BarChart, Cell, XAxis, YAxis } from 'recharts'

import llamaAvatarSvg from '@/assets/73897352_JEMA LUIS 283-03.svg'
import { AppHeader } from '@/components/AppHeader'
import { LandingPage } from '@/components/LandingPage'
import { CustomInputsTab } from '@/components/CustomInputsTab'

import { MappingsTab } from '@/components/MappingsTab'
import { LlamaTimeTab, LlamaTimeToolbar } from '@/components/LlamaTimeTab'
import { SourcesTab } from '@/components/SourcesTab'
import { ActivityLogCard } from '@/components/QuickActionsCard'
import { WoolInsightsTab } from '@/components/WoolInsightsTab'

import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getProjectTotals, PROJECT_COLORS } from '@/components/insights/mock-data'
import { useConnectionHealth } from '@/hooks/use-connection-health'
import { useAppStore } from '@/store/app'
import { useCalendarStore } from '@/store/calendar'
import { useJiraStore } from '@/store/jira'

const summaryChartConfig = {
  hours: { label: 'Hours', color: 'var(--chart-1)' },
} satisfies ChartConfig

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

const MOCK_ISSUES = [
  { name: 'PROJ-A-101', hours: 18, color: 'var(--chart-1)' },
  { name: 'PROJ-A-204', hours: 14, color: 'var(--chart-1)' },
  { name: 'PROJ-B-55', hours: 12, color: 'var(--chart-2)' },
  { name: 'PROJ-C-78', hours: 10, color: 'var(--chart-3)' },
  { name: 'PROJ-A-310', hours: 9, color: 'var(--chart-1)' },
  { name: 'PROJ-B-42', hours: 8, color: 'var(--chart-2)' },
  { name: 'PROJ-D-12', hours: 7, color: 'var(--chart-4)' },
  { name: 'PROJ-E-3', hours: 5, color: 'var(--chart-5)' },
]

function SummaryCard() {
  const [view, setView] = useState<'projects' | 'issues'>('projects')
  const selectedPeriod = useCalendarStore((s) => s.selectedPeriod)
  const projectData = useMemo(
    () => getProjectTotals('month', selectedPeriod.month),
    [selectedPeriod.month],
  )

  const chartData =
    view === 'projects'
      ? projectData.map((d) => ({ name: d.project, hours: d.hours, color: PROJECT_COLORS[d.project] ?? 'var(--chart-1)' }))
      : MOCK_ISSUES

  return (
    <Card className="flex flex-1 flex-col gap-0 py-0">
      <CardHeader className="shrink-0 px-4 py-3">
        <div className="flex items-center justify-between">
          <CardTitle>Summary</CardTitle>
          <div className="flex rounded-full border p-0.5 text-xs">
            <button
              onClick={() => setView('projects')}
              className="rounded-full px-2.5 py-0.5 font-medium transition-colors"
              style={
                view === 'projects'
                  ? { backgroundColor: 'var(--foreground)', color: 'var(--background)' }
                  : { color: 'var(--muted-foreground)' }
              }
            >
              Projects
            </button>
            <button
              onClick={() => setView('issues')}
              className="rounded-full px-2.5 py-0.5 font-medium transition-colors"
              style={
                view === 'issues'
                  ? { backgroundColor: 'var(--foreground)', color: 'var(--background)' }
                  : { color: 'var(--muted-foreground)' }
              }
            >
              Issues
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col px-4 pb-3">
        <div className="min-h-0 flex-1">
          <ChartContainer config={summaryChartConfig} className="h-full w-full">
            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
              <YAxis
                dataKey="name"
                type="category"
                tickLine={false}
                axisLine={false}
                width={view === 'issues' ? 80 : 60}
                tick={{ fontSize: 11 }}
              />
              <XAxis type="number" hide />
              <Bar dataKey="hours" radius={[0, 6, 6, 0]}>
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  )
}

function App() {
  const activeTab = useAppStore((s) => s.activeTab)
  const jiraExchangeCode = useJiraStore((s) => s.exchangeCode)
  const jiraHydrated = useJiraStore((s) => s._hasHydrated)
  const setHasSeenLanding = useAppStore((s) => s.setHasSeenLanding)
  useOAuthCallback('jira_oauth_state', jiraExchangeCode, jiraHydrated)
  useConnectionHealth()

  // Show landing only if user hasn't seen it yet and isn't explicitly navigating to #app
  const [page, setPage] = useState<'landing' | 'app'>(() => {
    if (window.location.hash === '#app') return 'app'
    // Check localStorage directly for initial render (zustand hydration is async)
    try {
      const stored = JSON.parse(localStorage.getItem('app-store') ?? '{}')
      if (stored?.state?.hasSeenLanding) return 'app'
    } catch { /* ignore */ }
    return 'landing'
  })

  const goToApp = () => {
    setHasSeenLanding()
    window.location.hash = '#app'
    setPage('app')
  }

  useEffect(() => {
    const onHash = () => setPage(window.location.hash === '#app' ? 'app' : 'landing')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

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
              <div className="relative flex flex-col gap-4">
                <SummaryCard />
                <ActivityLogCard />
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
