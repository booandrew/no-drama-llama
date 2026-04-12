import type { Period } from '@/store/calendar'
import { getConnection } from './init'

function currentPeriod(): Period {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() }
}

function periodFromISO(dateStr: string): Period {
  const d = new Date(dateStr)
  return { year: d.getFullYear(), month: d.getMonth() }
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
export async function getLatestDataDate(): Promise<LatestDataResult | null> {
  const dateStr = await getLatestDbDate()
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
export async function getLatestDataMonth(): Promise<Period> {
  const result = await getLatestDataDate()
  return result?.period ?? currentPeriod()
}
