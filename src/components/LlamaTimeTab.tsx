import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ManageConnectionsDialog } from '@/components/ManageConnectionsDialog'
import { TimelineChart } from '@/components/TimelineChart'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAggregateConnectionStatus, useAllAuthChecked } from '@/hooks/use-connection-health'
import { useDuckDB } from '@/lib/duckdb/use-duckdb'
import { Input } from '@/components/ui/input'
import type { DdsJiraIssue, DdsJiraWorklog, DdsTask } from '@/lib/duckdb/queries'
import { syncAll } from '@/lib/sync'
import { useAppStore } from '@/store/app'
import { useCalendarStore } from '@/store/calendar'
import { useTasksStore } from '@/store/tasks'
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

const MINUTES_PER_DAY = 1440
const WORK_START_HOUR = 7
const WORK_END_HOUR = 20
const WORK_MINUTES_PER_DAY = (WORK_END_HOUR - WORK_START_HOUR) * 60

type RowType = 'worklog' | 'custom' | 'calendar'

const TYPE_ORDER: RowType[] = ['worklog', 'custom', 'calendar']

const TYPE_CONFIG: Record<RowType, { label: string; barColor: string; className: string }> = {
  worklog: {
    label: 'WL',
    barColor: '#22c55e',
    className: 'bg-green-500/20 text-green-700 dark:text-green-400',
  },
  custom: {
    label: 'CI',
    barColor: '#f97316',
    className: 'bg-orange-500/20 text-orange-700 dark:text-orange-400',
  },
  calendar: {
    label: 'Cal',
    barColor: '#3b82f6',
    className: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
  },
}

function getRowType(source: string): RowType {
  if (source === 'jira_worklog') return 'worklog'
  if (source === 'custom_input') return 'custom'
  return 'calendar'
}

function parseDuration(dur: string): number {
  const hMatch = dur.match(/(\d+)h/)
  const mMatch = dur.match(/(\d+)m/)
  if (hMatch || mMatch) {
    return (hMatch ? parseInt(hMatch[1]) * 60 : 0) + (mMatch ? parseInt(mMatch[1]) : 0)
  }
  // Raw seconds (e.g. "28800" from Jira API timeSpentSeconds)
  const n = Number(dur)
  return n > 0 ? Math.round(n / 60) : 0
}

function minutesToDurationStr(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}h${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

function hasTasksOutsideWorkHours(tasks: DdsTask[]): boolean {
  const wStart = WORK_START_HOUR * 60
  const wEnd = WORK_END_HOUR * 60
  for (const t of tasks) {
    if (!t.start_time) continue
    const sd = new Date(t.start_time)
    const sm = sd.getHours() * 60 + sd.getMinutes()
    if (sm < wStart || sm >= wEnd) return true
    const em = sm + parseDuration(t.duration)
    if (em > wEnd) return true
  }
  return false
}

/** Convert DdsJiraWorklogs to pseudo-DdsTask entries, grouped by (issue_key, day). */
function worklogsToTasks(worklogs: DdsJiraWorklog[], issues: DdsJiraIssue[]): DdsTask[] {
  const groups = new Map<string, { wls: DdsJiraWorklog[]; totalMin: number }>()
  for (const wl of worklogs) {
    const day = wl.started.split('T')[0]
    const key = `${wl.issue_key}::${day}`
    if (!groups.has(key)) groups.set(key, { wls: [], totalMin: 0 })
    const g = groups.get(key)!
    g.wls.push(wl)
    g.totalMin += parseDuration(wl.time_spent)
  }

  const result: DdsTask[] = []
  for (const [key, { wls, totalMin }] of groups) {
    const first = wls[0]
    const issue = issues.find((i) => i.issue_key === first.issue_key)
    result.push({
      task_id: `wl_${key}`,
      description: issue?.issue_name ?? first.issue_key,
      duration: minutesToDurationStr(totalMin),
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

interface TaskGroup {
  key: string
  desc: string
  issueKey: string | null
  type: RowType
  taskIds: string[]
  readonly: boolean
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

// ---------------------------------------------------------------------------
// MiniTimeline — horizontal compressed overview with draggable viewport
// ---------------------------------------------------------------------------
const MINI_W = 160
const MINI_H = 28

function MiniTimeline({
  year,
  month,
  totalMinutes,
  scrollFraction,
  visibleFraction,
  onScrollTo,
}: {
  year: number
  month: number
  totalMinutes: number
  scrollFraction: number
  visibleFraction: number
  onScrollTo: (fraction: number) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartFraction = useRef(0)

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const weeksCount = Math.ceil(daysInMonth / 7)

  const viewW = Math.max(8, visibleFraction * MINI_W)
  const maxViewX = MINI_W - viewW
  const viewX = scrollFraction * maxViewX

  // Stable ref for event handlers
  const stateRef = useRef({ visibleFraction, onScrollTo })
  useEffect(() => {
    stateRef.current = { visibleFraction, onScrollTo }
  })

  // Global mousemove/mouseup for drag
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const { visibleFraction: vf, onScrollTo: cb } = stateRef.current
      const maxX = MINI_W * (1 - vf)
      if (maxX <= 0) return
      const dx = e.clientX - dragStartX.current
      const dFraction = dx / maxX
      const newFraction = Math.max(0, Math.min(1, dragStartFraction.current + dFraction))
      cb(newFraction)
    }
    const onUp = () => {
      isDragging.current = false
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (visibleFraction >= 1) return
      e.preventDefault()

      if (!svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left

      const clickInViewport = x >= viewX && x <= viewX + viewW

      if (clickInViewport) {
        isDragging.current = true
        dragStartX.current = e.clientX
        dragStartFraction.current = scrollFraction
      } else {
        // Jump: center viewport on click point
        const clickNorm = x / MINI_W
        const newFraction = Math.max(
          0,
          Math.min(1, (clickNorm - visibleFraction / 2) / (1 - visibleFraction)),
        )
        onScrollTo(newFraction)
        isDragging.current = true
        dragStartX.current = e.clientX
        dragStartFraction.current = newFraction
      }
    },
    [visibleFraction, viewX, viewW, scrollFraction, onScrollTo],
  )

  // Week blocks
  const weekBlocks = useMemo(() => {
    const blocks: { x: number; width: number }[] = []
    const tm = totalMinutes
    const mpd = tm / daysInMonth
    for (let w = 0; w < weeksCount; w++) {
      const weekStartMin = w * 7 * mpd
      const weekEndMin = Math.min(tm, (w + 1) * 7 * mpd)
      const x = (weekStartMin / tm) * MINI_W + (w === 0 ? 6 : 2)
      const x2 = (weekEndMin / tm) * MINI_W - (w === weeksCount - 1 ? 6 : 2)
      blocks.push({ x, width: x2 - x })
    }
    return blocks
  }, [weeksCount, totalMinutes, daysInMonth])

  return (
    <div className="select-none">
      <svg
        ref={svgRef}
        width={MINI_W}
        height={MINI_H}
        onMouseDown={handleMouseDown}
        className={visibleFraction < 1 ? 'cursor-grab active:cursor-grabbing' : ''}
        style={{ display: 'block' }}
      >
        {/* 1. Background */}
        <rect width={MINI_W} height={MINI_H} rx={4} fill="var(--muted)" />

        {/* 2. Week blocks */}
        {weekBlocks.map((block, i) => (
          <rect
            key={i}
            x={block.x}
            y={2}
            width={block.width}
            height={24}
            rx={3}
            fill="var(--muted-foreground)"
            opacity={0.2}
          />
        ))}

        {/* 3. Viewport overlay */}
        <rect
          x={viewX}
          y={0}
          width={viewW}
          height={MINI_H}
          fill="var(--chart-1)"
          opacity={0.15}
          rx={4}
        />
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LlamaTimeToolbar — period selector + action buttons (full-width row)
// ---------------------------------------------------------------------------
export function LlamaTimeToolbar() {
  const isMockMode = useAppStore((s) => s.isMockMode)
  const selectedPeriod = useCalendarStore((s) => s.selectedPeriod)
  const setSelectedPeriod = useCalendarStore((s) => s.setSelectedPeriod)
  const loadTasks = useTasksStore((s) => s.loadTasks)
  const aggregateStatus = useAggregateConnectionStatus()
  const [syncing, setSyncing] = useState(false)

  const handleLoadSources = useCallback(async () => {
    setSyncing(true)
    try {
      const { year, month } = selectedPeriod
      const dateStart = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const lastDay = new Date(year, month + 1, 0).getDate()
      const dateEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

      const result = await syncAll(dateStart, dateEnd)

      if (result.errors.length > 0) {
        toast.warning('Some sources failed to sync', {
          description: result.errors.join('; '),
        })
      } else {
        toast.success('Sources synced successfully')
      }

      await loadTasks(year, month)
    } catch (e) {
      toast.error('Sync failed', { description: (e as Error).message })
    } finally {
      setSyncing(false)
    }
  }, [selectedPeriod, loadTasks])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select
            value={String(selectedPeriod.month)}
            onValueChange={(v) =>
              setSelectedPeriod({ year: selectedPeriod.year, month: Number(v) })
            }
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((name, i) => (
                <SelectItem key={i} value={String(i)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(selectedPeriod.year)}
            onValueChange={(v) =>
              setSelectedPeriod({ year: Number(v), month: selectedPeriod.month })
            }
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {isMockMode ? (
            <span className="text-muted-foreground text-xs">Mock mode — using synthetic data</span>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={syncing || aggregateStatus === 'none'}
                onClick={handleLoadSources}
              >
                {syncing ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                )}
                Load Sources
              </Button>
              <Button variant="default" size="sm" disabled>
                I'm good with timelogs, Submit to JIRA
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LlamaTimeTab
// ---------------------------------------------------------------------------
export function LlamaTimeTab() {
  const isMockMode = useAppStore((s) => s.isMockMode)
  const selectedPeriod = useCalendarStore((s) => s.selectedPeriod)
  const { isReady } = useDuckDB()

  const tasks = useTasksStore((s) => s.tasks)
  const worklogs = useTasksStore((s) => s.worklogs)
  const issues = useTasksStore((s) => s.issues)
  const loading = useTasksStore((s) => s.loading)
  const loadTasks = useTasksStore((s) => s.loadTasks)
  const updateTask = useTasksStore((s) => s.updateTask)
  const updateTasks = useTasksStore((s) => s.updateTasks)
  const addTask = useTasksStore((s) => s.addTask)

  const aggregateStatus = useAggregateConnectionStatus()
  const allAuthChecked = useAllAuthChecked()
  const [connectDialogOpen, setConnectDialogOpen] = useState(false)

  // Auto-open dialog only after all auth checks have resolved with no connections
  const hasAutoOpened = useRef(false)
  useEffect(() => {
    if (isMockMode || hasAutoOpened.current || !allAuthChecked) return
    if (aggregateStatus === 'none') {
      setConnectDialogOpen(true)
    }
    hasAutoOpened.current = true
  }, [aggregateStatus, allAuthChecked, isMockMode])

  // Load all data when period or readiness changes
  useEffect(() => {
    if (isMockMode) {
      loadTasks(selectedPeriod.year, selectedPeriod.month)
      return
    }
    if (isReady) {
      loadTasks(selectedPeriod.year, selectedPeriod.month)
    }
  }, [selectedPeriod.year, selectedPeriod.month, isReady, isMockMode, loadTasks])

  // Build unified task list and groups
  const { allTasks, taskGroups, barColors } = useMemo(() => {
    const wlTasks = worklogsToTasks(worklogs, issues)
    const allTasks = [...tasks, ...wlTasks]

    const grouped = new Map<string, TaskGroup>()
    for (const t of allTasks) {
      const desc = t.description ?? '(no title)'
      const type = getRowType(t.source)
      const ik = t.issue_key ?? ''
      let key: string
      if (type === 'worklog') {
        key = `wl::${t.issue_key ?? desc}`
      } else if (type === 'custom') {
        key = `ci::${desc}::${ik}`
      } else {
        key = `cal::${desc}::${ik}`
      }

      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          desc,
          issueKey: t.issue_key,
          type,
          taskIds: [],
          readonly: type === 'worklog',
        })
      }
      const g = grouped.get(key)!
      g.taskIds.push(t.task_id)
      if (t.issue_key && !g.issueKey) {
        g.issueKey = t.issue_key
      }
    }

    const groups = Array.from(grouped.values()).sort((a, b) => {
      const aIdx = TYPE_ORDER.indexOf(a.type)
      const bIdx = TYPE_ORDER.indexOf(b.type)
      if (aIdx !== bIdx) return aIdx - bIdx
      if (!!a.issueKey !== !!b.issueKey) return a.issueKey ? -1 : 1
      return a.desc.localeCompare(b.desc)
    })

    const colors = groups.map((g) => TYPE_CONFIG[g.type].barColor)
    return { allTasks, taskGroups: groups, barColors: colors }
  }, [tasks, worklogs, issues])

  const issueKeys = useMemo(() => issues.map((i) => i.issue_key), [issues])

  const use24h = useMemo(() => hasTasksOutsideWorkHours(allTasks), [allTasks])
  const effectiveMinutesPerDay = use24h ? MINUTES_PER_DAY : WORK_MINUTES_PER_DAY
  const workStartMinute = use24h ? 0 : WORK_START_HOUR * 60

  const chartBodyRef = useRef<HTMLDivElement>(null)
  const dayLabelsRef = useRef<HTMLDivElement>(null)
  const taskNamesRef = useRef<HTMLDivElement>(null)
  const [scrollFraction, setScrollFraction] = useState(0)

  // Column resizing
  const [sidebarWidth, setSidebarWidth] = useState(356)
  const [issueColWidth, setIssueColWidth] = useState(140)
  const typeColWidth = 32

  const handleResizeSidebar = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startW = sidebarWidth
      const minSidebar = typeColWidth + issueColWidth + 100
      const onMove = (me: MouseEvent) => {
        setSidebarWidth(Math.max(minSidebar, Math.min(600, startW + me.clientX - startX)))
      }
      const onUp = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [sidebarWidth, issueColWidth],
  )

  const handleResizeIssueCol = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startW = issueColWidth
      const onMove = (me: MouseEvent) => {
        setIssueColWidth(Math.max(80, Math.min(300, startW - (me.clientX - startX))))
      }
      const onUp = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [issueColWidth],
  )

  const daysInMonth = new Date(selectedPeriod.year, selectedPeriod.month + 1, 0).getDate()
  const totalMinutes = daysInMonth * effectiveMinutesPerDay

  const [visibleDays, setVisibleDays] = useState(14)
  const visibleFraction = visibleDays / daysInMonth
  const chartWidthPercent = (daysInMonth / visibleDays) * 100

  const handleGroupIssueChange = useCallback(
    async (taskIds: string[], issueKey: string | null) => {
      const issue = issues.find((i) => i.issue_key === issueKey)
      await updateTasks(taskIds, {
        issue_key: issueKey,
        issue_name: issue?.issue_name ?? null,
        project_key: issue?.project_key ?? null,
      })
    },
    [issues, updateTasks],
  )

  const issueFilter = useCallback(
    (value: string, query: string) => {
      if (!query) return true
      const issue = issues.find((i) => i.issue_key === value)
      const str = issue ? `${issue.issue_key} ${issue.issue_name ?? ''}` : String(value ?? '')
      return str.toLowerCase().includes(query.toLowerCase())
    },
    [issues],
  )

  const forwardWheel = useCallback((e: React.WheelEvent) => {
    const body = chartBodyRef.current
    if (!body) return
    body.scrollTop += e.deltaY
    body.scrollLeft += e.deltaX
  }, [])

  const handleBodyScroll = useCallback(() => {
    const body = chartBodyRef.current
    if (!body) return
    if (dayLabelsRef.current) dayLabelsRef.current.scrollLeft = body.scrollLeft
    if (taskNamesRef.current) taskNamesRef.current.scrollTop = body.scrollTop
    const maxScroll = body.scrollWidth - body.clientWidth
    setScrollFraction(maxScroll > 0 ? body.scrollLeft / maxScroll : 0)
  }, [])

  const handleScrollTo = useCallback((fraction: number) => {
    const el = chartBodyRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    el.scrollLeft = fraction * maxScroll
  }, [])

  const setVisibleDaysClamped = useCallback(
    (days: number) => {
      setVisibleDays(Math.max(1, Math.min(daysInMonth, days)))
      setScrollFraction(0)
      if (chartBodyRef.current) chartBodyRef.current.scrollLeft = 0
    },
    [daysInMonth],
  )

  // Reset visibleDays when month changes
  useEffect(() => {
    setVisibleDays(14)
  }, [daysInMonth])

  // Pinch-to-zoom (trackpad) and Cmd+scroll zoom — adjusts by ±1 day
  const lastZoomTime = useRef(0)

  useEffect(() => {
    const el = chartBodyRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()

      const now = Date.now()
      if (now - lastZoomTime.current < 80) return
      lastZoomTime.current = now

      setVisibleDays((prev) => {
        const next = e.deltaY > 0 ? prev + 3 : prev - 3
        return Math.max(1, Math.min(daysInMonth, next))
      })
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [daysInMonth])

  const chartBodyHeight = Math.max(200, taskGroups.length * 44 + 20)
  const hasData = allTasks.length > 0

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-4">
      {!hasData && !loading && (
        <p className="text-muted-foreground text-sm">Select a period or sync data to load tasks.</p>
      )}

      {hasData && (
        <Card className="flex flex-1 min-h-0 flex-col">
          {/* Card header: title + zoom switcher + mini-view */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <span className="leading-none font-semibold">Wool Work</span>
              <span className="text-xs text-muted-foreground">
                Map your calendar events to projects
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {(
                  [
                    [1, 'Day'],
                    [7, 'Week'],
                    [14, 'Bi-Week'],
                    [daysInMonth, 'Month'],
                  ] as [number, string][]
                ).map(([days, label], i, arr) => {
                  const prevMax = i > 0 ? (arr[i - 1][0] as number) : 0
                  const isActive = visibleDays > prevMax && visibleDays <= days
                  return (
                    <Button
                      key={label}
                      variant={isActive ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setVisibleDaysClamped(days)}
                    >
                      {label}
                    </Button>
                  )
                })}
              </div>

              <MiniTimeline
                year={selectedPeriod.year}
                month={selectedPeriod.month}
                totalMinutes={totalMinutes}
                scrollFraction={scrollFraction}
                visibleFraction={visibleFraction}
                onScrollTo={handleScrollTo}
              />
            </div>
          </div>

          {/* Day labels header — fixed, syncs horizontal scroll */}
          <div className="flex shrink-0 border-b">
            <div
              className="relative flex shrink-0 items-center gap-1.5 border-r pl-2 pr-2"
              style={{ width: sidebarWidth }}
            >
              <span
                className="shrink-0 px-1 text-xs font-medium text-muted-foreground text-center"
                style={{ width: typeColWidth }}
              >
                Type
              </span>
              <span className="min-w-0 flex-1 border-l pl-1.5 text-xs font-medium text-muted-foreground truncate">
                Name
              </span>
              <div
                className="absolute top-0 h-full w-3 cursor-col-resize z-20 hover:bg-border/60"
                style={{ right: issueColWidth + 8 - 1 }}
                onMouseDown={handleResizeIssueCol}
              />
              <span
                className="shrink-0 border-l pl-1.5 text-xs font-medium text-muted-foreground text-center"
                style={{ width: issueColWidth }}
              >
                Issue Key
              </span>
              <div
                className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-border/60 z-20"
                onMouseDown={handleResizeSidebar}
              />
            </div>
            <div ref={dayLabelsRef} className="flex-1 overflow-hidden" onWheel={forwardWheel}>
              <div
                style={{
                  minWidth: `${chartWidthPercent}%`,
                  transition: 'min-width 120ms ease-out',
                }}
              >
                <div className="flex h-8" style={{ marginRight: 20 }}>
                  {Array.from({ length: daysInMonth }, (_, i) => (
                    <div
                      key={i}
                      className="flex-1 text-center text-xs text-muted-foreground leading-8"
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable body: task names + chart */}
          <div className="flex flex-1 min-h-0">
            {/* Task names column — synced vertical scroll */}
            <div
              ref={taskNamesRef}
              className="shrink-0 overflow-hidden border-r bg-card z-10"
              style={{ width: sidebarWidth }}
              onWheel={forwardWheel}
            >
              <div className="flex flex-col" style={{ height: chartBodyHeight }}>
                <div style={{ height: 10, flexShrink: 0 }} />
                <div className="flex flex-1 flex-col" style={{ paddingBottom: 10 }}>
                  {taskGroups.map((group) => {
                    const cfg = TYPE_CONFIG[group.type]
                    return (
                      <div
                        key={group.key}
                        className="flex flex-1 items-center gap-1.5 pl-2 pr-2"
                        title={group.desc}
                      >
                        <span
                          className={`shrink-0 rounded px-1 py-0.5 text-center text-[10px] font-semibold leading-none ${cfg.className}`}
                          style={{ width: typeColWidth }}
                        >
                          {cfg.label}
                        </span>
                        <span className="min-w-0 flex-1 text-sm text-muted-foreground truncate">
                          {group.desc}
                        </span>
                        {group.readonly ? (
                          <Input
                            className="h-7 shrink-0 text-xs"
                            style={{ width: issueColWidth }}
                            value={group.issueKey ?? ''}
                            disabled
                          />
                        ) : (
                          <Combobox
                            value={group.issueKey}
                            onValueChange={(val) =>
                              handleGroupIssueChange(group.taskIds, val as string | null)
                            }
                            filter={issueFilter}
                            items={issueKeys}
                          >
                            <ComboboxInput
                              placeholder="—"
                              className="h-7 shrink-0 text-xs"
                              style={{ width: issueColWidth }}
                              showClear={!!group.issueKey}
                            />
                            <ComboboxContent className="min-w-64">
                              <ComboboxEmpty>No issues found</ComboboxEmpty>
                              <ComboboxList className="max-h-60">
                                {(issueKey: string) => {
                                  const issue = issues.find((i) => i.issue_key === issueKey)
                                  return (
                                    <ComboboxItem
                                      key={issueKey}
                                      value={issueKey}
                                      className="whitespace-nowrap"
                                    >
                                      <span className="font-medium shrink-0">{issueKey}</span>
                                      <span className="text-muted-foreground truncate">
                                        {issue?.issue_name}
                                      </span>
                                    </ComboboxItem>
                                  )
                                }}
                              </ComboboxList>
                            </ComboboxContent>
                          </Combobox>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Chart body — main scroll container */}
            <div ref={chartBodyRef} className="flex-1 overflow-auto" onScroll={handleBodyScroll}>
              <div
                style={{
                  minWidth: `${chartWidthPercent}%`,
                  transition: 'min-width 120ms ease-out',
                }}
              >
                <TimelineChart
                  tasks={allTasks}
                  issues={issues}
                  onTaskUpdate={updateTask}
                  onAddTask={addTask}
                  year={selectedPeriod.year}
                  month={selectedPeriod.month}
                  hideYAxis
                  hideXAxis
                  effectiveMinutesPerDay={effectiveMinutesPerDay}
                  workStartMinute={workStartMinute}
                  barColors={barColors}
                />
              </div>
            </div>
          </div>
        </Card>
      )}

      <ManageConnectionsDialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen} />
    </div>
  )
}
