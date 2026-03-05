import type {
  SrcJiraIssue,
  SrcJiraWorklog,
  SrcCalendarEvent,
  SrcTempoWorkloadDay,
  SrcTempoHoliday,
  DdsJiraIssue,
  DdsJiraWorklog,
  DdsCalendarEvent,
  DdsTempoDailyCapacity,
  DdsTask,
} from './queries'
import {
  mockSrcJiraIssues,
  mockSrcJiraWorklogs,
  mockSrcCalendarEvents,
  mockSrcTempoWorkloadDays,
  mockSrcTempoHolidays,
  mockDdsJiraIssues,
  mockDdsJiraWorklogs,
  mockDdsCalendarEvents,
  mockDdsTempoDailyCapacity,
  mockDdsTasks,
} from '@/lib/mock-data'

function filterByDateRange<T>(rows: T[], field: keyof T, start: string, end: string): T[] {
  return rows.filter((r) => {
    const val = r[field]
    if (typeof val !== 'string') return false
    return val >= start && val < end
  })
}

export function readSrcJiraIssues(): Promise<(SrcJiraIssue & { loaded_at: string })[]> {
  const sorted = [...mockSrcJiraIssues].sort((a, b) => a.key.localeCompare(b.key))
  return Promise.resolve(sorted)
}

export function readSrcJiraWorklogs(
  dateStart: string,
  dateEnd: string,
): Promise<(SrcJiraWorklog & { loaded_at: string })[]> {
  const filtered = filterByDateRange(mockSrcJiraWorklogs, 'started', dateStart, dateEnd)
  return Promise.resolve(filtered.sort((a, b) => a.started.localeCompare(b.started)))
}

export function readSrcCalendarEvents(
  dateStart: string,
  dateEnd: string,
): Promise<(SrcCalendarEvent & { loaded_at: string })[]> {
  const filtered = mockSrcCalendarEvents.filter((e) => {
    if (!e.startDateTime) return false
    return e.startDateTime >= dateStart && e.startDateTime < dateEnd
  })
  return Promise.resolve(
    filtered.sort((a, b) => (a.startDateTime ?? '').localeCompare(b.startDateTime ?? '')),
  )
}

export function readSrcTempoWorkloadDays(): Promise<
  (SrcTempoWorkloadDay & { loaded_at: string })[]
> {
  const sorted = [...mockSrcTempoWorkloadDays].sort(
    (a, b) => a.scheme_id.localeCompare(b.scheme_id) || a.day - b.day,
  )
  return Promise.resolve(sorted)
}

export function readSrcTempoHolidays(
  dateStart: string,
  dateEnd: string,
): Promise<(SrcTempoHoliday & { loaded_at: string })[]> {
  const filtered = filterByDateRange(mockSrcTempoHolidays, 'date', dateStart, dateEnd)
  return Promise.resolve(filtered.sort((a, b) => a.date.localeCompare(b.date)))
}

export function readDdsJiraIssues(): Promise<DdsJiraIssue[]> {
  const sorted = [...mockDdsJiraIssues].sort((a, b) => a.issue_key.localeCompare(b.issue_key))
  return Promise.resolve(sorted)
}

export function readDdsJiraWorklogs(dateStart: string, dateEnd: string): Promise<DdsJiraWorklog[]> {
  const filtered = filterByDateRange(mockDdsJiraWorklogs, 'started', dateStart, dateEnd)
  return Promise.resolve(filtered.sort((a, b) => a.started.localeCompare(b.started)))
}

export function readDdsCalendarEvents(
  dateStart: string,
  dateEnd: string,
): Promise<DdsCalendarEvent[]> {
  const filtered = mockDdsCalendarEvents.filter((e) => {
    if (!e.start_time) return false
    return e.start_time >= dateStart && e.start_time < dateEnd
  })
  return Promise.resolve(
    filtered.sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? '')),
  )
}

export function readDdsTempoDailyCapacity(
  dateStart: string,
  dateEnd: string,
): Promise<DdsTempoDailyCapacity[]> {
  const filtered = filterByDateRange(mockDdsTempoDailyCapacity, 'date', dateStart, dateEnd)
  return Promise.resolve(filtered.sort((a, b) => a.date.localeCompare(b.date)))
}

export function readDdsTasks(dateStart: string, dateEnd: string): Promise<DdsTask[]> {
  const filtered = mockDdsTasks.filter((t) => {
    if (!t.start_time) return false
    return t.start_time >= dateStart && t.start_time < dateEnd
  })
  return Promise.resolve(
    filtered.sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? '')),
  )
}
