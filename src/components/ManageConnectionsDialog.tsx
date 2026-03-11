import { useEffect, useRef, useState } from 'react'
import { ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCalendarStore } from '@/store/calendar'
import type { CalendarAuthMethod, ConnectionHealth } from '@/store/calendar'
import { useJiraStore } from '@/store/jira'
import { useTempoStore } from '@/store/tempo'

// ── Shared ────────────────────────────────────────────────────────────

function StatusDot({ health, status }: { health: ConnectionHealth; status: string }) {
  if (status === 'idle') return null

  const isUnhealthy = health === 'unhealthy' || status === 'error' || status === 'expired'
  const color = isUnhealthy ? 'bg-red-500' : 'bg-green-500'

  return <span className={`inline-block size-2.5 shrink-0 rounded-full ${color}`} />
}

function StatusBadge({ health, status }: { health: ConnectionHealth; status: string }) {
  if (status === 'idle') return null

  const isUnhealthy = health === 'unhealthy' || status === 'error' || status === 'expired'

  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <StatusDot health={health} status={status} />
      {isUnhealthy ? 'Disconnected' : 'Connected'}
    </span>
  )
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTab?: string
}

export function ManageConnectionsDialog({ open, onOpenChange, defaultTab }: Props) {
  const calStatus = useCalendarStore((s) => s.status)
  const jiraStatus = useJiraStore((s) => s.status)
  const tempoStatus = useTempoStore((s) => s.status)

  // Pick default tab: first unhealthy, or first disconnected, or gcal
  const computeDefault = () => {
    if (defaultTab) return defaultTab
    const statuses = [
      { key: 'gcal', status: calStatus },
      { key: 'jira', status: jiraStatus },
      { key: 'tempo', status: tempoStatus },
    ]
    const unhealthy = statuses.find((s) => s.status === 'error' || s.status === 'expired')
    if (unhealthy) return unhealthy.key
    return 'gcal'
  }

  const [activeTab, setActiveTab] = useState(computeDefault)

  // Sync tab when dialog opens with a specific tab
  useEffect(() => {
    if (open) setActiveTab(computeDefault())
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Connections</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="gcal" className="flex-1 gap-1.5">
              <StatusDot health={useCalendarStore.getState().connectionHealth} status={calStatus} />
              Google Calendar
            </TabsTrigger>
            <TabsTrigger value="jira" className="flex-1 gap-1.5">
              <StatusDot health={useJiraStore.getState().connectionHealth} status={jiraStatus} />
              Jira
            </TabsTrigger>
            <TabsTrigger value="tempo" className="flex-1 gap-1.5">
              <StatusDot health={useTempoStore.getState().connectionHealth} status={tempoStatus} />
              Tempo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gcal" className="mt-4">
            <GCalTab />
          </TabsContent>
          <TabsContent value="jira" className="mt-4">
            <JiraTab />
          </TabsContent>
          <TabsContent value="tempo" className="mt-4">
            <TempoTab />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

// ── Shared env ────────────────────────────────────────────────────────

const ORG_NAME = (import.meta.env.VITE_ORG_NAME as string) || 'Organization'

// ── Google Calendar Tab ───────────────────────────────────────────────

const GCAL_ORG_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const GCAL_SCOPES = 'https://www.googleapis.com/auth/calendar.readonly'

function useGisReady() {
  const [ready, setReady] = useState(!!window.google?.accounts?.oauth2)
  useEffect(() => {
    if (ready) return
    const interval = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        setReady(true)
        clearInterval(interval)
      }
    }, 100)
    return () => clearInterval(interval)
  }, [ready])
  return ready
}

function readPersonalClientId(): string {
  try {
    const raw = localStorage.getItem('gcal-storage')
    if (!raw) return ''
    const parsed = JSON.parse(raw)
    return parsed?.state?.personalClientId ?? ''
  } catch {
    return ''
  }
}

function GCalTab() {
  const status = useCalendarStore((s) => s.status)
  const authMethod = useCalendarStore((s) => s.authMethod)
  const health = useCalendarStore((s) => s.connectionHealth)
  const disconnect = useCalendarStore((s) => s.disconnect)
  const setConnected = useCalendarStore((s) => s.setConnected)
  const setPersonalClientId = useCalendarStore((s) => s.setPersonalClientId)
  const setStatus = useCalendarStore((s) => s.setStatus)

  const gisReady = useGisReady()
  const tokenClientRef = useRef<google.accounts.oauth2.TokenClient | null>(null)
  const [clientIdInput, setClientIdInput] = useState(() => readPersonalClientId())

  const hasOrgMethod = !!GCAL_ORG_CLIENT_ID

  function initAndConnect(clientId: string, method: CalendarAuthMethod) {
    if (!gisReady) return
    tokenClientRef.current = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GCAL_SCOPES,
      callback: (response) => {
        if (response.error) {
          setStatus('error')
          return
        }
        if (method === 'personal') setPersonalClientId(clientId)
        setConnected(response.access_token, Number(response.expires_in) || 3600, method)
      },
      error_callback: () => setStatus('error'),
    })
    tokenClientRef.current.requestAccessToken()
  }

  const configured = status !== 'idle'
  if (configured) {
    const methodLabel = authMethod === 'org' ? `${ORG_NAME} Organization` : 'Personal App'
    const broken = status === 'expired' || status === 'error' || health === 'unhealthy'
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Status</span>
          <StatusBadge health={health} status={status} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Auth method</span>
          <span className="text-sm">{methodLabel}</span>
        </div>
        <a
          href="https://console.cloud.google.com/apis/credentials"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary underline"
        >
          Manage OAuth credentials
          <ExternalLink className="size-3" />
        </a>
        {broken && (
          <p className="text-sm text-destructive">
            Access token expired. Re-connect to continue syncing.
          </p>
        )}
        <div className="flex gap-2">
          {broken && (
            <Button
              variant="default"
              size="sm"
              className="flex-1"
              disabled={!gisReady}
              onClick={() => {
                const clientId = authMethod === 'org' ? GCAL_ORG_CLIENT_ID : readPersonalClientId()
                if (clientId) initAndConnect(clientId, authMethod ?? 'org')
              }}
            >
              Re-connect
            </Button>
          )}
          <Button variant="outline" size="sm" className="flex-1" onClick={disconnect}>
            Disconnect
          </Button>
        </div>
      </div>
    )
  }

  // Not connected — show connect form
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Connect Google Calendar to pull your events for timesheet mapping.
      </p>
      {hasOrgMethod && (
        <Button onClick={() => initAndConnect(GCAL_ORG_CLIENT_ID!, 'org')} disabled={!gisReady}>
          Connect with {ORG_NAME}
        </Button>
      )}
      <div className="flex flex-col gap-3">
        {hasOrgMethod && (
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>
        )}
        <div className="text-muted-foreground space-y-1 text-sm">
          <p className="font-medium text-foreground">Personal App</p>
          <ol className="list-inside list-decimal space-y-0.5 text-xs">
            <li>
              Go to{' '}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary inline-flex items-center gap-0.5 underline"
              >
                Google Cloud Console
                <ExternalLink className="size-3" />
              </a>
            </li>
            <li>Create a project, enable Google Calendar API</li>
            <li>
              Create OAuth 2.0 credentials, add{' '}
              <code className="bg-muted rounded px-1 text-xs">{window.location.origin}</code> to
              origins
            </li>
            <li>Copy the Client ID below</li>
          </ol>
        </div>
        <Input
          placeholder="Client ID (e.g. 123456...apps.googleusercontent.com)"
          value={clientIdInput}
          onChange={(e) => setClientIdInput(e.target.value)}
        />
        <Button
          onClick={() => initAndConnect(clientIdInput.trim(), 'personal')}
          disabled={!gisReady || !clientIdInput.trim()}
          variant="outline"
        >
          Connect with Personal App
        </Button>
      </div>
    </div>
  )
}

// ── Jira Tab ──────────────────────────────────────────────────────────

const JIRA_ORG_CLIENT_ID = import.meta.env.VITE_JIRA_CLIENT_ID as string | undefined

function JiraTab() {
  const status = useJiraStore((s) => s.status)
  const authMethod = useJiraStore((s) => s.authMethod)
  const health = useJiraStore((s) => s.connectionHealth)
  const disconnect = useJiraStore((s) => s.disconnect)
  const startOAuth = useJiraStore((s) => s.startOAuth)
  const connectWithToken = useJiraStore((s) => s.connectWithToken)
  const [siteUrlInput, setSiteUrlInput] = useState('your-org.atlassian.net')
  const [emailInput, setEmailInput] = useState('')
  const [apiTokenInput, setApiTokenInput] = useState('')
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [tokenLoading, setTokenLoading] = useState(false)
  const hasOrgMethod = !!JIRA_ORG_CLIENT_ID
  const canConnectToken = siteUrlInput.trim() && emailInput.trim() && apiTokenInput.trim()

  const handleConnectOrg = () => {
    startOAuth()
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
      await connectWithToken(site, email, token)
      const { status: s, error } = useJiraStore.getState()
      if (s !== 'connected' && error) setTokenError(error)
    } catch (e) {
      setTokenError((e as Error).message)
    } finally {
      setTokenLoading(false)
    }
  }

  const configured = status !== 'idle'
  if (configured) {
    const methodLabel = authMethod === 'token' ? 'API Token' : `OAuth (${ORG_NAME})`
    const broken = status === 'expired' || status === 'error' || health === 'unhealthy'
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Status</span>
          <StatusBadge health={health} status={status} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Auth method</span>
          <span className="text-sm">{methodLabel}</span>
        </div>
        <a
          href="https://id.atlassian.com/manage-profile/security/api-tokens"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary underline"
        >
          Manage API tokens
          <ExternalLink className="size-3" />
        </a>
        {broken && (
          <p className="text-sm text-destructive">
            {authMethod === 'oauth-org'
              ? 'OAuth session expired. Token refresh failed — please re-connect.'
              : 'API token expired or revoked. Please generate a new one.'}
          </p>
        )}
        <div className="flex gap-2">
          {broken && hasOrgMethod && authMethod === 'oauth-org' && (
            <Button variant="default" size="sm" className="flex-1" onClick={handleConnectOrg}>
              Re-connect OAuth
            </Button>
          )}
          <Button variant="outline" size="sm" className="flex-1" onClick={disconnect}>
            Disconnect
          </Button>
        </div>
      </div>
    )
  }

  // Not connected — show connect form
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Connect Jira to pull issues and worklogs.</p>
      {hasOrgMethod && <Button onClick={handleConnectOrg}>Connect with OAuth</Button>}
      {hasOrgMethod && (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-3">
        <div className="text-muted-foreground space-y-1 text-sm">
          <p className="text-foreground font-medium">API Token</p>
          <ol className="list-inside list-decimal space-y-0.5 text-xs">
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
            <li>Create an API token and copy it</li>
          </ol>
        </div>
        <div className="flex flex-col gap-2">
          <Input
            id="manage-jira-site"
            value={siteUrlInput}
            onChange={(e) => setSiteUrlInput(e.target.value)}
            className="border-border"
          />
          <div className="flex gap-2">
            <Input
              id="manage-jira-email"
              type="email"
              placeholder="you@company.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="flex-1 border-border"
            />
            <Input
              id="manage-jira-token"
              type="password"
              placeholder="API Token"
              value={apiTokenInput}
              onChange={(e) => setApiTokenInput(e.target.value)}
              className="flex-1 border-border"
            />
          </div>
        </div>
        {tokenError && <p className="text-destructive text-sm">{tokenError}</p>}
        <Button
          onClick={handleConnectToken}
          disabled={!canConnectToken || tokenLoading}
          variant="outline"
        >
          {tokenLoading ? 'Connecting...' : 'Connect with API Token'}
        </Button>
      </div>
    </div>
  )
}

// ── Tempo Tab ─────────────────────────────────────────────────────────

function TempoTab() {
  const status = useTempoStore((s) => s.status)
  const health = useTempoStore((s) => s.connectionHealth)
  const disconnect = useTempoStore((s) => s.disconnect)
  const setToken = useTempoStore((s) => s.setToken)
  const [tokenInput, setTokenInput] = useState('')
  const [siteInput, setSiteInput] = useState('your-org.atlassian.net')
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

  const handleConnect = async () => {
    const token = tokenInput.trim()
    if (!token) return
    setConnecting(true)
    try {
      await setToken(token)
    } finally {
      setConnecting(false)
    }
  }

  const jiraSiteUrl = useJiraStore((s) => s.siteUrl)
  const jiraSiteBase = jiraSiteUrl ? `https://${jiraSiteUrl.replace(/^https?:\/\//, '')}` : null
  const jiraTempoSettingsUrl = jiraSiteBase ? `${jiraSiteBase}${tempoSettingsPath}` : null

  const configured = status !== 'idle'
  if (configured) {
    const broken = status === 'expired' || status === 'error' || health === 'unhealthy'
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Status</span>
          <StatusBadge health={health} status={status} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Auth method</span>
          <span className="text-sm">API Token</span>
        </div>
        {jiraTempoSettingsUrl ? (
          <a
            href={jiraTempoSettingsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary underline break-all"
          >
            Manage Tempo API tokens
            <ExternalLink className="size-3 shrink-0" />
          </a>
        ) : (
          <a
            href="https://help.tempo.io/timesheets/latest/using-rest-api-integrations"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary underline"
          >
            Tempo API docs
            <ExternalLink className="size-3" />
          </a>
        )}
        {broken && (
          <p className="text-sm text-destructive">
            API token expired or revoked. Generate a new one in Tempo Settings.
          </p>
        )}
        <Button variant="outline" size="sm" onClick={disconnect}>
          Disconnect
        </Button>
      </div>
    )
  }

  // Not connected
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Connect Tempo to pull worklogs and capacity data.
      </p>
      <div className="text-muted-foreground space-y-1 text-sm">
        <p className="text-foreground font-medium">How to get your API token:</p>
        <ol className="list-inside list-decimal space-y-0.5 text-xs">
          <li>
            Open Tempo Settings &rarr; Data Access &rarr; API Integration
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
                  Open Tempo Settings
                  <ExternalLink className="size-3 shrink-0" />
                </a>
              ) : (
                <span className="text-muted-foreground text-xs">
                  Enter your Jira site URL above to get a direct link
                </span>
              )}
            </div>
          </li>
          <li>
            Click <strong>New Token</strong>, select scope: <strong>Schemes</strong> (View)
          </li>
          <li>Copy the generated token (shown only once)</li>
        </ol>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="manage-tempo-token">API Token</Label>
        <Input
          id="manage-tempo-token"
          type="password"
          placeholder="Paste your Tempo API token"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
        />
      </div>
      <Button onClick={handleConnect} disabled={!tokenInput.trim() || connecting}>
        {connecting ? 'Connecting...' : 'Connect to Tempo'}
      </Button>
    </div>
  )
}
