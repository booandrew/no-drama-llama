import { useState } from 'react'
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
import { useJiraStore } from '@/store/jira'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function JiraConnectDialog({ open, onOpenChange }: Props) {
  const { clientId, clientSecret, setCredentials } = useJiraStore()
  const [clientIdInput, setClientIdInput] = useState(clientId ?? '')
  const [clientSecretInput, setClientSecretInput] = useState(clientSecret ?? '')

  const canConnect = clientIdInput.trim() && clientSecretInput.trim()

  const handleConnect = () => {
    const id = clientIdInput.trim()
    const secret = clientSecretInput.trim()
    if (!id || !secret) return
    setCredentials(id, secret)
    onOpenChange(false)
    // Small delay to let state persist before redirect
    setTimeout(() => {
      useJiraStore.getState().startOAuth()
    }, 50)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Jira</DialogTitle>
          <DialogDescription>
            Enter your Atlassian OAuth 2.0 app credentials to connect.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="text-muted-foreground space-y-1 text-sm">
            <p className="text-foreground font-medium">How to get your credentials:</p>
            <ol className="list-inside list-decimal space-y-0.5">
              <li>
                Go to{' '}
                <a
                  href="https://developer.atlassian.com/console/myapps/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-0.5 underline"
                >
                  Atlassian Developer Console
                  <ExternalLink className="size-3" />
                </a>
              </li>
              <li>Create an OAuth 2.0 integration (or select existing)</li>
              <li>
                Under Authorization, add callback URL:{' '}
                <code className="bg-muted rounded px-1 text-xs">{window.location.origin}</code>
              </li>
              <li>
                Under Permissions, add scopes: <code className="bg-muted rounded px-1 text-xs">read:jira-work</code>{' '}
                <code className="bg-muted rounded px-1 text-xs">read:jira-user</code>
              </li>
              <li>Copy Client ID and Secret from Settings</li>
            </ol>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="jira-client-id">Client ID</Label>
            <Input
              id="jira-client-id"
              placeholder="Client ID"
              value={clientIdInput}
              onChange={(e) => setClientIdInput(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="jira-client-secret">Client Secret</Label>
            <Input
              id="jira-client-secret"
              type="password"
              placeholder="Client Secret"
              value={clientSecretInput}
              onChange={(e) => setClientSecretInput(e.target.value)}
            />
          </div>

          <Button onClick={handleConnect} disabled={!canConnect} className="w-full">
            Connect to Jira
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
