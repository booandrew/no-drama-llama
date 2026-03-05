import { create } from 'zustand'

import { fetchIssues, fetchProjects } from '@/lib/jira'
import type { JiraIssue, JiraProject } from '@/lib/jira'

interface JiraState {
  projects: JiraProject[]
  issues: JiraIssue[]
  loading: boolean
  error: string | null
  loadAll: () => Promise<void>
}

export const useJiraStore = create<JiraState>()((set) => ({
  projects: [],
  issues: [],
  loading: false,
  error: null,
  loadAll: async () => {
    set({ loading: true, error: null })
    try {
      const projects = await fetchProjects()
      const issues = await fetchIssues(projects.map((p) => p.key))
      set({ projects, issues, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },
}))
