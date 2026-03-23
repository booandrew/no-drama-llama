import { useEffect, useMemo, useState } from 'react'

import * as queries from '@/lib/duckdb/queries'
import * as mockQueries from '@/lib/duckdb/mock-queries'
import type { DdsJiraIssue, DdsJiraWorklog, DdsTask } from '@/lib/duckdb/queries'
import { useAppStore } from '@/store/app'
import { MONTHS } from './mock-data'

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

function buildProjectColors(projects: string[]): Record<string, string> {
  const colors: Record<string, string> = {}
  for (let i = 0; i < projects.length; i++) {
    colors[projects[i]] = CHART_COLORS[i % CHART_COLORS.length]
  }
  return colors
}

/** Merge worklogs into pseudo-tasks grouped by (issue_key, day). */
function worklogsToTasks(worklogs: DdsJiraWorklog[], issues: DdsJiraIssue[]): DdsTask[] {
  const groups = new Map<string, { wls: DdsJiraWorklog[]; totalMin: number }>()
  for (const wl of worklogs) {
    const day = wl.started.split('T')[0]
    const key = `${wl.issue_key}::${day}`
    if (!groups.has(key)) groups.set(key, { wls: [], totalMin: 0 })
    const g = groups.get(key)!
    g.wls.push(wl)
    g.totalMin += parseDurationToMin(wl.time_spent)
  }

  const result: DdsTask[] = []
  for (const [key, { wls, totalMin }] of groups) {
    const first = wls[0]
    const issue = issues.find((i) => i.issue_key === first.issue_key)
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    const dur = h > 0 && m > 0 ? `${h}h${m}m` : h > 0 ? `${h}h` : `${m}m`
    result.push({
      task_id: `wl_${key}`,
      description: issue?.issue_name ?? first.issue_key,
      duration: dur,
      start_time: first.started,
      issue_key: first.issue_key,
      issue_name: issue?.issue_name ?? null,
      project_key: issue?.project_key ?? null,
      revision: 0,
      source: 'jira_worklog',
      source_id: first.worklog_id,
    })
  }
  return result
}

interface MonthData {
  tasks: DdsTask[]
  worklogs: DdsJiraWorklog[]
}

function aggregateFromTasks(
  allTasks: DdsTask[],
  period: 'month' | 'year',
  selectedMonth: number,
) {
  // Aggregate hours by project
  const projectHoursMap = new Map<string, number>()
  for (const t of allTasks) {
    const pk = t.project_key ?? '(unassigned)'
    const mins = parseDurationToMin(t.duration)
    projectHoursMap.set(pk, (projectHoursMap.get(pk) ?? 0) + mins)
  }

  const projects = [...projectHoursMap.keys()].sort(
    (a, b) => (projectHoursMap.get(b) ?? 0) - (projectHoursMap.get(a) ?? 0),
  )
  const projectColors = buildProjectColors(projects)

  // Bar data
  const barData = projects.map((p) => ({
    project: p,
    hours: Math.round((projectHoursMap.get(p) ?? 0) / 60 * 10) / 10,
  }))

  // Timeline data
  let areaData: Record<string, string | number>[]
  if (period === 'year') {
    // Aggregate by month
    const monthBuckets: Map<string, Map<string, number>> = new Map()
    for (const m of MONTHS) monthBuckets.set(m, new Map())
    for (const t of allTasks) {
      const d = new Date(t.start_time)
      const monthLabel = MONTHS[d.getMonth()]
      const pk = t.project_key ?? '(unassigned)'
      const bucket = monthBuckets.get(monthLabel)
      if (bucket) {
        bucket.set(pk, (bucket.get(pk) ?? 0) + parseDurationToMin(t.duration))
      }
    }
    areaData = MONTHS.map((month) => {
      const bucket = monthBuckets.get(month)!
      const row: Record<string, string | number> = { month }
      for (const p of projects) {
        row[p] = Math.round((bucket.get(p) ?? 0) / 60 * 10) / 10
      }
      return row
    })
  } else {
    // Aggregate by day within the selected month
    const year = new Date().getFullYear() // will be overridden by caller context
    const daysInMonth = new Date(year, selectedMonth + 1, 0).getDate()
    const dayBuckets: Map<number, Map<string, number>> = new Map()
    for (let d = 1; d <= daysInMonth; d++) dayBuckets.set(d, new Map())
    for (const t of allTasks) {
      const d = new Date(t.start_time)
      const day = d.getDate()
      const pk = t.project_key ?? '(unassigned)'
      const bucket = dayBuckets.get(day)
      if (bucket) {
        bucket.set(pk, (bucket.get(pk) ?? 0) + parseDurationToMin(t.duration))
      }
    }
    areaData = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1
      const bucket = dayBuckets.get(day)!
      const row: Record<string, string | number> = { month: String(day) }
      for (const p of projects) {
        row[p] = Math.round((bucket.get(p) ?? 0) / 60 * 10) / 10
      }
      return row
    })
  }

  // KPI
  const totalHours = Math.round(barData.reduce((s, b) => s + b.hours, 0) * 10) / 10
  const projectCount = projects.filter((p) => p !== '(unassigned)').length
  const workingDays = period === 'year' ? 260 : 22
  const avgPerDay = +(totalHours / workingDays).toFixed(1)

  return {
    projects,
    projectColors,
    kpi: { totalHours, projectCount, avgPerDay, topProject: projects[0] ?? '-' },
    barData,
    areaData,
  }
}

export interface InsightsData {
  projects: string[]
  projectColors: Record<string, string>
  kpi: { totalHours: number; projectCount: number; avgPerDay: number; topProject: string }
  barData: { project: string; hours: number }[]
  areaData: Record<string, string | number>[]
  loading: boolean
}

export function useInsightsData(
  period: 'month' | 'year',
  selectedYear: number,
  selectedMonth: number,
  isDbReady: boolean,
): InsightsData {
  const isMockMode = useAppStore((s) => s.isMockMode)
  const [loading, setLoading] = useState(false)
  const [monthDataMap, setMonthDataMap] = useState<Map<number, MonthData>>(new Map())
  const [issues, setIssues] = useState<DdsJiraIssue[]>([])

  // Load data from DuckDB
  useEffect(() => {
    if (isMockMode) return
    if (!isDbReady) return

    let cancelled = false
    setLoading(true)

    const load = async () => {
      const mod = queries
      const loadedIssues = await mod.readDdsJiraIssues()

      if (period === 'year') {
        // Load all 12 months in parallel
        const results = await Promise.all(
          Array.from({ length: 12 }, (_, m) => {
            const dateStart = new Date(selectedYear, m, 1).toISOString()
            const dateEnd = new Date(selectedYear, m + 1, 1).toISOString()
            return Promise.all([
              mod.readDdsTasks(dateStart, dateEnd),
              mod.readDdsJiraWorklogs(dateStart, dateEnd),
            ])
          }),
        )
        if (cancelled) return
        const map = new Map<number, MonthData>()
        for (let m = 0; m < 12; m++) {
          map.set(m, { tasks: results[m][0], worklogs: results[m][1] })
        }
        setMonthDataMap(map)
        setIssues(loadedIssues)
      } else {
        // Load single month
        const dateStart = new Date(selectedYear, selectedMonth, 1).toISOString()
        const dateEnd = new Date(selectedYear, selectedMonth + 1, 1).toISOString()
        const [tasks, worklogs] = await Promise.all([
          mod.readDdsTasks(dateStart, dateEnd),
          mod.readDdsJiraWorklogs(dateStart, dateEnd),
        ])
        if (cancelled) return
        const map = new Map<number, MonthData>()
        map.set(selectedMonth, { tasks, worklogs })
        setMonthDataMap(map)
        setIssues(loadedIssues)
      }
      setLoading(false)
    }

    load().catch(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [isMockMode, isDbReady, period, selectedYear, selectedMonth])

  // Mock mode: load via mock queries
  useEffect(() => {
    if (!isMockMode) return

    let cancelled = false
    setLoading(true)

    const load = async () => {
      const mod = mockQueries
      const loadedIssues = await mod.readDdsJiraIssues()

      if (period === 'year') {
        const results = await Promise.all(
          Array.from({ length: 12 }, (_, m) => {
            const dateStart = new Date(selectedYear, m, 1).toISOString()
            const dateEnd = new Date(selectedYear, m + 1, 1).toISOString()
            return Promise.all([
              mod.readDdsTasks(dateStart, dateEnd),
              mod.readDdsJiraWorklogs(dateStart, dateEnd),
            ])
          }),
        )
        if (cancelled) return
        const map = new Map<number, MonthData>()
        for (let m = 0; m < 12; m++) {
          map.set(m, { tasks: results[m][0], worklogs: results[m][1] })
        }
        setMonthDataMap(map)
        setIssues(loadedIssues)
      } else {
        const dateStart = new Date(selectedYear, selectedMonth, 1).toISOString()
        const dateEnd = new Date(selectedYear, selectedMonth + 1, 1).toISOString()
        const [tasks, worklogs] = await Promise.all([
          mod.readDdsTasks(dateStart, dateEnd),
          mod.readDdsJiraWorklogs(dateStart, dateEnd),
        ])
        if (cancelled) return
        const map = new Map<number, MonthData>()
        map.set(selectedMonth, { tasks, worklogs })
        setMonthDataMap(map)
        setIssues(loadedIssues)
      }
      setLoading(false)
    }

    load().catch(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [isMockMode, period, selectedYear, selectedMonth])

  // Aggregate
  const result = useMemo(() => {
    // Combine all loaded months' tasks + worklogs into a single list
    const allTasks: DdsTask[] = []
    for (const [, data] of monthDataMap) {
      allTasks.push(...data.tasks)
      allTasks.push(...worklogsToTasks(data.worklogs, issues))
    }

    if (allTasks.length === 0) {
      return {
        projects: [],
        projectColors: {},
        kpi: { totalHours: 0, projectCount: 0, avgPerDay: 0, topProject: '-' },
        barData: [],
        areaData: [],
      }
    }

    return aggregateFromTasks(allTasks, period, selectedMonth)
  }, [monthDataMap, issues, period, selectedMonth])

  return { ...result, loading }
}
