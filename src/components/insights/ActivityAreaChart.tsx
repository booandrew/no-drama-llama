import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PROJECTS } from './mock-data'

const chartConfig = {
  'PROJ-A': { label: 'PROJ-A', color: 'var(--chart-1)' },
  'PROJ-B': { label: 'PROJ-B', color: 'var(--chart-2)' },
  'PROJ-C': { label: 'PROJ-C', color: 'var(--chart-3)' },
  'PROJ-D': { label: 'PROJ-D', color: 'var(--chart-4)' },
  'PROJ-E': { label: 'PROJ-E', color: 'var(--chart-5)' },
} satisfies ChartConfig

interface Props {
  data: Record<string, string | number>[]
  periodLabel: string
  xAxisLabel: string
}

export function ActivityAreaChart({ data, periodLabel, xAxisLabel }: Props) {
  return (
    <Card className="flex min-h-0 flex-1 flex-col gap-0 py-0">
      <CardHeader className="shrink-0 px-4 py-3">
        <CardTitle>Activity Dynamics</CardTitle>
        <CardDescription>
          {periodLabel} — by {xAxisLabel}
        </CardDescription>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 px-2 pb-2">
        <ChartContainer config={chartConfig} className="aspect-auto h-full w-full">
          <AreaChart data={data} margin={{ left: 0, right: 16 }}>
            <CartesianGrid />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
            />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
            <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
            <ChartLegend content={<ChartLegendContent />} />
            {PROJECTS.map((project) => (
              <Area
                key={project}
                dataKey={project}
                type="monotone"
                fill={`var(--color-${project})`}
                stroke={`var(--color-${project})`}
                fillOpacity={0.1}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
