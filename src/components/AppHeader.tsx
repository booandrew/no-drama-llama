import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import llamaSvg from '@/assets/llama-svgrepo-com.svg'
import { IntegrationsPopover } from '@/components/IntegrationsPopover'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppStore } from '@/store/app'

export function AppHeader() {
  const activeTab = useAppStore((s) => s.activeTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const { theme, setTheme } = useTheme()

  return (
    <header className="border-border flex w-full items-center justify-between border-b px-4 py-2">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        className="flex-row"
      >
        <TabsList>
          <TabsTrigger value="paca-time" className="gap-1.5">
            <img src={llamaSvg} alt="" className="size-4" />
            PacaTime
          </TabsTrigger>
          <TabsTrigger value="wool-insights">Wool Insights</TabsTrigger>
          <TabsTrigger value="logs-history">Logs History</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex items-center gap-2">
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
