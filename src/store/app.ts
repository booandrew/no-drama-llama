import { create } from 'zustand'

type Tab = 'llama-time' | 'wool-insights' | 'logs-history'

interface Integration {
  id: string
  name: string
  connected: boolean
}

const defaultIntegrations: Integration[] = [
  { id: 'git', name: 'Git', connected: false },
]

interface AppState {
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
  integrations: Integration[]
  toggleIntegration: (id: string) => void
}

export const useAppStore = create<AppState>()((set) => ({
  activeTab: 'llama-time',
  setActiveTab: (activeTab) => set({ activeTab }),
  integrations: defaultIntegrations,
  toggleIntegration: (id) =>
    set((state) => ({
      integrations: state.integrations.map((i) =>
        i.id === id ? { ...i, connected: !i.connected } : i,
      ),
    })),
}))
