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

const ORG_CLIENT_ID = import.meta.env.VITE_JIRA_CLIENT_ID as string | undefined
const ORG_NAME = (import.meta.env.VITE_ORG_NAME as string) || 'Organization'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function JiraConnectDialog({ open, onOpenChange }: Props) {
  const [siteUrlInput, setSiteUrlInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [apiTokenInput, setApiTokenInput] = useState('')
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [tokenLoading, setTokenLoading] = useState(false)

  const hasOrgMethod = !!ORG_CLIENT_ID
  const canConnectToken = siteUrlInput.trim() && emailInput.trim() && apiTokenInput.trim()

  const connectOrg = () => {
    if (!ORG_CLIENT_ID) return
    onOpenChange(false)
    setTimeout(async () => {
      await useJiraStore.getState().startOAuth()
    }, 50)
  }

  const handleConnectToken = async () => {
    const raw = siteUrlInput.trim().replace(/\/+$/, '')
    const withScheme = raw.includes('://') ? raw : `https://${raw}`
    let site: string
    try {
      site = new URL(withScheme).hostname
    } catch {
      site = raw
    }

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

        <Tabs defaultValue={hasOrgMethod ? 'org' : 'token'}>
          <TabsList className="w-full">
            {hasOrgMethod && (
              <TabsTrigger value="org" className="flex-1">
                {ORG_NAME}
              </TabsTrigger>
            )}
            <TabsTrigger value="token" className="flex-1">
              API Token
            </TabsTrigger>
          </TabsList>

          {hasOrgMethod && (
            <TabsContent value="org" className="mt-4">
              <p className="text-muted-foreground mb-4 text-sm">
                Connect using the {ORG_NAME} organization Jira account.
              </p>
              <Button onClick={connectOrg} className="w-full">
                Connect with OAuth
              </Button>
            </TabsContent>
          )}

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
                  value={siteUrlInput || 'your-org.atlassian.net'}
                  onFocus={() => {
                    if (!siteUrlInput) setSiteUrlInput('your-org.atlassian.net')
                  }}
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
                {tokenLoading ? 'Connecting\u2026' : 'Connect to Jira'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
