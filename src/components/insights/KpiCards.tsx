import { Clock, FolderKanban, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface KpiData {
  totalHours: number
  projectCount: number
  avgPerDay: number
  topProject: string
}

export function KpiCards({ data }: { data: KpiData }) {
  const items = [
    {
      label: 'Total Hours',
      value: `${data.totalHours}h`,
      icon: Clock,
    },
    {
      label: 'Projects',
      value: data.projectCount,
      icon: FolderKanban,
    },
    {
      label: 'Avg / Day',
      value: `${data.avgPerDay}h`,
      icon: TrendingUp,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="py-3">
          <CardContent className="flex items-center gap-3 px-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
              <item.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="text-3xl font-semibold">{item.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
