import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'

import { CustomInputForm } from '@/components/CustomInputForm'
import { PeriodSelector } from '@/components/PeriodSelector'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { DdsCustomInput } from '@/lib/duckdb/queries'
import { useDuckDB } from '@/lib/duckdb/use-duckdb'
import { useCustomInputsStore } from '@/store/custom-inputs'

export function CustomInputsTab() {
  const { isReady } = useDuckDB()
  const items = useCustomInputsStore((s) => s.items)
  const loading = useCustomInputsStore((s) => s.loading)
  const loadItems = useCustomInputsStore((s) => s.loadItems)
  const addItem = useCustomInputsStore((s) => s.addItem)
  const updateItem = useCustomInputsStore((s) => s.updateItem)
  const deleteItem = useCustomInputsStore((s) => s.deleteItem)
  const periodMode = useCustomInputsStore((s) => s.periodMode)
  const selectedDate = useCustomInputsStore((s) => s.selectedDate)
  const customStart = useCustomInputsStore((s) => s.customStart)
  const customEnd = useCustomInputsStore((s) => s.customEnd)
  const setPeriodMode = useCustomInputsStore((s) => s.setPeriodMode)
  const setSelectedDate = useCustomInputsStore((s) => s.setSelectedDate)
  const setCustomRange = useCustomInputsStore((s) => s.setCustomRange)

  const [formOpen, setFormOpen] = useState(false)
  const [editItem, setEditItem] = useState<DdsCustomInput | null>(null)

  const reload = useCallback(() => {
    if (isReady) loadItems()
  }, [isReady, loadItems])

  useEffect(() => {
    reload()
  }, [reload, periodMode, selectedDate, customStart, customEnd])

  const handleAdd = () => {
    setEditItem(null)
    setFormOpen(true)
  }

  const handleEdit = (item: DdsCustomInput) => {
    setEditItem(item)
    setFormOpen(true)
  }

  const handleSave = async (data: Omit<DdsCustomInput, 'id'> & { id?: string }) => {
    if (data.id) {
      await updateItem({ ...data, id: data.id } as DdsCustomInput)
    } else {
      await addItem(data)
    }
  }

  const handleDelete = async (id: string) => {
    await deleteItem(id)
  }

  const formatDateTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <PeriodSelector
          periodMode={periodMode}
          selectedDate={selectedDate}
          customStart={customStart}
          customEnd={customEnd}
          setPeriodMode={setPeriodMode}
          setSelectedDate={setSelectedDate}
          setCustomRange={setCustomRange}
        />
        <Button size="sm" onClick={handleAdd}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-muted-foreground p-6 text-center text-sm">Loading...</div>
          ) : items.length === 0 ? (
            <div className="text-muted-foreground p-6 text-center text-sm">
              No custom inputs for this period.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.input}</TableCell>
                    <TableCell>{item.duration ?? '-'}</TableCell>
                    <TableCell>{item.time_unit ?? '-'}</TableCell>
                    <TableCell>{formatDateTime(item.start_time)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => handleEdit(item)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CustomInputForm
        open={formOpen}
        onOpenChange={setFormOpen}
        item={editItem}
        onSave={handleSave}
      />
    </div>
  )
}
