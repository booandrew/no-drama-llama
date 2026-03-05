import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { PeriodMode } from '@/store/sources'
import { computePeriod } from '@/store/sources'

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

function formatPeriodLabel(mode: PeriodMode, selectedDate: string): string {
  const d = new Date(selectedDate)
  switch (mode) {
    case 'day':
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    case 'week': {
      const period = computePeriod({
        periodMode: 'week',
        selectedDate,
        customStart: null,
        customEnd: null,
      })
      const s = new Date(period.start)
      const e = new Date(period.end)
      e.setDate(e.getDate() - 1)
      return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    }
    case 'month':
      return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
    default:
      return ''
  }
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function addMonths(dateStr: string, months: number) {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

export interface PeriodSelectorProps {
  periodMode: PeriodMode
  selectedDate: string
  customStart: string | null
  customEnd: string | null
  setPeriodMode: (mode: PeriodMode) => void
  setSelectedDate: (date: string) => void
  setCustomRange: (start: string, end: string) => string | null
}

export function PeriodSelector({
  periodMode,
  selectedDate,
  customStart,
  customEnd,
  setPeriodMode,
  setSelectedDate,
  setCustomRange,
}: PeriodSelectorProps) {
  const stepMap: Record<Exclude<PeriodMode, 'custom'>, () => { prev: string; next: string }> = {
    day: () => ({ prev: addDays(selectedDate, -1), next: addDays(selectedDate, 1) }),
    week: () => ({ prev: addDays(selectedDate, -7), next: addDays(selectedDate, 7) }),
    month: () => ({ prev: addMonths(selectedDate, -1), next: addMonths(selectedDate, 1) }),
  }

  const handleModeChange = (v: string) => {
    if (v) setPeriodMode(v as PeriodMode)
  }

  const handlePrev = () => {
    if (periodMode !== 'custom') setSelectedDate(stepMap[periodMode]().prev)
  }

  const handleNext = () => {
    if (periodMode !== 'custom') setSelectedDate(stepMap[periodMode]().next)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ToggleGroup type="single" value={periodMode} onValueChange={handleModeChange} size="sm">
        <ToggleGroupItem value="day">Day</ToggleGroupItem>
        <ToggleGroupItem value="week">Week</ToggleGroupItem>
        <ToggleGroupItem value="month">Month</ToggleGroupItem>
        <ToggleGroupItem value="custom">Custom</ToggleGroupItem>
      </ToggleGroup>

      {periodMode !== 'custom' && (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-7" onClick={handlePrev}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-medium min-w-28 text-center">
            {formatPeriodLabel(periodMode, selectedDate)}
          </span>
          <Button variant="ghost" size="icon" className="size-7" onClick={handleNext}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      {periodMode === 'custom' && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            className="h-8 w-36"
            value={customStart ?? selectedDate}
            onChange={(e) => {
              const end = customEnd ?? addDays(e.target.value, 30)
              setCustomRange(e.target.value, end)
            }}
          />
          <span className="text-muted-foreground text-sm">to</span>
          <Input
            type="date"
            className="h-8 w-36"
            value={customEnd ?? addDays(selectedDate, 30)}
            onChange={(e) => {
              const start = customStart ?? selectedDate
              const err = setCustomRange(start, e.target.value)
              if (err) alert(err)
            }}
          />
        </div>
      )}
    </div>
  )
}
