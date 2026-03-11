import { useEffect, useRef, useState } from 'react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCalendarStore } from '@/store/calendar'
import type { CalendarAuthMethod } from '@/store/calendar'

const ORG_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const ORG_NAME = (import.meta.env.VITE_ORG_NAME as string) || 'Organization'
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly'

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

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
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

export function GoogleCalendarConnectDialog({ open, onOpenChange }: Props) {
  const { setConnected, setPersonalClientId, setStatus } = useCalendarStore()
  const gisReady = useGisReady()
  const tokenClientRef = useRef<google.accounts.oauth2.TokenClient | null>(null)
  const pendingMethodRef = useRef<CalendarAuthMethod>('org')
  const [clientIdInput, setClientIdInput] = useState('')

  useEffect(() => {
    if (open) {
      setClientIdInput(readPersonalClientId())
    }
  }, [open])

  const hasOrgMethod = !!ORG_CLIENT_ID
  const defaultTab = hasOrgMethod ? 'org' : 'personal'

  function initAndConnect(clientId: string, method: CalendarAuthMethod) {
    if (!gisReady) return
    pendingMethodRef.current = method
    tokenClientRef.current = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          setStatus('error')
          return
        }
        if (method === 'personal') {
          setPersonalClientId(clientId)
        }
        setConnected(response.access_token, Number(response.expires_in) || 3600, method)
        onOpenChange(false)
      },
      error_callback: () => {
        setStatus('error')
      },
    })
    tokenClientRef.current.requestAccessToken()
  }

  const connectOrg = () => {
    if (ORG_CLIENT_ID) initAndConnect(ORG_CLIENT_ID, 'org')
  }

  const connectPersonal = () => {
    const trimmed = clientIdInput.trim()
    if (trimmed) initAndConnect(trimmed, 'personal')
  }

  const showTabs = hasOrgMethod

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Google Calendar</DialogTitle>
          <DialogDescription>Choose how to authenticate with Google Calendar.</DialogDescription>
        </DialogHeader>

        {showTabs ? (
          <Tabs defaultValue={defaultTab}>
            <TabsList className="w-full">
              <TabsTrigger value="org" className="flex-1">
                {ORG_NAME}
              </TabsTrigger>
              <TabsTrigger value="personal" className="flex-1">
                Personal
              </TabsTrigger>
            </TabsList>
            <TabsContent value="org" className="mt-4">
              <p className="text-muted-foreground mb-4 text-sm">
                Connect using the {ORG_NAME} organization Google account.
              </p>
              <Button onClick={connectOrg} disabled={!gisReady} className="w-full">
                Connect with {ORG_NAME}
              </Button>
            </TabsContent>
            <TabsContent value="personal" className="mt-4">
              <PersonalForm
                clientIdInput={clientIdInput}
                setClientIdInput={setClientIdInput}
                onConnect={connectPersonal}
                gisReady={gisReady}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <PersonalForm
            clientIdInput={clientIdInput}
            setClientIdInput={setClientIdInput}
            onConnect={connectPersonal}
            gisReady={gisReady}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function PersonalForm({
  clientIdInput,
  setClientIdInput,
  onConnect,
  gisReady,
}: {
  clientIdInput: string
  setClientIdInput: (v: string) => void
  onConnect: () => void
  gisReady: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="text-muted-foreground space-y-1 text-sm">
        <p className="font-medium text-foreground">How to get your Client ID:</p>
        <ol className="list-inside list-decimal space-y-0.5">
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
          <li>Create a project (or select existing), enable Google Calendar API</li>
          <li>
            Create OAuth 2.0 credentials (Web application), add{' '}
            <code className="bg-muted rounded px-1 text-xs">{window.location.origin}</code> to
            Authorized JavaScript origins
          </li>
          <li>Copy the Client ID below</li>
        </ol>
      </div>
      <Input
        placeholder="Client ID (e.g. 123456...apps.googleusercontent.com)"
        value={clientIdInput}
        onChange={(e) => setClientIdInput(e.target.value)}
      />
      <Button onClick={onConnect} disabled={!gisReady || !clientIdInput.trim()} className="w-full">
        Connect with Personal Account
      </Button>
    </div>
  )
}
