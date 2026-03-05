import { useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun, Trash2, Settings, History, Database, PenLine, GitMerge } from 'lucide-react'
import llamaSvg from '@/assets/llama-svgrepo-com.svg'
import { IntegrationsPopover } from '@/components/IntegrationsPopover'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { clearAllData } from '@/lib/duckdb/queries'
import { useAppStore } from '@/store/app'

export function AppHeader() {
  const activeTab = useAppStore((s) => s.activeTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const isMockMode = useAppStore((s) => s.isMockMode)
  const toggleMockMode = useAppStore((s) => s.toggleMockMode)
  const { theme, setTheme } = useTheme()
  const [clearing, setClearing] = useState(false)

  const handleClearData = async () => {
    if (!confirm('Clear all DuckDB data? This cannot be undone.')) return
    setClearing(true)
    try {
      await clearAllData()
      window.location.reload()
    } catch (e) {
      console.error('[AppHeader] Clear data failed:', e)
      setClearing(false)
    }
  }

  return (
    <header className="border-border flex w-full items-center justify-between border-b px-4 py-2">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        className="flex-row"
      >
        <TabsList>
          <TabsTrigger value="llama-time" className="gap-1.5">
            <img src={llamaSvg} alt="" className="size-4" />
            Llama Time
          </TabsTrigger>
          <TabsTrigger value="wool-insights">Wool Insights</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Switch id="mock-mode" checked={isMockMode} onCheckedChange={toggleMockMode} />
          <Label htmlFor="mock-mode" className="text-xs cursor-pointer">
            Mock
          </Label>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Settings className="size-4" />
              <span className="sr-only">Settings</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setActiveTab('logs-history')}>
              <History className="size-4" />
              Logs History
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveTab('sources')}>
              <Database className="size-4" />
              Sources
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveTab('custom-inputs')}>
              <PenLine className="size-4" />
              Custom Inputs
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveTab('mappings')}>
              <GitMerge className="size-4" />
              Mappings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleClearData} disabled={clearing} variant="destructive">
              <Trash2 className="size-4" />
              Clear all data
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          <span className="sr-only">Toggle theme</span>
        </Button>
        <IntegrationsPopover />
      </div>
    </header>
  )
}
