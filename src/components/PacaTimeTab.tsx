import { useEffect, useRef } from 'react'
import { RefreshCw } from 'lucide-react'

import { GanttChart } from '@/components/GanttChart'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCalendarStore } from '@/store/calendar'

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
    <div className="flex flex-col gap-4">
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

        <Button variant="default" size="sm" onClick={handleRefresh} disabled={eventsLoading}>
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
        <GanttChart
          events={events}
          year={selectedPeriod.year}
          month={selectedPeriod.month}
        />
      )}
    </div>
  )
}
