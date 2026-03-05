import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

import { PeriodSelector } from '@/components/PeriodSelector'
import { SortableTable } from '@/components/SortableTable'
import type { Column } from '@/components/SortableTable'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  readSrcJiraIssues,
  readSrcJiraWorklogs,
  readSrcCalendarEvents,
  readSrcTempoWorkloadDays,
  readSrcTempoHolidays,
  readDdsJiraIssues,
  readDdsJiraWorklogs,
  readDdsCalendarEvents,
  readDdsTempoDailyCapacity,
} from '@/lib/duckdb/queries'
import {
  syncJiraIssues,
  syncJiraWorklogs,
  syncCalendarEvents,
  syncTempoCapacity,
} from '@/lib/sync'
import { useDuckDB } from '@/lib/duckdb/use-duckdb'
import { useCalendarStore } from '@/store/calendar'
import { useJiraStore } from '@/store/jira'
import { useTempoStore } from '@/store/tempo'
import type { SourceSubtab, SourceView } from '@/store/sources'
import { useSourcesStore } from '@/store/sources'

// ── Column definitions ────────────────────────────────────────────────

const SRC_JIRA_ISSUES_COLS: Column[] = [
  { key: 'id', label: 'ID' },
  { key: 'key', label: 'Key' },
  { key: 'summary', label: 'Summary' },
  { key: 'project_key', label: 'Project' },
  { key: 'self', label: 'Self URL' },
  { key: 'loaded_at', label: 'Loaded At' },
]

const DDS_JIRA_ISSUES_COLS: Column[] = [
  { key: 'issue_id', label: 'Issue ID' },
  { key: 'issue_key', label: 'Key' },
  { key: 'issue_name', label: 'Name' },
  { key: 'project_key', label: 'Project' },
  { key: 'link', label: 'Link' },
]

const SRC_JIRA_WORKLOGS_COLS: Column[] = [
  { key: 'id', label: 'ID' },
  { key: 'issueId', label: 'Issue ID' },
  { key: 'started', label: 'Started' },
  { key: 'timeSpent', label: 'Time Spent' },
  { key: 'comment', label: 'Comment' },
  { key: 'self', label: 'Self URL' },
  { key: 'loaded_at', label: 'Loaded At' },
]

const DDS_JIRA_WORKLOGS_COLS: Column[] = [
  { key: 'worklog_id', label: 'Worklog ID' },
  { key: 'issue_id', label: 'Issue ID' },
  { key: 'issue_key', label: 'Issue Key' },
  { key: 'started', label: 'Started' },
  { key: 'time_spent', label: 'Time Spent' },
  { key: 'comment', label: 'Comment' },
  { key: 'link', label: 'Link' },
]

const SRC_GCAL_EVENTS_COLS: Column[] = [
  { key: 'id', label: 'ID' },
  { key: 'iCalUID', label: 'iCal UID' },
  { key: 'startDateTime', label: 'Start' },
  { key: 'endDateTime', label: 'End' },
  { key: 'summary', label: 'Summary' },
  { key: 'description', label: 'Description' },
  { key: 'visibility', label: 'Visibility' },
  { key: 'htmlLink', label: 'Link' },
  { key: 'loaded_at', label: 'Loaded At' },
]

const DDS_GCAL_EVENTS_COLS: Column[] = [
  { key: 'id', label: 'ID' },
  { key: 'event_cross_cal_id', label: 'Cross-Cal ID' },
  { key: 'start_time', label: 'Start' },
  { key: 'end_time', label: 'End' },
  { key: 'summary', label: 'Summary' },
  { key: 'description', label: 'Description' },
  { key: 'link', label: 'Link' },
]

// ── Tempo column definitions ──────────────────────────────────────────

const SRC_TEMPO_WORKLOAD_COLS: Column[] = [
  { key: 'scheme_id', label: 'Scheme ID' },
  { key: 'scheme_name', label: 'Scheme Name' },
  { key: 'day', label: 'Day (0=Sun)' },
  { key: 'required_seconds', label: 'Required Seconds' },
  { key: 'loaded_at', label: 'Loaded At' },
]

const SRC_TEMPO_HOLIDAYS_COLS: Column[] = [
  { key: 'scheme_id', label: 'Scheme ID' },
  { key: 'holiday_id', label: 'Holiday ID' },
  { key: 'name', label: 'Name' },
  { key: 'date', label: 'Date' },
  { key: 'duration_seconds', label: 'Duration (s)' },
  { key: 'type', label: 'Type' },
  { key: 'loaded_at', label: 'Loaded At' },
]

const DDS_TEMPO_DAILY_CAPACITY_COLS: Column[] = [
  { key: 'date', label: 'Date' },
  { key: 'day_of_week', label: 'Day of Week' },
  { key: 'required_seconds', label: 'Required Seconds' },
  { key: 'is_holiday', label: 'Holiday?' },
  { key: 'holiday_name', label: 'Holiday Name' },
]

type TempoView = 'workload-days' | 'holidays' | 'daily-capacity'

// ── Component ─────────────────────────────────────────────────────────

export function SourcesTab() {
  const { isReady } = useDuckDB()
  const activeSubtab = useSourcesStore((s) => s.activeSubtab)
  const activeView = useSourcesStore((s) => s.activeView)
  const syncing = useSourcesStore((s) => s.syncing)
  const setActiveSubtab = useSourcesStore((s) => s.setActiveSubtab)
  const setActiveView = useSourcesStore((s) => s.setActiveView)
  const setSyncing = useSourcesStore((s) => s.setSyncing)
  const getPeriod = useSourcesStore((s) => s.getPeriod)

  const jiraStatus = useJiraStore((s) => s.status)
  const calendarStatus = useCalendarStore((s) => s.status)
  const tempoStatus = useTempoStore((s) => s.status)

  const [tableData, setTableData] = useState<Record<string, unknown>[]>([])
  const [error, setError] = useState<string | null>(null)
  const [tempoView, setTempoView] = useState<TempoView>('daily-capacity')

  const isConnected = (s: string) => s === 'connected' || s === 'done' || s === 'loading'
  const jiraConnected = isConnected(jiraStatus)
  const calendarConnected = isConnected(calendarStatus)
  const tempoConnected = isConnected(tempoStatus)

  // Load table data
  const loadData = useCallback(async () => {
    if (!isReady) return
    setError(null)

    try {
      const { start, end } = getPeriod()
      let rows: Record<string, unknown>[] = []

      if (activeSubtab === 'jira-issues') {
        rows = (
          activeView === 'raw'
            ? await readSrcJiraIssues()
            : await readDdsJiraIssues()
        ) as unknown as Record<string, unknown>[]
      } else if (activeSubtab === 'jira-worklogs') {
        rows = (
          activeView === 'raw'
            ? await readSrcJiraWorklogs(start, end)
            : await readDdsJiraWorklogs(start, end)
        ) as unknown as Record<string, unknown>[]
      } else if (activeSubtab === 'tempo-capacity') {
        if (tempoView === 'workload-days') {
          rows = (await readSrcTempoWorkloadDays()) as unknown as Record<string, unknown>[]
        } else if (tempoView === 'holidays') {
          rows = (await readSrcTempoHolidays(start, end)) as unknown as Record<string, unknown>[]
        } else {
          rows = (await readDdsTempoDailyCapacity(start, end)) as unknown as Record<
            string,
            unknown
          >[]
        }
      } else {
        rows = (
          activeView === 'raw'
            ? await readSrcCalendarEvents(start, end)
            : await readDdsCalendarEvents(start, end)
        ) as unknown as Record<string, unknown>[]
      }

      setTableData(rows)
    } catch (e) {
      console.error('[Sources] Load failed:', e)
      setError((e as Error).message)
    }
  }, [isReady, activeSubtab, activeView, tempoView, getPeriod])

  const periodMode = useSourcesStore((s) => s.periodMode)
  const selectedDate = useSourcesStore((s) => s.selectedDate)
  const customStart = useSourcesStore((s) => s.customStart)
  const customEnd = useSourcesStore((s) => s.customEnd)
  const setPeriodMode = useSourcesStore((s) => s.setPeriodMode)
  const setSelectedDate = useSourcesStore((s) => s.setSelectedDate)
  const setCustomRange = useSourcesStore((s) => s.setCustomRange)

  useEffect(() => {
    loadData()
  }, [loadData, periodMode, selectedDate, customStart, customEnd])

  // Sync handlers
  const handleSync = async () => {
    setSyncing(activeSubtab, true)
    setError(null)

    try {
      const { start, end } = getPeriod()

      if (activeSubtab === 'jira-issues') {
        await syncJiraIssues()
      } else if (activeSubtab === 'jira-worklogs') {
        await syncJiraWorklogs(start, end)
      } else if (activeSubtab === 'tempo-capacity') {
        await syncTempoCapacity(start, end)
      } else {
        await syncCalendarEvents(start, end)
      }

      await loadData()
    } catch (e) {
      console.error('[Sources] Sync failed:', e)
      setError((e as Error).message)
    } finally {
      setSyncing(activeSubtab, false)
    }
  }

  const isSyncing = syncing[activeSubtab] ?? false
  const columns =
    activeSubtab === 'tempo-capacity'
      ? getTempoColumns(tempoView)
      : getColumns(activeSubtab, activeView)
  const isSourceConnected =
    activeSubtab === 'gcal-events'
      ? calendarConnected
      : activeSubtab === 'tempo-capacity'
        ? tempoConnected
        : jiraConnected

  return (
    <div className="flex flex-col gap-4">
      <PeriodSelector
        periodMode={periodMode}
        selectedDate={selectedDate}
        customStart={customStart}
        customEnd={customEnd}
        setPeriodMode={setPeriodMode}
        setSelectedDate={setSelectedDate}
        setCustomRange={setCustomRange}
      />

      <Tabs
        value={activeSubtab}
        onValueChange={(v) => setActiveSubtab(v as SourceSubtab)}
      >
        <TabsList>
          <TabsTrigger value="jira-issues">Jira Issues</TabsTrigger>
          <TabsTrigger value="jira-worklogs">Jira Worklogs</TabsTrigger>
          <TabsTrigger value="gcal-events">Google Calendar Events</TabsTrigger>
          <TabsTrigger value="tempo-capacity">Tempo Capacity</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center justify-between">
        {activeSubtab === 'tempo-capacity' ? (
          <ToggleGroup
            type="single"
            value={tempoView}
            onValueChange={(v) => v && setTempoView(v as TempoView)}
            size="sm"
          >
            <ToggleGroupItem value="daily-capacity">Daily Capacity</ToggleGroupItem>
            <ToggleGroupItem value="workload-days">Workload Days</ToggleGroupItem>
            <ToggleGroupItem value="holidays">Holidays</ToggleGroupItem>
          </ToggleGroup>
        ) : (
          <ToggleGroup
            type="single"
            value={activeView}
            onValueChange={(v) => v && setActiveView(v as SourceView)}
            size="sm"
          >
            <ToggleGroupItem value="data">DATA</ToggleGroupItem>
            <ToggleGroupItem value="raw">RAW</ToggleGroupItem>
          </ToggleGroup>
        )}

        <Button
          variant="default"
          size="sm"
          onClick={handleSync}
          disabled={isSyncing || !isSourceConnected}
        >
          <RefreshCw className={`size-4 ${isSyncing ? 'animate-spin' : ''}`} />
          Sync
        </Button>
      </div>

      {!isSourceConnected && (
        <p className="text-muted-foreground text-sm">
          Connect{' '}
          {activeSubtab === 'gcal-events'
            ? 'Google Calendar'
            : activeSubtab === 'tempo-capacity'
              ? 'Tempo'
              : 'Jira'}{' '}
          in Integrations to sync data.
        </p>
      )}

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Card>
        <CardContent className="p-0">
          <SortableTable columns={columns} data={tableData} />
        </CardContent>
      </Card>
    </div>
  )
}

// ── Column lookup ─────────────────────────────────────────────────────

function getColumns(subtab: SourceSubtab, view: SourceView): Column[] {
  if (subtab === 'jira-issues') {
    return view === 'raw' ? SRC_JIRA_ISSUES_COLS : DDS_JIRA_ISSUES_COLS
  }
  if (subtab === 'jira-worklogs') {
    return view === 'raw' ? SRC_JIRA_WORKLOGS_COLS : DDS_JIRA_WORKLOGS_COLS
  }
  return view === 'raw' ? SRC_GCAL_EVENTS_COLS : DDS_GCAL_EVENTS_COLS
}

function getTempoColumns(view: TempoView): Column[] {
  if (view === 'workload-days') return SRC_TEMPO_WORKLOAD_COLS
  if (view === 'holidays') return SRC_TEMPO_HOLIDAYS_COLS
  return DDS_TEMPO_DAILY_CAPACITY_COLS
}

