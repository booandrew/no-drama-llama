import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, RefreshCw } from 'lucide-react'

import { TimelineChart } from '@/components/TimelineChart'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useGoogleCalendarConnect } from '@/hooks/use-google-calendar-connect'
import { syncAll } from '@/lib/sync'
import { useCalendarStore } from '@/store/calendar'

type ZoomScale = '1w' | '2w' | '1m'

const MINUTES_PER_DAY = 1440

const MONTH_NAMES = [
  'January', 'February', 'March', 'April',
  'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December',
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

  const toX = (min: number) => (min / totalMinutes) * MINI_W

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
    for (let w = 0; w < weeksCount; w++) {
      const weekStartMin = w * 7 * MINUTES_PER_DAY
      const weekEndMin = Math.min(totalMinutes, (w + 1) * 7 * MINUTES_PER_DAY)
      const x = toX(weekStartMin) + (w === 0 ? 6 : 2)
      const x2 = toX(weekEndMin) - (w === weeksCount - 1 ? 6 : 2)
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
        <rect
          x={viewX}
          y={0}
          width={viewW}
          height={MINI_H}
          fill="#6366f1"
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
  const selectedPeriod = useCalendarStore((s) => s.selectedPeriod)
  const setSelectedPeriod = useCalendarStore((s) => s.setSelectedPeriod)
  const eventsLoading = useCalendarStore((s) => s.eventsLoading)
  const fetchEvents = useCalendarStore((s) => s.fetchEvents)
  const { isConnected, connect } = useGoogleCalendarConnect()
  const periodOptions = generatePeriodOptions()

  const [syncingAll, setSyncingAll] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  const handleSyncAll = async () => {
    setSyncingAll(true)
    setSyncError(null)
    try {
      const dateStart = new Date(selectedPeriod.year, selectedPeriod.month, 1)
        .toISOString()
        .slice(0, 10)
      const dateEnd = new Date(selectedPeriod.year, selectedPeriod.month + 1, 1)
        .toISOString()
        .slice(0, 10)
      const result = await syncAll(dateStart, dateEnd)
      if (result.errors.length > 0) {
        setSyncError(result.errors.join('; '))
      }
    } catch (e) {
      setSyncError((e as Error).message)
    } finally {
      setSyncingAll(false)
    }
  }

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
            <>
              <Button variant="default" size="sm" onClick={handleSyncAll} disabled={syncingAll}>
                <RefreshCw className={`size-4 ${syncingAll ? 'animate-spin' : ''}`} />
                Sync ALL
              </Button>
              <Button variant="outline" size="sm" onClick={fetchEvents} disabled={eventsLoading}>
                <RefreshCw className={`size-4 ${eventsLoading ? 'animate-spin' : ''}`} />
                Refresh Google Calendar
              </Button>
              <Button variant="default" size="sm" disabled>
                I'm good with timelogs, Submit to JIRA
              </Button>
            </>
          ) : (
            <Button variant="default" size="sm" onClick={connect}>
              <Calendar className="size-4" />
              Connect Google Calendar
            </Button>
          )}
        </div>
      </div>
      {syncError && <p className="text-destructive text-sm">{syncError}</p>}
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

  const [zoom, setZoom] = useState<ZoomScale>('1m')
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [scrollFraction, setScrollFraction] = useState(0)

  const daysInMonth = new Date(selectedPeriod.year, selectedPeriod.month + 1, 0).getDate()
  const totalMinutes = daysInMonth * MINUTES_PER_DAY

  const zoomDays: Record<ZoomScale, number> = { '1w': 7, '2w': 14, '1m': daysInMonth }
  const visibleFraction = zoomDays[zoom] / daysInMonth
  const chartWidthPercent = (daysInMonth / zoomDays[zoom]) * 100

  const taskNames = useMemo(() => {
    const names = new Set<string>()
    for (const e of events) names.add(e.summary ?? '(no title)')
    return Array.from(names).sort()
  }, [events])

  const isConnected = status === 'connected' || status === 'done' || status === 'loading'
  const isInitialMount = useRef(true)

  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return }
    if (isConnected) fetchEvents()
  }, [selectedPeriod.year, selectedPeriod.month])

  const handleChartScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    setScrollFraction(maxScroll > 0 ? el.scrollLeft / maxScroll : 0)
  }, [])

  const handleScrollTo = useCallback((fraction: number) => {
    const el = scrollContainerRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    el.scrollLeft = fraction * maxScroll
  }, [])

  const handleZoomChange = (v: string) => {
    if (v) {
      setZoom(v as ZoomScale)
      setScrollFraction(0)
      if (scrollContainerRef.current) scrollContainerRef.current.scrollLeft = 0
    }
  }

  if (!isConnected) {
    return (
      <p className="text-muted-foreground text-sm">
        Connect Google Calendar in Integrations to see events.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4 min-w-0">
      {events.length === 0 && !eventsLoading && (
        <p className="text-muted-foreground text-sm">
          Select a period or click Refresh to load events.
        </p>
      )}

      {events.length > 0 && (
        <Card>
          {/* Card header: zoom switcher (left) + mini-view (right) */}
          <div className="flex items-center justify-end gap-3 px-4 py-2 border-b">
            <div className="flex items-center gap-1">
              {([['1w', 'Week'], ['2w', 'Bi-Week'], ['1m', 'Month']] as const).map(([value, label]) => (
                <Button
                  key={value}
                  variant={zoom === value ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleZoomChange(value)}
                >
                  {label}
                </Button>
              ))}
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

          <CardContent className="flex p-0">
            {/* Sticky labels column */}
            <div
              className="shrink-0 w-[180px] border-r bg-card z-10 flex flex-col"
              style={{ height: Math.max(200, taskNames.length * 44 + 60) }}
            >
              <div style={{ height: 40, flexShrink: 0 }} />
              <div className="flex flex-1 flex-col" style={{ paddingBottom: 10 }}>
                {taskNames.map((name) => (
                  <div
                    key={name}
                    className="flex flex-1 items-center justify-start pl-3 text-sm text-muted-foreground truncate"
                    title={name}
                  >
                    {name.length > 20 ? name.slice(0, 18) + '...' : name}
                  </div>
                ))}
              </div>
            </div>
            {/* Scrollable chart */}
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-x-auto"
              onScroll={handleChartScroll}
            >
              <div style={{ minWidth: `${chartWidthPercent}%` }}>
                <TimelineChart
                  events={events}
                  year={selectedPeriod.year}
                  month={selectedPeriod.month}
                  hideYAxis
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
