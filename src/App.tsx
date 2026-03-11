import { useEffect, useMemo, useState } from 'react'
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
import { useConnectionHealth } from '@/hooks/use-connection-health'
import { useAppStore } from '@/store/app'
import { useCalendarStore } from '@/store/calendar'
import { useJiraStore } from '@/store/jira'
import { useTasksStore } from '@/store/tasks'

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

function countWeekdays(year: number, month: number): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  let count = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month, d).getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

function parseDurationSeconds(dur: string): number {
  const hMatch = dur.match(/(\d+)h/)
  const mMatch = dur.match(/(\d+)m/)
  if (hMatch || mMatch) {
    return (hMatch ? parseInt(hMatch[1]) * 3600 : 0) + (mMatch ? parseInt(mMatch[1]) * 60 : 0)
  }
  const n = Number(dur)
  return n > 0 ? n : 0
}

function LlamaSidebar() {
  const selectedPeriod = useCalendarStore((s) => s.selectedPeriod)
  const worklogs = useTasksStore((s) => s.worklogs)
  const dailyCapacity = useTasksStore((s) => s.dailyCapacity)

  const { loggedHours, expectedHours } = useMemo(() => {
    let loggedSec = 0
    for (const wl of worklogs) {
      loggedSec += parseDurationSeconds(wl.time_spent)
    }

    let expectedSec = 0
    if (dailyCapacity.length > 0) {
      for (const dc of dailyCapacity) {
        expectedSec += dc.required_seconds
      }
    } else {
      const weekdays = countWeekdays(selectedPeriod.year, selectedPeriod.month)
      expectedSec = weekdays * 8 * 3600
    }

    return {
      loggedHours: Math.round(loggedSec / 3600),
      expectedHours: Math.round(expectedSec / 3600),
    }
  }, [worklogs, dailyCapacity, selectedPeriod.year, selectedPeriod.month])

  const pct = expectedHours > 0 ? Math.min(100, Math.round((loggedHours / expectedHours) * 100)) : 0

  return (
    <Card className="self-stretch overflow-hidden">
      <CardContent className="flex flex-1 flex-col items-center gap-3 p-4">
        <div className="rounded-xl bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-md">
          {loggedHours}h / {expectedHours}h logged
        </div>
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

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

function parseDurationToMin(dur: string): number {
  const hMatch = dur.match(/(\d+)h/)
  const mMatch = dur.match(/(\d+)m/)
  if (hMatch || mMatch) {
    return (hMatch ? parseInt(hMatch[1]) * 60 : 0) + (mMatch ? parseInt(mMatch[1]) : 0)
  }
  const n = Number(dur)
  return n > 0 ? Math.round(n / 60) : 0
}

function SummaryCard() {
  const [view, setView] = useState<'projects' | 'issues'>('projects')
  const tasks = useTasksStore((s) => s.tasks)
  const worklogs = useTasksStore((s) => s.worklogs)
  const issues = useTasksStore((s) => s.issues)

  const { projectData, issueData } = useMemo(() => {
    const issueMap = new Map(issues.map((i) => [i.issue_key, i]))

    // --- Projects: aggregate hours by project_key (skip unassigned) ---
    const projectMin = new Map<string, number>()
    for (const t of tasks) {
      if (!t.project_key) continue
      projectMin.set(t.project_key, (projectMin.get(t.project_key) ?? 0) + parseDurationToMin(t.duration))
    }
    for (const wl of worklogs) {
      const issue = issueMap.get(wl.issue_key)
      if (!issue?.project_key) continue
      projectMin.set(issue.project_key, (projectMin.get(issue.project_key) ?? 0) + parseDurationToMin(wl.time_spent))
    }
    const projectData = Array.from(projectMin.entries())
      .map(([name, min]) => ({ name, hours: +(min / 60).toFixed(1) }))
      .filter((d) => d.hours > 0)
      .sort((a, b) => b.hours - a.hours)
      .map((d, i) => ({ ...d, color: CHART_COLORS[i % CHART_COLORS.length] }))

    // Build project->color map so issues inherit their project's color
    const projectColorMap = new Map(projectData.map((d) => [d.name, d.color]))

    // --- Issues: aggregate hours by issue_key ---
    const issueMin = new Map<string, number>()
    for (const t of tasks) {
      if (!t.issue_key) continue
      issueMin.set(t.issue_key, (issueMin.get(t.issue_key) ?? 0) + parseDurationToMin(t.duration))
    }
    for (const wl of worklogs) {
      issueMin.set(
        wl.issue_key,
        (issueMin.get(wl.issue_key) ?? 0) + parseDurationToMin(wl.time_spent),
      )
    }
    const issueData = Array.from(issueMin.entries())
      .map(([key, min]) => {
        const issue = issueMap.get(key)
        const pk = issue?.project_key ?? null
        const color = (pk && projectColorMap.get(pk)) || CHART_COLORS[0]
        return { name: key, hours: +(min / 60).toFixed(1), color }
      })
      .filter((d) => d.hours > 0)
      .sort((a, b) => b.hours - a.hours)

    return { projectData, issueData }
  }, [tasks, worklogs, issues])

  const chartData = view === 'projects' ? projectData : issueData
  const totalHours = useMemo(
    () => chartData.reduce((s, d) => s + d.hours, 0),
    [chartData],
  )

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
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 0, right: 0, top: 4, bottom: 4 }}
            >
              <YAxis type="category" hide />
              <XAxis type="number" hide />
              <Bar
                dataKey="hours"
                radius={[0, 6, 6, 0]}
                label={({ x, y, height: h, index }: Record<string, unknown>) => (
                  <text
                    x={(x as number) + 8}
                    y={(y as number) + (h as number) / 2}
                    dominantBaseline="central"
                    fill="var(--foreground)"
                    fontSize={11}
                    fontWeight={600}
                  >
                    {chartData[index as number]?.name} — {chartData[index as number]?.hours}h (
                    {totalHours > 0
                      ? Math.round(((chartData[index as number]?.hours ?? 0) / totalHours) * 100)
                      : 0}
                    %)
                  </text>
                )}
              >
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
    } catch {
      /* ignore */
    }
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
