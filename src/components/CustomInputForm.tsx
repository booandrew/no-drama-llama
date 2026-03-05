import { useState, useEffect } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { DdsCustomInput } from '@/lib/duckdb/queries'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: DdsCustomInput | null
  onSave: (item: Omit<DdsCustomInput, 'id'> & { id?: string }) => void
}

function todayDatetimeLocal() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

export function CustomInputForm({ open, onOpenChange, item, onSave }: Props) {
  const [input, setInput] = useState('')
  const [duration, setDuration] = useState('')
  const [timeUnit, setTimeUnit] = useState('hours')
  const [startTime, setStartTime] = useState(todayDatetimeLocal())

  useEffect(() => {
    if (item) {
      setInput(item.input)
      setDuration(item.duration != null ? String(item.duration) : '')
      setTimeUnit(item.time_unit ?? 'hours')
      setStartTime(item.start_time.slice(0, 16))
    } else {
      setInput('')
      setDuration('')
      setTimeUnit('hours')
      setStartTime(todayDatetimeLocal())
    }
  }, [item, open])

  const canSave = input.trim() && startTime

  const handleSave = () => {
    if (!canSave) return
    onSave({
      ...(item ? { id: item.id } : {}),
      input: input.trim(),
      duration: duration ? parseFloat(duration) : null,
      time_unit: duration ? timeUnit : null,
      start_time: new Date(startTime).toISOString(),
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit' : 'Add'} Custom Input</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ci-input">Description</Label>
            <Input
              id="ci-input"
              placeholder="What did you work on?"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="ci-duration">Duration</Label>
              <Input
                id="ci-duration"
                type="number"
                min="0"
                step="0.25"
                placeholder="e.g. 1.5"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Unit</Label>
              <Select value={timeUnit} onValueChange={setTimeUnit}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="minutes">Minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ci-start">Start Time</Label>
            <Input
              id="ci-start"
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          <Button onClick={handleSave} disabled={!canSave}>
            {item ? 'Update' : 'Add'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
