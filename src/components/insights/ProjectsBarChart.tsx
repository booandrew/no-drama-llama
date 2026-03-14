import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
const chartConfig = {
  hours: {
    label: 'Hours',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

interface Props {
  data: { project: string; hours: number }[]
  periodLabel: string
  projectColors: Record<string, string>
}

export function ProjectsBarChart({ data, periodLabel, projectColors }: Props) {
  return (
    <Card className="flex min-h-0 flex-1 flex-col gap-0 py-0">
      <CardHeader className="shrink-0 px-4 py-3">
        <CardTitle>Hours by Project</CardTitle>
        <CardDescription>{periodLabel}</CardDescription>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 px-2 pb-2">
        <ChartContainer config={chartConfig} className="aspect-auto h-full w-full">
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16 }}>
            <CartesianGrid horizontal={false} />
            <YAxis
              dataKey="project"
              type="category"
              tickLine={false}
              axisLine={false}
              width={70}
              tick={{ fontSize: 12 }}
            />
            <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="hours" radius={[0, 4, 4, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.project}
                  fill={projectColors[entry.project] ?? 'var(--chart-1)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
