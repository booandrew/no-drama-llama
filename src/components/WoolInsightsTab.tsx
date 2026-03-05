import { useMemo, useState } from 'react'
import { Clock, FolderKanban, TrendingUp } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { ProjectsBarChart } from './insights/ProjectsBarChart'
import { ActivityAreaChart } from './insights/ActivityAreaChart'
import { LlamaBucket } from './insights/LlamaBucket'
import { getKpiData, getProjectTotals, getTimelineData, MONTHS } from './insights/mock-data'

const YEARS = ['2024', '2025', '2026'] as const

export function WoolInsightsTab() {
  const [period, setPeriod] = useState<'month' | 'year'>('year')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState('2026')

  const kpi = useMemo(() => getKpiData(period, selectedMonth), [period, selectedMonth])
  const barData = useMemo(() => getProjectTotals(period, selectedMonth), [period, selectedMonth])
  const areaData = useMemo(() => getTimelineData(period, selectedMonth), [period, selectedMonth])

  const periodLabel =
    period === 'year' ? selectedYear : `${MONTHS[selectedMonth]} ${selectedYear}`

  return (
    <div className="flex h-[calc(100svh-theme(spacing.24))] flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between">
        <h2 className="text-2xl font-semibold">Wool Insights</h2>
        <div className="flex items-center gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {period === 'month' && (
            <Select
              value={String(selectedMonth)}
              onValueChange={(v) => setSelectedMonth(Number(v))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={m} value={String(i)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <ToggleGroup
            type="single"
            value={period}
            onValueChange={(v) => v && setPeriod(v as 'month' | 'year')}
            variant="outline"
          >
            <ToggleGroupItem value="month">Month</ToggleGroupItem>
            <ToggleGroupItem value="year">Year</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 gap-3"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr 1fr 2.5fr',
          gridTemplateRows: '1fr 1fr 2fr',
          gridTemplateAreas: `
            "herd hours projects bar"
            "herd hours avgday bar"
            "herd area area area"
          `,
        }}
      >
        <div className="flex min-h-0" style={{ gridArea: 'herd' }}>
          <LlamaBucket />
        </div>

        <Card className="flex items-center justify-center py-3" style={{ gridArea: 'hours' }}>
          <CardContent className="flex flex-col items-center gap-1 px-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Total Hours</p>
            <p className="text-3xl font-semibold">{kpi.totalHours}h</p>
          </CardContent>
        </Card>

        <Card className="flex items-center justify-center py-3" style={{ gridArea: 'projects' }}>
          <CardContent className="flex flex-col items-center gap-1 px-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Projects</p>
            <p className="text-2xl font-semibold">{kpi.projectCount}</p>
          </CardContent>
        </Card>

        <Card className="flex items-center justify-center py-3" style={{ gridArea: 'avgday' }}>
          <CardContent className="flex flex-col items-center gap-1 px-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Avg / Day</p>
            <p className="text-2xl font-semibold">{kpi.avgPerDay}h</p>
          </CardContent>
        </Card>

        <div className="flex min-h-0" style={{ gridArea: 'bar' }}>
          <ProjectsBarChart data={barData} periodLabel={periodLabel} />
        </div>

        <div className="flex min-h-0" style={{ gridArea: 'area' }}>
          <ActivityAreaChart
            data={areaData}
            periodLabel={periodLabel}
            xAxisLabel={period === 'year' ? 'month' : 'day'}
          />
        </div>
      </div>
    </div>
  )
}
