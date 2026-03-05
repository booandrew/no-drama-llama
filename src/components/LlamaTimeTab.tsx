import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'

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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useCalendarStore, type CalendarEvent } from '@/store/calendar'

type ZoomScale = '1w' | '2w' | '1m'

const MINUTES_PER_DAY = 1440

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

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
  events,
  year,
  month,
  domain,
  totalMinutes,
  zoom,
  maxOffset,
  onOffsetChange,
}: {
  events: CalendarEvent[]
  year: number
  month: number
  domain: [number, number]
  totalMinutes: number
  zoom: ZoomScale
  maxOffset: number
  onOffsetChange: (offset: number) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const isDragging = useRef(false)

  const monthStartMs = useMemo(() => new Date(year, month, 1).getTime(), [year, month])

  const miniEvents = useMemo(() => {
    const nameIndex = new Map<string, number>()
    events.forEach((e) => {
      const name = e.summary ?? '(no title)'
      if (!nameIndex.has(name)) nameIndex.set(name, nameIndex.size)
    })
    return events.map((e) => {
      const name = e.summary ?? '(no title)'
      const startMin = Math.max(
        0,
        Math.round(
          (new Date(e.start?.dateTime ?? e.start?.date ?? 0).getTime() - monthStartMs) / 60000,
        ),
      )
      const rawEndMin = Math.round(
        (new Date(e.end?.dateTime ?? e.end?.date ?? 0).getTime() - monthStartMs) / 60000,
      )
      const endMin = Math.min(totalMinutes, Math.max(startMin + 60, rawEndMin))
      return { startMin, endMin, color: CHART_COLORS[(nameIndex.get(name) ?? 0) % CHART_COLORS.length] }
    })
  }, [events, monthStartMs, totalMinutes])

  const toX = (min: number) => (min / totalMinutes) * MINI_W
  const viewX = toX(domain[0])
  const viewW = Math.max(6, toX(domain[1]) - toX(domain[0]))

  // Ref keeps handlers stable without re-registration
  const stateRef = useRef({ totalMinutes, domain, maxOffset, zoom, onOffsetChange })
  useEffect(() => {
    stateRef.current = { totalMinutes, domain, maxOffset, zoom, onOffsetChange }
  })

  useEffect(() => {
    const calcOffset = (clientX: number): number => {
      if (!svgRef.current) return 0
      const { totalMinutes: total, domain: d, maxOffset: mo, zoom: z } = stateRef.current
      const rect = svgRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(MINI_W, clientX - rect.left))
      const windowMin = d[1] - d[0]
      const targetStart = Math.max(0, (x / MINI_W) * total - windowMin / 2)
      const stepMin = z === '1w' ? 7 * MINUTES_PER_DAY : 14 * MINUTES_PER_DAY
      return Math.max(0, Math.min(mo, Math.round(targetStart / stepMin)))
    }
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current || stateRef.current.zoom === '1m') return
      stateRef.current.onOffsetChange(calcOffset(e.clientX))
    }
    const onUp = () => { isDragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoom === '1m') return
      isDragging.current = true
      if (!svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(MINI_W, e.clientX - rect.left))
      const windowMin = domain[1] - domain[0]
      const targetStart = Math.max(0, (x / MINI_W) * totalMinutes - windowMin / 2)
      const stepMin = zoom === '1w' ? 7 * MINUTES_PER_DAY : 14 * MINUTES_PER_DAY
      onOffsetChange(Math.max(0, Math.min(maxOffset, Math.round(targetStart / stepMin))))
      e.preventDefault()
    },
    [zoom, domain, totalMinutes, maxOffset, onOffsetChange],
  )

  return (
    <div className="select-none">
      <svg
        ref={svgRef}
        width={MINI_W}
        height={MINI_H}
        onMouseDown={handleMouseDown}
        className={zoom !== '1m' ? 'cursor-pointer' : ''}
        style={{ display: 'block' }}
      >
        {/* Background */}
        <rect width={MINI_W} height={MINI_H} rx={4} fill="var(--muted)" />

        {/* Event bars */}
        {miniEvents.map((ev, i) => {
          const x = toX(ev.startMin)
          const w = Math.max(2, toX(ev.endMin) - x)
          return (
            <rect key={i} x={x} y={8} width={w} height={12} rx={1} fill={ev.color} opacity={0.55} />
          )
        })}

        {/* Viewport fill */}
        <rect x={viewX} y={0} width={viewW} height={MINI_H} fill="var(--foreground)" opacity={0.1} rx={4} />
        {/* Viewport border */}
        <rect
          x={viewX + 0.5} y={0.5}
          width={Math.max(1, viewW - 1)} height={MINI_H - 1}
          fill="none" stroke="var(--foreground)" strokeWidth={1.5} opacity={0.4} rx={4}
        />
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LlamaTimeTab
// ---------------------------------------------------------------------------
export function LlamaTimeTab() {
  const selectedPeriod = useCalendarStore((s) => s.selectedPeriod)
  const setSelectedPeriod = useCalendarStore((s) => s.setSelectedPeriod)
  const events = useCalendarStore((s) => s.events)
  const eventsLoading = useCalendarStore((s) => s.eventsLoading)
  const fetchEvents = useCalendarStore((s) => s.fetchEvents)
  const status = useCalendarStore((s) => s.status)


  const [zoom, setZoom] = useState<ZoomScale>('1m')
  const [windowOffset, setWindowOffset] = useState(0)

  const daysInMonth = new Date(selectedPeriod.year, selectedPeriod.month + 1, 0).getDate()
  const totalMinutes = daysInMonth * MINUTES_PER_DAY

  const zoomDays: Record<ZoomScale, number> = { '1w': 7, '2w': 14, '1m': daysInMonth }
  const windowDays = zoomDays[zoom]
  const maxOffset = Math.max(0, Math.ceil((daysInMonth - windowDays) / (zoom === '1w' ? 7 : 14)))

  const domainStart = windowOffset * (zoom === '1w' ? 7 : 14) * MINUTES_PER_DAY
  const domainEnd = Math.min(domainStart + windowDays * MINUTES_PER_DAY, totalMinutes)
  const domain: [number, number] = [domainStart, domainEnd]

  const isConnected = status === 'connected' || status === 'done' || status === 'loading'
  const periodOptions = generatePeriodOptions()
  const isInitialMount = useRef(true)

  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return }
    if (isConnected) fetchEvents()
  }, [selectedPeriod.year, selectedPeriod.month])

  const handleZoomChange = (v: string) => {
    if (v) { setZoom(v as ZoomScale); setWindowOffset(0) }
  }

  if (!isConnected) {
    return (
      <p className="text-muted-foreground text-sm">
        Connect Google Calendar in Integrations to see events.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar: period selector + refresh */}
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

        <Button variant="default" size="sm" onClick={fetchEvents} disabled={eventsLoading}>
          <RefreshCw className={`size-4 ${eventsLoading ? 'animate-spin' : ''}`} />
          Refresh Google Calendar
        </Button>
      </div>

      {events.length === 0 && !eventsLoading && (
        <p className="text-muted-foreground text-sm">
          Select a period or click Refresh to load events.
        </p>
      )}

      {events.length > 0 && (
        <Card>
          {/* Card header: zoom switcher (left) + mini-view (right) */}
          <div className="flex items-center justify-end gap-3 px-4 py-2 border-b">
            <ToggleGroup type="single" value={zoom} onValueChange={handleZoomChange} size="sm">
              <ToggleGroupItem value="1w">Week</ToggleGroupItem>
              <ToggleGroupItem value="2w">Bi-Week</ToggleGroupItem>
              <ToggleGroupItem value="1m">Month</ToggleGroupItem>
            </ToggleGroup>

            <MiniTimeline
              events={events}
              year={selectedPeriod.year}
              month={selectedPeriod.month}
              domain={domain}
              totalMinutes={totalMinutes}
              zoom={zoom}
              maxOffset={maxOffset}
              onOffsetChange={setWindowOffset}
            />
          </div>

          <CardContent className="overflow-x-auto p-0">
            <div style={{ minWidth: `max(100%, ${daysInMonth * 80}px)` }}>
              <TimelineChart
                events={events}
                year={selectedPeriod.year}
                month={selectedPeriod.month}
                domain={domain}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
