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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useJiraStore } from '@/store/jira'

const ORG_CLIENT_ID = import.meta.env.VITE_JIRA_CLIENT_ID as string | undefined

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function readPersonalClientId(): string {
  try {
    const raw = localStorage.getItem('jira-storage')
    if (!raw) return ''
    const parsed = JSON.parse(raw)
    return parsed?.state?.personalClientId ?? ''
  } catch {
    return ''
  }
}

export function JiraConnectDialog({ open, onOpenChange }: Props) {
  const [clientIdInput, setClientIdInput] = useState('')

  const [siteUrlInput, setSiteUrlInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [apiTokenInput, setApiTokenInput] = useState('')
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [tokenLoading, setTokenLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setClientIdInput(readPersonalClientId())
    }
  }, [open])

  const hasOrgMethod = !!ORG_CLIENT_ID
  const canConnectPersonalOAuth = clientIdInput.trim()
  const canConnectToken = siteUrlInput.trim() && emailInput.trim() && apiTokenInput.trim()

  const connectOrg = () => {
    if (!ORG_CLIENT_ID) return
    onOpenChange(false)
    setTimeout(async () => {
      await useJiraStore.getState().startOAuth('oauth-org', ORG_CLIENT_ID)
    }, 50)
  }

  const connectPersonalOAuth = () => {
    const id = clientIdInput.trim()
    if (!id) return
    onOpenChange(false)
    setTimeout(async () => {
      await useJiraStore.getState().startOAuth('oauth-personal', id)
    }, 50)
  }

  const handleConnectToken = async () => {
    let site = siteUrlInput.trim()
    if (site.includes('://')) {
      try {
        site = new URL(site).hostname
      } catch {
        // keep as-is
      }
    }
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

        <Tabs defaultValue={hasOrgMethod ? 'org' : 'personal'}>
          <TabsList className="w-full">
            {hasOrgMethod && (
              <TabsTrigger value="org" className="flex-1">
                T1A
              </TabsTrigger>
            )}
            <TabsTrigger value="personal" className="flex-1">
              Personal
            </TabsTrigger>
            <TabsTrigger value="token" className="flex-1">
              API Token
            </TabsTrigger>
          </TabsList>

          {hasOrgMethod && (
            <TabsContent value="org" className="mt-4">
              <p className="text-muted-foreground mb-4 text-sm">
                Connect using the T1A organization Jira account.
              </p>
              <Button onClick={connectOrg} className="w-full">
                Connect with T1A
              </Button>
            </TabsContent>
          )}

          <TabsContent value="personal" className="mt-4">
            <PersonalOAuthForm
              clientIdInput={clientIdInput}
              setClientIdInput={setClientIdInput}
              onConnect={connectPersonalOAuth}
              canConnect={!!canConnectPersonalOAuth}
            />
          </TabsContent>

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
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function PersonalOAuthForm({
  clientIdInput,
  setClientIdInput,
  onConnect,
  canConnect,
}: {
  clientIdInput: string
  setClientIdInput: (v: string) => void
  onConnect: () => void
  canConnect: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="text-muted-foreground space-y-1 text-sm">
        <p className="text-foreground font-medium">How to get your Client ID:</p>
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
            <code className="bg-muted rounded px-1 text-xs">read:me</code>
          </li>
          <li>Copy Client ID from Settings</li>
        </ol>
      </div>

      <Input
        placeholder="Client ID"
        value={clientIdInput}
        onChange={(e) => setClientIdInput(e.target.value)}
      />

      <Button onClick={onConnect} disabled={!canConnect} className="w-full">
        Connect with Personal Account
      </Button>
    </div>
  )
}
