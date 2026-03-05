import { useTempoStore } from '@/store/tempo'

function headers() {
  const { accessToken } = useTempoStore.getState()
  if (!accessToken) throw new Error('Tempo not connected: no API token')
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
  }
}

// ── Types ─────────────────────────────────────────────────────────────

export interface TempoWorkloadScheme {
  id: number
  name: string
  days: { day: number; requiredSeconds: number }[]
}

export interface TempoHolidayScheme {
  id: number
  name: string
  holidays: {
    id: number
    name: string
    date: string
    durationSeconds: number
    type: string
  }[]
}

// ── API ───────────────────────────────────────────────────────────────

function handleAuth(res: Response) {
  if (res.status === 401) {
    useTempoStore.getState().setExpired()
    throw new Error('Tempo API token expired or revoked')
  }
  if (res.status === 403) {
    throw new Error('Tempo: insufficient permissions (403)')
  }
}

export async function fetchWorkloadSchemes(): Promise<TempoWorkloadScheme[]> {
  const res = await fetch('/tempo-api/4/workload-schemes', {
    headers: headers(),
  })
  handleAuth(res)
  if (!res.ok) throw new Error(`Tempo workload schemes: ${res.status}`)
  const data = await res.json()
  const schemes: TempoWorkloadScheme[] = []

  for (const s of data.results ?? []) {
    const detailRes = await fetch(`/tempo-api/4/workload-schemes/${s.id}`, {
      headers: headers(),
    })
    if (!detailRes.ok) continue
    const detail = await detailRes.json()
    schemes.push({
      id: s.id,
      name: s.name ?? '',
      days: (detail.days ?? []).map((d: { day: string; requiredSeconds: number }) => ({
        day: dayNameToNumber(d.day),
        requiredSeconds: d.requiredSeconds,
      })),
    })
  }

  return schemes
}

export async function fetchHolidaySchemes(
  dateStart: string,
  dateEnd: string,
): Promise<TempoHolidayScheme[]> {
  const res = await fetch('/tempo-api/4/holiday-schemes', {
    headers: headers(),
  })
  handleAuth(res)
  if (!res.ok) throw new Error(`Tempo holiday schemes: ${res.status}`)
  const data = await res.json()
  const schemes: TempoHolidayScheme[] = []

  for (const s of data.results ?? []) {
    const params = new URLSearchParams({ from: dateStart, to: dateEnd })
    const holRes = await fetch(`/tempo-api/4/holiday-schemes/${s.id}/holidays?${params}`, {
      headers: headers(),
    })
    if (!holRes.ok) continue
    const holData = await holRes.json()
    schemes.push({
      id: s.id,
      name: s.name ?? '',
      holidays: (holData.results ?? []).map(
        (h: { id: number; name: string; date: string; durationSeconds: number; type: string }) => ({
          id: h.id,
          name: h.name,
          date: h.date,
          durationSeconds: h.durationSeconds,
          type: h.type,
        }),
      ),
    })
  }

  return schemes
}

// ── Worklogs ─────────────────────────────────────────────────────────

interface TempoWorklogResult {
  tempoWorklogId: number
  jiraWorklogId?: number
  issue: { id: number }
  timeSpentSeconds: number
  startDate: string
  startTime?: string
  description?: string
}

interface TempoWorklogResponse {
  results: TempoWorklogResult[]
  metadata: { count: number; offset: number; limit: number }
}

export interface TempoWorklogs {
  worklogs: import('@/lib/jira').JiraWorklog[]
  issueIds: string[]
}

export async function fetchTempoWorklogs(
  accountId: string,
  dateStart: string,
  dateEnd: string,
): Promise<TempoWorklogs> {
  const limit = 1000
  let offset = 0
  const all: TempoWorklogResult[] = []

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const params = new URLSearchParams({
      from: dateStart.slice(0, 10),
      to: dateEnd.slice(0, 10),
      limit: String(limit),
      offset: String(offset),
    })
    const res = await fetch(`/tempo-api/4/worklogs/user/${accountId}?${params}`, {
      headers: headers(),
    })
    handleAuth(res)
    if (!res.ok) throw new Error(`Tempo worklogs: ${res.status}`)

    const data: TempoWorklogResponse = await res.json()
    all.push(...data.results)
    if (data.results.length < limit) break
    offset += limit
  }

  const issueIdSet = new Set<string>()
  const worklogs = all.map((w) => {
    const issueId = String(w.issue.id)
    issueIdSet.add(issueId)
    return {
      id: String(w.jiraWorklogId ?? w.tempoWorklogId),
      issueId,
      started: `${w.startDate}T${w.startTime || '00:00:00'}.000+0000`,
      timeSpent: String(w.timeSpentSeconds),
      comment: w.description != null ? JSON.stringify(w.description) : null,
      self: '',
    }
  })

  return { worklogs, issueIds: [...issueIdSet] }
}

function dayNameToNumber(name: string): number {
  const map: Record<string, number> = {
    SUNDAY: 0,
    MONDAY: 1,
    TUESDAY: 2,
    WEDNESDAY: 3,
    THURSDAY: 4,
    FRIDAY: 5,
    SATURDAY: 6,
  }
  return map[name.toUpperCase()] ?? -1
}
