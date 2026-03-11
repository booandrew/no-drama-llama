import { create } from 'zustand'

import type { DdsJiraIssue, DdsJiraWorklog, DdsTask, TaskUpdate } from '@/lib/duckdb/queries'
import * as mockQueries from '@/lib/duckdb/mock-queries'
import * as queries from '@/lib/duckdb/queries'
import { useAppStore } from '@/store/app'

interface TasksState {
  tasks: DdsTask[]
  worklogs: DdsJiraWorklog[]
  issues: DdsJiraIssue[]
  loading: boolean
  loadTasks: (year: number, month: number) => Promise<void>
  updateTask: (taskId: string, fields: TaskUpdate) => Promise<void>
  updateTasks: (taskIds: string[], fields: TaskUpdate) => Promise<void>
  addTask: (input: Omit<DdsTask, 'task_id' | 'revision'>) => Promise<void>
}

function getQueries() {
  return useAppStore.getState().isMockMode ? mockQueries : queries
}

export const useTasksStore = create<TasksState>()((set) => ({
  tasks: [],
  worklogs: [],
  issues: [],
  loading: false,

  loadTasks: async (year, month) => {
    set({ loading: true })
    try {
      const dateStart = new Date(year, month, 1).toISOString()
      const dateEnd = new Date(year, month + 1, 1).toISOString()
      const mod = getQueries()
      const [tasks, worklogs, issues] = await Promise.all([
        mod.readDdsTasks(dateStart, dateEnd),
        mod.readDdsJiraWorklogs(dateStart, dateEnd),
        mod.readDdsJiraIssues(),
      ])
      set({ tasks, worklogs, issues })
    } finally {
      set({ loading: false })
    }
  },

  updateTask: async (taskId, fields) => {
    // Optimistic local update
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.task_id === taskId ? { ...t, ...fields } : t,
      ),
    }))
    // Persist to DB
    const mod = getQueries()
    await mod.updateTask(taskId, fields)
  },

  updateTasks: async (taskIds, fields) => {
    const idSet = new Set(taskIds)
    // Optimistic local update — single state change for all tasks
    set((state) => ({
      tasks: state.tasks.map((t) =>
        idSet.has(t.task_id) ? { ...t, ...fields } : t,
      ),
    }))
    // Persist all to DB in parallel
    const mod = getQueries()
    await Promise.all(taskIds.map((id) => mod.updateTask(id, fields)))
  },

  addTask: async (input) => {
    const task_id = crypto.randomUUID()
    // For custom_input tasks, source_id links back to the DdsCustomInput (same ID)
    const source_id = input.source === 'custom_input' ? task_id : input.source_id
    const task: DdsTask = { ...input, task_id, source_id, revision: 0 }
    // Optimistic — add to local state immediately
    set((state) => ({ tasks: [...state.tasks, task] }))
    // Persist (createTask handles custom input + revision + mappings + timesheet sync)
    const mod = getQueries()
    await mod.createTask({ ...input, task_id, source_id })
  },
}))
