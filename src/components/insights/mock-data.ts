export const PROJECTS = ['PROJ-A', 'PROJ-B', 'PROJ-C', 'PROJ-D', 'PROJ-E'] as const

export const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

// Monthly hours per project (12 months x 5 projects)
export const monthlyData = MONTHS.map((month, i) => ({
  month,
  'PROJ-A': [42, 38, 52, 45, 48, 55, 40, 50, 47, 53, 44, 46][i],
  'PROJ-B': [30, 35, 28, 32, 38, 25, 33, 36, 30, 28, 34, 31][i],
  'PROJ-C': [18, 22, 20, 25, 15, 28, 24, 18, 22, 20, 26, 23][i],
  'PROJ-D': [12, 8, 15, 10, 14, 8, 16, 12, 10, 14, 8, 13][i],
  'PROJ-E': [6, 10, 5, 8, 5, 4, 7, 4, 11, 5, 8, 7][i],
}))

// Aggregated hours per project for bar chart
export function getProjectTotals(period: 'month' | 'year', monthIndex: number) {
  const data = period === 'year' ? monthlyData : [monthlyData[monthIndex]]

  return PROJECTS.map((project) => ({
    project,
    hours: data.reduce((sum, row) => sum + (row[project] ?? 0), 0),
  })).sort((a, b) => b.hours - a.hours)
}

// Area chart data — monthly or daily breakdown
export function getTimelineData(period: 'month' | 'year', monthIndex: number) {
  if (period === 'year') {
    return monthlyData
  }

  // For month view: generate daily data (simplified — 4 weeks)
  const row = monthlyData[monthIndex]
  const days = [1, 5, 8, 12, 15, 18, 22, 25, 28]
  return days.map((day) => ({
    month: `${day}`,
    'PROJ-A': Math.round((row['PROJ-A'] / days.length) * (0.6 + Math.random() * 0.8)),
    'PROJ-B': Math.round((row['PROJ-B'] / days.length) * (0.6 + Math.random() * 0.8)),
    'PROJ-C': Math.round((row['PROJ-C'] / days.length) * (0.6 + Math.random() * 0.8)),
    'PROJ-D': Math.round((row['PROJ-D'] / days.length) * (0.6 + Math.random() * 0.8)),
    'PROJ-E': Math.round((row['PROJ-E'] / days.length) * (0.6 + Math.random() * 0.8)),
  }))
}

// KPI data
export function getKpiData(period: 'month' | 'year', monthIndex: number) {
  const totals = getProjectTotals(period, monthIndex)
  const totalHours = totals.reduce((s, t) => s + t.hours, 0)
  const projectCount = totals.filter((t) => t.hours > 0).length
  const workingDays = period === 'year' ? 260 : 22
  const avgPerDay = +(totalHours / workingDays).toFixed(1)
  const topProject = totals[0]?.project ?? '-'

  return { totalHours, projectCount, avgPerDay, topProject }
}
