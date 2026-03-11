import { useState, useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PROJECTS, PROJECT_COLORS } from './mock-data'

const projectChartConfig = Object.fromEntries(
  PROJECTS.map((p) => [p, { label: p, color: PROJECT_COLORS[p] }]),
) satisfies ChartConfig

const allChartConfig: ChartConfig = {
  total: { label: 'Total', color: 'var(--foreground)' },
}

interface Props {
  data: Record<string, string | number>[]
  periodLabel: string
  xAxisLabel: string
}

export function ActivityAreaChart({ data, periodLabel, xAxisLabel }: Props) {
  const [mode, setMode] = useState<'all' | 'projects'>('all')
  const [activeProjects, setActiveProjects] = useState<Set<string>>(new Set(PROJECTS))

  const toggleProject = (project: string) => {
    if (mode === 'all') {
      setMode('projects')
      setActiveProjects(new Set([project]))
      return
    }
    setActiveProjects((prev) => {
      const next = new Set(prev)
      if (next.has(project)) {
        if (next.size > 1) {
          next.delete(project)
        }
      } else {
        next.add(project)
      }
      return next
    })
  }

  const selectAll = () => {
    setMode('all')
    setActiveProjects(new Set(PROJECTS))
  }

  const totalData = useMemo(
    () =>
      data.map((row) => ({
        month: row.month,
        total: PROJECTS.reduce((sum, p) => sum + (Number(row[p]) || 0), 0),
      })),
    [data],
  )

  const resolvedColors = useMemo(() => {
    const map: Record<string, string> = {}
    if (typeof window === 'undefined') return map
    const style = getComputedStyle(document.documentElement)
    for (const project of PROJECTS) {
      const match = PROJECT_COLORS[project].match(/var\((.+)\)/)
      if (match) {
        map[project] = style.getPropertyValue(match[1]).trim()
      }
    }
    return map
  }, [])

  return (
    <Card className="flex min-h-0 flex-1 flex-col gap-0 py-0">
      <CardHeader className="shrink-0 px-4 py-3">
        <CardTitle>Activity Dynamics</CardTitle>
        <CardDescription>
          {periodLabel} — by {xAxisLabel}
        </CardDescription>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <button
            onClick={selectAll}
            className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            style={
              mode === 'all'
                ? {
                    backgroundColor: 'var(--foreground)',
                    color: 'var(--background)',
                    borderColor: 'var(--foreground)',
                  }
                : {
                    backgroundColor: 'transparent',
                    color: 'var(--muted-foreground)',
                    borderColor: 'var(--border)',
                  }
            }
          >
            All
          </button>
          {PROJECTS.map((project) => {
            const isActive = mode === 'projects' && activeProjects.has(project)
            const color = resolvedColors[project] || PROJECT_COLORS[project]
            return (
              <button
                key={project}
                onClick={() => toggleProject(project)}
                className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                style={
                  isActive
                    ? {
                        backgroundColor: `oklch(from ${color} l c h / 1)`,
                        color: '#fff',
                        borderColor: `oklch(from ${color} l c h / 1)`,
                      }
                    : {
                        backgroundColor: 'transparent',
                        color: 'var(--muted-foreground)',
                        borderColor: 'var(--border)',
                      }
                }
              >
                {project}
              </button>
            )
          })}
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 px-2 pb-2">
        {mode === 'all' ? (
          <ChartContainer config={allChartConfig} className="aspect-auto h-full w-full">
            <AreaChart data={totalData} margin={{ left: 0, right: 16 }}>
              <CartesianGrid />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
                domain={[
                  (min: number) => Math.floor(min * 0.93),
                  (max: number) => Math.ceil(max * 1.07),
                ]}
              />
              <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
              <Area
                dataKey="total"
                type="monotone"
                fill="var(--color-total)"
                stroke="var(--color-total)"
                fillOpacity={0.1}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <ChartContainer config={projectChartConfig} className="aspect-auto h-full w-full">
            <AreaChart data={data} margin={{ left: 0, right: 16 }}>
              <CartesianGrid />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
                domain={[
                  (min: number) => Math.floor(min * 0.93),
                  (max: number) => Math.ceil(max * 1.07),
                ]}
              />
              <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
              {PROJECTS.map((project) =>
                activeProjects.has(project) ? (
                  <Area
                    key={project}
                    dataKey={project}
                    type="monotone"
                    fill={`var(--color-${project})`}
                    stroke={`var(--color-${project})`}
                    fillOpacity={0.1}
                  />
                ) : null,
              )}
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
