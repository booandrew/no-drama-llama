import { AppHeader } from '@/components/AppHeader'
import { PacaTimeTab } from '@/components/PacaTimeTab'
import { useAppStore } from '@/store/app'

function App() {
  const activeTab = useAppStore((s) => s.activeTab)
  console.log('zxczxc')

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader />
      <main className="flex-1 p-6">
        {activeTab === 'paca-time' && <PacaTimeTab />}
        {activeTab === 'wool-insights' && (
          <div className="text-muted-foreground text-sm">Wool Insights content</div>
        )}
        {activeTab === 'logs-history' && (
          <div className="text-muted-foreground text-sm">Logs History content</div>
        )}
      </main>
    </div>
  )
}

export default App
