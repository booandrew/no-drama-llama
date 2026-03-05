import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Calendar } from 'lucide-react'

import { TimelineChart } from '@/components/TimelineChart'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxList,
} from '@/components/ui/combobox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useGoogleCalendarConnect } from '@/hooks/use-google-calendar-connect'
import { useCalendarStore } from '@/store/calendar'

const MINUTES_PER_DAY = 1440

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

function generatePeriodOptions() {
  const now = new Date()
  const options: { year: number; month: number; label: string }[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    options.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
    })
  }
  return options
}

function periodToValue(year: number, month: number) {
  return `${year}-${month}`
}

function valueToPeriod(value: string) {
  const [year, month] = value.split('-').map(Number)
  return { year, month }
}

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
    for (let w = 0; w < weeksCount; w++) {
      const weekStartMin = w * 7 * MINUTES_PER_DAY
      const weekEndMin = Math.min(tm, (w + 1) * 7 * MINUTES_PER_DAY)
      const x = (weekStartMin / tm) * MINI_W + (w === 0 ? 6 : 2)
      const x2 = (weekEndMin / tm) * MINI_W - (w === weeksCount - 1 ? 6 : 2)
      blocks.push({ x, width: x2 - x })
    }
    return blocks
  }, [weeksCount, totalMinutes])

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
        <rect x={viewX} y={0} width={viewW} height={MINI_H} fill="#6366f1" opacity={0.15} rx={4} />
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LlamaTimeToolbar — period selector + action buttons (full-width row)
// ---------------------------------------------------------------------------
export function LlamaTimeToolbar() {
  const selectedPeriod = useCalendarStore((s) => s.selectedPeriod)
  const setSelectedPeriod = useCalendarStore((s) => s.setSelectedPeriod)
  const { isConnected, connect } = useGoogleCalendarConnect()
  const periodOptions = generatePeriodOptions()

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Select
          value={periodToValue(selectedPeriod.year, selectedPeriod.month)}
          onValueChange={(v) => setSelectedPeriod(valueToPeriod(v))}
        >
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periodOptions.map((opt) => (
              <SelectItem key={periodToValue(opt.year, opt.month)} value={periodToValue(opt.year, opt.month)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          {isConnected ? (
            <Button variant="default" size="sm" disabled>
              I'm good with timelogs, Submit to JIRA
            </Button>
          ) : (
            <Button variant="default" size="sm" onClick={connect}>
              <Calendar className="size-4" />
              Connect Google Calendar
            </Button>
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
  const selectedPeriod = useCalendarStore((s) => s.selectedPeriod)
  const events = useCalendarStore((s) => s.events)
  const eventsLoading = useCalendarStore((s) => s.eventsLoading)
  const fetchEvents = useCalendarStore((s) => s.fetchEvents)
  const status = useCalendarStore((s) => s.status)

  const chartBodyRef = useRef<HTMLDivElement>(null)
  const dayLabelsRef = useRef<HTMLDivElement>(null)
  const taskNamesRef = useRef<HTMLDivElement>(null)
  const [scrollFraction, setScrollFraction] = useState(0)

  const daysInMonth = new Date(selectedPeriod.year, selectedPeriod.month + 1, 0).getDate()
  const totalMinutes = daysInMonth * MINUTES_PER_DAY

  const [visibleDays, setVisibleDays] = useState(daysInMonth)
  const visibleFraction = visibleDays / daysInMonth
  const chartWidthPercent = (daysInMonth / visibleDays) * 100

  const taskNames = useMemo(() => {
    const names = new Set<string>()
    for (const e of events) names.add(e.summary ?? '(no title)')
    return Array.from(names).sort()
  }, [events])

  const isConnected = status === 'connected' || status === 'done' || status === 'loading'
  const isInitialMount = useRef(true)

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    if (isConnected) fetchEvents()
  }, [selectedPeriod.year, selectedPeriod.month])

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
    setVisibleDays(daysInMonth)
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

  if (!isConnected) {
    return (
      <p className="text-muted-foreground text-sm">
        Connect Google Calendar in Integrations to see events.
      </p>
    )
  }

  const chartBodyHeight = Math.max(200, taskNames.length * 44 + 20)

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-4">
      {events.length === 0 && !eventsLoading && (
        <p className="text-muted-foreground text-sm">
          Select a period or click Refresh to load events.
        </p>
      )}

      {events.length > 0 && (
        <Card className="flex flex-1 min-h-0 flex-col">
          {/* Card header: zoom switcher + mini-view */}
          <div className="flex shrink-0 items-center justify-end gap-3 border-b px-4 py-2">
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

          {/* Day labels header — fixed, syncs horizontal scroll */}
          <div className="flex shrink-0 border-b">
            <div className="w-[320px] shrink-0 border-r" />
            <div ref={dayLabelsRef} className="flex-1 overflow-hidden">
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
              className="shrink-0 w-[320px] overflow-hidden border-r bg-card z-10"
            >
              <div
                className="flex flex-col"
                style={{ height: chartBodyHeight }}
              >
                <div style={{ height: 10, flexShrink: 0 }} />
                <div className="flex flex-1 flex-col" style={{ paddingBottom: 10 }}>
                  {taskNames.map((name) => (
                    <div
                      key={name}
                      className="flex flex-1 items-center justify-between gap-2 pl-3 pr-2"
                      title={name}
                    >
                      <span className="text-sm text-muted-foreground truncate shrink min-w-0">
                        {name.length > 20 ? name.slice(0, 18) + '...' : name}
                      </span>
                      <Combobox>
                        <ComboboxInput
                          placeholder="—"
                          className="h-7 w-[140px] shrink-0 text-xs"
                        />
                        <ComboboxContent>
                          <ComboboxList>
                            <ComboboxEmpty>No results</ComboboxEmpty>
                          </ComboboxList>
                        </ComboboxContent>
                      </Combobox>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Chart body — main scroll container */}
            <div
              ref={chartBodyRef}
              className="flex-1 overflow-auto"
              onScroll={handleBodyScroll}
            >
              <div
                style={{
                  minWidth: `${chartWidthPercent}%`,
                  transition: 'min-width 120ms ease-out',
                }}
              >
                <TimelineChart
                  events={events}
                  year={selectedPeriod.year}
                  month={selectedPeriod.month}
                  hideYAxis
                  hideXAxis
                />
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
