import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTempoStore } from '@/store/tempo'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TempoConnectDialog({ open, onOpenChange }: Props) {
  const { accessToken, setToken } = useTempoStore()
  const [tokenInput, setTokenInput] = useState(accessToken ?? '')

  // Sync input when dialog opens (handles Zustand rehydration timing)
  useEffect(() => {
    if (open && accessToken) setTokenInput(accessToken)
  }, [open, accessToken])

  const canConnect = tokenInput.trim().length > 0

  const handleConnect = () => {
    const token = tokenInput.trim()
    if (!token) return
    setToken(token)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Tempo</DialogTitle>
          <DialogDescription>Paste your Tempo API token to connect timesheets.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="text-muted-foreground space-y-1 text-sm">
            <p className="text-foreground font-medium">How to get your API token:</p>
            <ol className="list-inside list-decimal space-y-0.5">
              <li>
                Open{' '}
                <a
                  href="https://app.tempo.io/timesheets/settings/api-integration"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-0.5 underline"
                >
                  Tempo Settings
                  <ExternalLink className="size-3" />
                </a>{' '}
                &rarr; <strong>Data Access &rarr; API Integration</strong>
              </li>
              <li>
                Click <strong>New Token</strong>
              </li>
              <li>
                Select scope: <strong>Schemes</strong> (View)
              </li>
              <li>Copy the generated token (shown only once)</li>
            </ol>
            <p className="mt-2">
              <a
                href="https://help.tempo.io/timesheets/latest/using-rest-api-integrations"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary inline-flex items-center gap-0.5 underline"
              >
                Tempo API Integration docs
                <ExternalLink className="size-3" />
              </a>
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tempo-api-token">API Token</Label>
            <Input
              id="tempo-api-token"
              type="password"
              placeholder="Paste your Tempo API token"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
            />
          </div>

          <Button onClick={handleConnect} disabled={!canConnect} className="w-full">
            Connect to Tempo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
