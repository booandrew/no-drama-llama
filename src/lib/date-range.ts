export interface DateRange {
  start: string
  endExclusive: string
}

interface PeriodStateLike {
  periodMode: 'day' | 'week' | 'month' | 'custom'
  selectedDate: string
  customStart: string | null
  customEnd: string | null
}

function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function formatDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function addDays(dateStr: string, days: number): string {
  const date = parseDate(dateStr)
  date.setUTCDate(date.getUTCDate() + days)
  return formatDate(date)
}

export function addMonths(dateStr: string, months: number): string {
  const date = parseDate(dateStr)
  date.setUTCMonth(date.getUTCMonth() + months)
  return formatDate(date)
}

export function getMonday(dateStr: string): string {
  const date = parseDate(dateStr)
  const day = date.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setUTCDate(date.getUTCDate() + diff)
  return formatDate(date)
}

export function getMonthStart(dateStr: string): string {
  const date = parseDate(dateStr)
  return formatDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)))
}

export function getNextMonthStart(dateStr: string): string {
  const date = parseDate(dateStr)
  return formatDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)))
}

export function daysBetweenInclusive(start: string, endInclusive: string): number {
  const diffMs = parseDate(endInclusive).getTime() - parseDate(start).getTime()
  return Math.floor(diffMs / 86_400_000) + 1
}

export function computePeriodRange(state: PeriodStateLike): DateRange {
  switch (state.periodMode) {
    case 'day':
      return { start: state.selectedDate, endExclusive: addDays(state.selectedDate, 1) }
    case 'week': {
      const start = getMonday(state.selectedDate)
      return { start, endExclusive: addDays(start, 7) }
    }
    case 'month': {
      const start = getMonthStart(state.selectedDate)
      return { start, endExclusive: getNextMonthStart(state.selectedDate) }
    }
    case 'custom': {
      const start = state.customStart ?? state.selectedDate
      const endInclusive = state.customEnd ?? state.selectedDate
      return { start, endExclusive: addDays(endInclusive, 1) }
    }
  }
}

export function getMonthDateRange(year: number, month: number): DateRange {
  const start = formatDate(new Date(Date.UTC(year, month, 1)))
  const endExclusive = formatDate(new Date(Date.UTC(year, month + 1, 1)))
  return { start, endExclusive }
}

export function toUtcStartOfDayIso(dateStr: string): string {
  return `${dateStr}T00:00:00.000Z`
}

export function toUtcIsoDateTimeRange(range: DateRange): { start: string; endExclusive: string } {
  return {
    start: toUtcStartOfDayIso(range.start),
    endExclusive: toUtcStartOfDayIso(range.endExclusive),
  }
}
