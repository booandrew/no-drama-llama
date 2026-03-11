import type { Period } from '@/store/calendar'
import {
  mockDdsJiraWorklogs,
  mockDdsCalendarEvents,
  mockDdsTasks,
} from '@/lib/mock-data'
import { getConnection } from './init'

function currentPeriod(): Period {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() }
}

function periodFromISO(dateStr: string): Period {
  const d = new Date(dateStr)
  return { year: d.getFullYear(), month: d.getMonth() }
}

function getLatestMockDate(): string | null {
  let max: string | null = null

  for (const w of mockDdsJiraWorklogs) {
    if (w.started && (!max || w.started > max)) max = w.started
  }
  for (const e of mockDdsCalendarEvents) {
    if (e.start_time && (!max || e.start_time > max)) max = e.start_time
  }
  for (const t of mockDdsTasks) {
    if (t.start_time && (!max || t.start_time > max)) max = t.start_time
  }

  return max
}

async function getLatestDbDate(): Promise<string | null> {
  try {
    const conn = getConnection()
    const result = await conn.query(`
      SELECT MAX(ts) as max_ts FROM (
        SELECT MAX(started) as ts FROM dds_jira_worklogs
        UNION ALL
        SELECT MAX(start_time) as ts FROM dds_tasks
      )
    `)
    const val = result.get(0)?.toJSON()?.max_ts
    return typeof val === 'string' ? val : null
  } catch {
    return null
  }
}

export interface LatestDataResult {
  period: Period
  /** ISO date string (YYYY-MM-DD) of the latest record */
  date: string
}

/**
 * Returns the latest date with existing DDS data, or null if no data exists.
 * Callers should fall back to "current date" when null.
 */
export async function getLatestDataDate(
  isMockMode: boolean,
): Promise<LatestDataResult | null> {
  const dateStr = isMockMode ? getLatestMockDate() : await getLatestDbDate()
  if (!dateStr) return null

  try {
    const period = periodFromISO(dateStr)
    // Normalize to YYYY-MM-DD (input may be a full ISO timestamp)
    const date = dateStr.slice(0, 10)
    return { period, date }
  } catch {
    return null
  }
}

/** @deprecated Use getLatestDataDate instead */
export async function getLatestDataMonth(isMockMode: boolean): Promise<Period> {
  const result = await getLatestDataDate(isMockMode)
  return result?.period ?? currentPeriod()
}
