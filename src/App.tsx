import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

import llamaAvatarSvg from '@/assets/73897352_JEMA LUIS 283-03.svg'
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

function LlamaSidebar() {
  const totalHours = 160
  const [logged, setLogged] = useState(142)
  const pct = Math.round((logged / totalHours) * 100)

  const randomize = () => {
    setLogged(Math.floor(Math.random() * (totalHours + 1)))
  }

  return (
    <Card className="self-stretch overflow-hidden">
      <CardContent className="flex flex-1 flex-col items-center gap-3 p-4">
        <button
          onClick={randomize}
          className="cursor-pointer rounded-xl bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-md transition-transform hover:scale-105 active:scale-95"
        >
          <RefreshCw className="inline size-3.5" /> {logged}h / {totalHours}h logged
        </button>
        <div className="relative w-full flex-1" role="img" aria-label="Llama Avatar">
          {/* Greyscale layer (unfilled) */}
          <div
            className="absolute inset-0 bg-contain bg-center bg-no-repeat opacity-30 grayscale"
            style={{ backgroundImage: `url(${llamaAvatarSvg})` }}
          />
          {/* Colored layer (filled from bottom) */}
          <div
            className="absolute inset-0 bg-contain bg-center bg-no-repeat transition-[clip-path] duration-700 ease-in-out"
            style={{
              backgroundImage: `url(${llamaAvatarSvg})`,
              clipPath: `inset(${100 - pct}% 0 0 0)`,
            }}
          />
        </div>
      </CardContent>
    </Card>
  )
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
            <LlamaSidebar />

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
        {activeTab === 'sources' && <SourcesTab />}
        {activeTab === 'custom-inputs' && <CustomInputsTab />}
        {activeTab === 'mappings' && <MappingsTab />}
        {activeTab === 'wool-insights' && <WoolInsightsTab />}
        {activeTab === 'logs-history' && (
          <div className="text-muted-foreground text-sm">Logs History content</div>
        )}
      </main>
    </div>
  )
}

export default App
