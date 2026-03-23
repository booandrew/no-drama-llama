interface TimeColumnProps {
  startHour?: number
  endHour?: number
  hourHeight: number
}

export function TimeColumn({ startHour = 0, endHour = 24, hourHeight }: TimeColumnProps) {
  const hours = []
  for (let h = startHour; h < endHour; h++) {
    hours.push(h)
  }

  return (
    <div className="shrink-0 w-14 border-r" style={{ paddingTop: hourHeight / 2 }}>
      {hours.map((h) => (
        <div
          key={h}
          className="relative text-right pr-2 text-xs text-muted-foreground"
          style={{ height: hourHeight }}
        >
          <span className="absolute -top-2 right-2">
            {String(h).padStart(2, '0')}:00
          </span>
        </div>
      ))}
    </div>
  )
}
