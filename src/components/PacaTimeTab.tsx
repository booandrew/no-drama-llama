import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'

import { GanttChart } from '@/components/GanttChart'
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
import { useCalendarStore } from '@/store/calendar'
// import { useJiraStore } from '@/store/jira'

type ZoomScale = '1w' | '2w' | '1m'

const FIXED_DAY_WIDTH: Record<ZoomScale, number | null> = {
  '1w': 140,
  '2w': 70,
  '1m': null, // auto-fill container
}

const MIN_DAY_WIDTH = 32
const GANTT_MARGIN_LR = 180 + 20 // MARGIN.left + MARGIN.right from GanttChart

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

export function PacaTimeTab() {
  const selectedPeriod = useCalendarStore((s) => s.selectedPeriod)
  const setSelectedPeriod = useCalendarStore((s) => s.setSelectedPeriod)
  const events = useCalendarStore((s) => s.events)
  const eventsLoading = useCalendarStore((s) => s.eventsLoading)
  const fetchEvents = useCalendarStore((s) => s.fetchEvents)
  const status = useCalendarStore((s) => s.status)

  const [zoom, setZoom] = useState<ZoomScale>('1m')
  const [containerWidth, setContainerWidth] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentBoxSize[0].inlineSize))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const daysInMonth = new Date(selectedPeriod.year, selectedPeriod.month + 1, 0).getDate()
  const fixedWidth = FIXED_DAY_WIDTH[zoom]
  const dayWidth = fixedWidth ?? Math.max(MIN_DAY_WIDTH, (containerWidth - GANTT_MARGIN_LR) / daysInMonth)

  const isConnected = status === 'connected' || status === 'done' || status === 'loading'
  const periodOptions = generatePeriodOptions()
  const isInitialMount = useRef(true)

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    if (isConnected) {
      fetchEvents()
    }
  }, [selectedPeriod.year, selectedPeriod.month])

  const handlePeriodChange = (value: string) => {
    setSelectedPeriod(valueToPeriod(value))
  }

  const handleRefresh = () => {
    fetchEvents()
  }

  if (!isConnected) {
    return (
      <p className="text-muted-foreground text-sm">
        Connect Google Calendar in Integrations to see events.
      </p>
    )
  }

  return (
    <div ref={wrapperRef} className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Select
          value={periodToValue(selectedPeriod.year, selectedPeriod.month)}
          onValueChange={handlePeriodChange}
        >
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periodOptions.map((opt) => (
              <SelectItem
                key={periodToValue(opt.year, opt.month)}
                value={periodToValue(opt.year, opt.month)}
              >
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={zoom}
            onValueChange={(v) => v && setZoom(v as ZoomScale)}
            size="sm"
          >
            <ToggleGroupItem value="1w">1W</ToggleGroupItem>
            <ToggleGroupItem value="2w">2W</ToggleGroupItem>
            <ToggleGroupItem value="1m">1M</ToggleGroupItem>
          </ToggleGroup>

          <Button variant="default" size="sm" onClick={handleRefresh} disabled={eventsLoading}>
            <RefreshCw className={`size-4 ${eventsLoading ? 'animate-spin' : ''}`} />
            Refresh Google Calendar
          </Button>
        </div>
      </div>

      {events.length === 0 && !eventsLoading && (
        <p className="text-muted-foreground text-sm">
          Select a period or click Refresh to load events.
        </p>
      )}

      {events.length > 0 && (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <GanttChart
              events={events}
              year={selectedPeriod.year}
              month={selectedPeriod.month}
              dayWidth={dayWidth}
            />
          </CardContent>
        </Card>
      )}

    </div>
  )
}
