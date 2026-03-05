import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { MapKeywordIssue } from '@/lib/duckdb/queries'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: MapKeywordIssue | null
  onSave: (item: Omit<MapKeywordIssue, 'id'> & { id?: string }) => void
}

export function MappingForm({ open, onOpenChange, item, onSave }: Props) {
  const [keywords, setKeywords] = useState<string[]>([])
  const [keywordInput, setKeywordInput] = useState('')
  const [issueKey, setIssueKey] = useState('')
  const [issueName, setIssueName] = useState('')
  const [projectKey, setProjectKey] = useState('')

  useEffect(() => {
    if (item) {
      setKeywords(item.key_words)
      setIssueKey(item.issue_key)
      setIssueName(item.issue_name ?? '')
      setProjectKey(item.project_key ?? '')
    } else {
      setKeywords([])
      setIssueKey('')
      setIssueName('')
      setProjectKey('')
    }
    setKeywordInput('')
  }, [item, open])

  const addKeyword = () => {
    const kw = keywordInput.trim()
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw])
    }
    setKeywordInput('')
  }

  const removeKeyword = (kw: string) => {
    setKeywords(keywords.filter((k) => k !== kw))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addKeyword()
    }
  }

  const canSave = keywords.length > 0 && issueKey.trim()

  const handleSave = () => {
    if (!canSave) return
    onSave({
      ...(item ? { id: item.id } : {}),
      key_words: keywords,
      issue_key: issueKey.trim(),
      issue_name: issueName.trim() || null,
      project_key: projectKey.trim() || null,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit' : 'Add'} Keyword Mapping</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="mk-keywords">Keywords</Label>
            <div className="flex gap-2">
              <Input
                id="mk-keywords"
                placeholder="Type keyword and press Enter"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Button type="button" variant="secondary" size="sm" onClick={addKeyword}>
                Add
              </Button>
            </div>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {keywords.map((kw) => (
                  <Badge key={kw} variant="secondary" className="gap-1">
                    {kw}
                    <button
                      type="button"
                      onClick={() => removeKeyword(kw)}
                      className="hover:text-destructive ml-0.5"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="mk-project">Project Key</Label>
              <Input
                id="mk-project"
                placeholder="e.g. PROJ"
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="mk-issue">Issue Key</Label>
              <Input
                id="mk-issue"
                placeholder="e.g. PROJ-123"
                value={issueKey}
                onChange={(e) => setIssueKey(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="mk-name">Issue Name</Label>
            <Input
              id="mk-name"
              placeholder="Optional issue name"
              value={issueName}
              onChange={(e) => setIssueName(e.target.value)}
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
