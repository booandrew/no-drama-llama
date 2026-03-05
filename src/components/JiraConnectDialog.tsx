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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useJiraStore } from '@/store/jira'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function JiraConnectDialog({ open, onOpenChange }: Props) {
  const { clientId, clientSecret, setCredentials } = useJiraStore()
  const [clientIdInput, setClientIdInput] = useState(clientId ?? '')
  const [clientSecretInput, setClientSecretInput] = useState(clientSecret ?? '')

  const [siteUrlInput, setSiteUrlInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [apiTokenInput, setApiTokenInput] = useState('')
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [tokenLoading, setTokenLoading] = useState(false)

  const canConnectOAuth = clientIdInput.trim() && clientSecretInput.trim()
  const canConnectToken = siteUrlInput.trim() && emailInput.trim() && apiTokenInput.trim()

  const handleConnectOAuth = () => {
    const id = clientIdInput.trim()
    const secret = clientSecretInput.trim()
    if (!id || !secret) return
    setCredentials(id, secret)
    onOpenChange(false)
    setTimeout(() => {
      useJiraStore.getState().startOAuth()
    }, 50)
  }

  const handleConnectToken = async () => {
    let site = siteUrlInput.trim()
    // Normalize: extract hostname from full URL
    if (site.includes('://')) {
      try {
        site = new URL(site).hostname
      } catch {
        // keep as-is
      }
    }
    // Strip trailing slashes
    site = site.replace(/\/+$/, '')

    const email = emailInput.trim()
    const token = apiTokenInput.trim()
    if (!site || !email || !token) return

    setTokenError(null)
    setTokenLoading(true)
    try {
      await useJiraStore.getState().connectWithToken(site, email, token)
      const { status, error } = useJiraStore.getState()
      if (status === 'connected') {
        onOpenChange(false)
      } else if (error) {
        setTokenError(error)
      }
    } catch (e) {
      setTokenError((e as Error).message)
    } finally {
      setTokenLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Jira</DialogTitle>
          <DialogDescription>Choose an authentication method to connect.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="token">
          <TabsList className="w-full">
            <TabsTrigger value="token" className="flex-1">
              API Token
            </TabsTrigger>
            <TabsTrigger value="oauth" className="flex-1">
              OAuth 2.0
            </TabsTrigger>
          </TabsList>

          <TabsContent value="token" className="mt-4">
            <div className="flex flex-col gap-4">
              <div className="text-muted-foreground space-y-1 text-sm">
                <p className="text-foreground font-medium">How to get your API token:</p>
                <ol className="list-inside list-decimal space-y-0.5">
                  <li>
                    Go to{' '}
                    <a
                      href="https://id.atlassian.com/manage-profile/security/api-tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary inline-flex items-center gap-0.5 underline"
                    >
                      Atlassian API Tokens
                      <ExternalLink className="size-3" />
                    </a>
                  </li>
                  <li>Click &quot;Create API token&quot;</li>
                  <li>Copy the generated token</li>
                </ol>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="jira-site-url">Site URL</Label>
                <Input
                  id="jira-site-url"
                  placeholder="yourcompany.atlassian.net"
                  value={siteUrlInput}
                  onChange={(e) => setSiteUrlInput(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="jira-email">Email</Label>
                <Input
                  id="jira-email"
                  type="email"
                  placeholder="you@company.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="jira-api-token">API Token</Label>
                <Input
                  id="jira-api-token"
                  type="password"
                  placeholder="API Token"
                  value={apiTokenInput}
                  onChange={(e) => setApiTokenInput(e.target.value)}
                />
              </div>

              {tokenError && <p className="text-destructive text-sm">{tokenError}</p>}

              <Button
                onClick={handleConnectToken}
                disabled={!canConnectToken || tokenLoading}
                className="w-full"
              >
                {tokenLoading ? 'Connecting…' : 'Connect to Jira'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="oauth" className="mt-4">
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
                    Under Permissions, add scopes:{' '}
                    <code className="bg-muted rounded px-1 text-xs">read:jira-work</code>{' '}
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

              <Button onClick={handleConnectOAuth} disabled={!canConnectOAuth} className="w-full">
                Connect to Jira
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
