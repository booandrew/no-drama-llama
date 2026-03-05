import { useEffect } from 'react'

import { AppHeader } from '@/components/AppHeader'
import { CustomInputsTab } from '@/components/CustomInputsTab'
import { MappingsTab } from '@/components/MappingsTab'
import { LlamaTimeTab, LlamaTimeToolbar } from '@/components/LlamaTimeTab'
import { SourcesTab } from '@/components/SourcesTab'
import { WoolInsightsTab } from '@/components/WoolInsightsTab'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/store/app'
import { useJiraStore } from '@/store/jira'

function useOAuthCallback(
  sessionKey: string,
  exchangeCode: (code: string) => Promise<void>,
  isRehydrated: boolean,
) {
  useEffect(() => {
    if (!isRehydrated) return

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const savedState = sessionStorage.getItem(sessionKey)

    if (!code || !state || state !== savedState) return

    sessionStorage.removeItem(sessionKey)
    window.history.replaceState({}, '', window.location.pathname)

    exchangeCode(code)
  }, [sessionKey, exchangeCode, isRehydrated])
}

function App() {
  const activeTab = useAppStore((s) => s.activeTab)
  const jiraExchangeCode = useJiraStore((s) => s.exchangeCode)
  const jiraHydrated = useJiraStore((s) => s._hasHydrated)
  useOAuthCallback('jira_oauth_state', jiraExchangeCode, jiraHydrated)

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader />
      <main className="flex-1 p-6">
        {activeTab === 'llama-time' && (
          <div className="flex flex-col gap-4">
          <LlamaTimeToolbar />
          <div className="grid grid-cols-[280px_minmax(0,1fr)_280px] gap-4">
            {/* Left sidebar */}
            <div className="flex flex-col gap-4">
              <Card className="flex-1">
                <CardHeader>
                  <CardTitle>Llama Avatar</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center h-48 rounded-md bg-muted text-muted-foreground text-sm">
                    Llama image placeholder
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Chat</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Chat interface placeholder. Ask questions about your timesheets here.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Center — chart */}
            <LlamaTimeTab />

            {/* Right sidebar */}
            <div className="flex flex-col gap-4">
              <Card className="flex-1">
                <CardHeader>
                  <CardTitle>Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Total hours</span>
                      <span className="font-medium">164h</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Logged</span>
                      <span className="font-medium">128h</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Remaining</span>
                      <span className="font-medium">36h</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
              <Card className="flex-1">
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Submit to Jira, auto-fill gaps, export CSV — coming soon.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
          </div>
        )}
        {activeTab === 'wool-insights' && <WoolInsightsTab />}
        {activeTab === 'logs-history' && (
          <div className="text-muted-foreground text-sm">Logs History content</div>
        )}
      </main>
    </div>
  )
}

export default App
