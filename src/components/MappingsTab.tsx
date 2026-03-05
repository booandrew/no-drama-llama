import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'

import { MappingForm } from '@/components/MappingForm'
import { Badge } from '@/components/ui/badge'
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
import type { MapKeywordIssue } from '@/lib/duckdb/queries'
import { useDuckDB } from '@/lib/duckdb/use-duckdb'
import { useMappingsStore } from '@/store/mappings'

export function MappingsTab() {
  const { isReady } = useDuckDB()
  const items = useMappingsStore((s) => s.items)
  const loading = useMappingsStore((s) => s.loading)
  const loadItems = useMappingsStore((s) => s.loadItems)
  const addItem = useMappingsStore((s) => s.addItem)
  const updateItem = useMappingsStore((s) => s.updateItem)
  const deleteItem = useMappingsStore((s) => s.deleteItem)

  const [formOpen, setFormOpen] = useState(false)
  const [editItem, setEditItem] = useState<MapKeywordIssue | null>(null)

  const reload = useCallback(() => {
    if (isReady) loadItems()
  }, [isReady, loadItems])

  useEffect(() => {
    reload()
  }, [reload])

  const handleAdd = () => {
    setEditItem(null)
    setFormOpen(true)
  }

  const handleEdit = (item: MapKeywordIssue) => {
    setEditItem(item)
    setFormOpen(true)
  }

  const handleSave = async (data: Omit<MapKeywordIssue, 'id'> & { id?: string }) => {
    if (data.id) {
      await updateItem({ ...data, id: data.id } as MapKeywordIssue)
    } else {
      await addItem(data)
    }
  }

  const handleDelete = async (id: string) => {
    await deleteItem(id)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Key Words to Project Issue Mapping</h2>
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
              No keyword mappings yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Keywords</TableHead>
                  <TableHead>Project Key</TableHead>
                  <TableHead>Issue Key</TableHead>
                  <TableHead>Issue Name</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {item.key_words.map((kw) => (
                          <Badge key={kw} variant="secondary">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{item.project_key ?? '-'}</TableCell>
                    <TableCell>{item.issue_key}</TableCell>
                    <TableCell>{item.issue_name ?? '-'}</TableCell>
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

      <MappingForm
        open={formOpen}
        onOpenChange={setFormOpen}
        item={editItem}
        onSave={handleSave}
      />
    </div>
  )
}
