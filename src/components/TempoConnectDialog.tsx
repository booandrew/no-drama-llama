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
import { useTempoStore } from '@/store/tempo'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TempoConnectDialog({ open, onOpenChange }: Props) {
  const setToken = useTempoStore((s) => s.setToken)
  const [tokenInput, setTokenInput] = useState('')
  const [siteInput, setSiteInput] = useState('')
  const [connecting, setConnecting] = useState(false)

  const tempoSettingsPath =
    '/plugins/servlet/ac/io.tempo.jira/tempo-app#!/configuration/api-integration'

  function resolveSiteBase(input: string): string | null {
    const trimmed = input.trim().replace(/\/+$/, '')
    if (!trimmed) return null
    const withScheme = trimmed.includes('://') ? trimmed : `https://${trimmed}`
    try {
      const url = new URL(withScheme)
      return `${url.protocol}//${url.host}`
    } catch {
      return null
    }
  }

  const resolvedBase = resolveSiteBase(siteInput)
  const tempoSettingsUrl = resolvedBase ? `${resolvedBase}${tempoSettingsPath}` : null
  const tempoSettingsDisplay = resolvedBase
    ? `${resolvedBase}${tempoSettingsPath}`
    : `https://<your-org>.atlassian.net${tempoSettingsPath}`

  const canConnect = tokenInput.trim().length > 0

  const handleConnect = async () => {
    const token = tokenInput.trim()
    if (!token) return
    setConnecting(true)
    try {
      await setToken(token)
      onOpenChange(false)
    } finally {
      setConnecting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Connect Tempo</DialogTitle>
          <DialogDescription>Paste your Tempo API token to connect timesheets.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="text-muted-foreground space-y-1 text-sm">
            <p className="text-foreground font-medium">How to get your API token:</p>
            <ol className="list-inside list-decimal space-y-0.5">
              <li>
                Open <strong>Tempo Settings</strong> &rarr;{' '}
                <strong>Data Access</strong> &rarr; <strong>API Integration</strong>
                <div className="mt-1 ml-1 space-y-1">
                  <Input
                    value={siteInput || 'your-org.atlassian.net'}
                    onFocus={() => {
                      if (!siteInput) setSiteInput('your-org.atlassian.net')
                    }}
                    onChange={(e) => setSiteInput(e.target.value)}
                    className="h-7 text-xs"
                  />
                  {tempoSettingsUrl ? (
                    <a
                      href={tempoSettingsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary inline-flex items-center gap-0.5 text-xs underline break-all"
                    >
                      {tempoSettingsDisplay}
                      <ExternalLink className="size-3 shrink-0" />
                    </a>
                  ) : (
                    <code className="text-muted-foreground block text-xs select-all break-all">
                      {tempoSettingsDisplay}
                    </code>
                  )}
                </div>
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

          <Button onClick={handleConnect} disabled={!canConnect || connecting} className="w-full">
            {connecting ? 'Connecting\u2026' : 'Connect to Tempo'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
