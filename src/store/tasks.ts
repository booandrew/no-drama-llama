import { create } from 'zustand'

import type {
  DdsJiraIssue,
  DdsJiraWorklog,
  DdsTask,
  DdsTempoDailyCapacity,
  TaskUpdate,
} from '@/lib/duckdb/queries'
import { getMonthDateRange, toUtcIsoDateTimeRange } from '@/lib/date-range'
import * as queries from '@/lib/duckdb/queries'

interface TasksState {
  tasks: DdsTask[]
  worklogs: DdsJiraWorklog[]
  issues: DdsJiraIssue[]
  dailyCapacity: DdsTempoDailyCapacity[]
  loading: boolean
  loadTasks: (year: number, month: number) => Promise<void>
  updateTask: (taskId: string, fields: TaskUpdate) => Promise<void>
  updateTasks: (taskIds: string[], fields: TaskUpdate) => Promise<void>
  addTask: (input: Omit<DdsTask, 'task_id' | 'revision'>) => Promise<void>
}

export const useTasksStore = create<TasksState>()((set) => ({
  tasks: [],
  worklogs: [],
  issues: [],
  dailyCapacity: [],
  loading: false,

  loadTasks: async (year, month) => {
    set({ loading: true })
    try {
      const monthRange = getMonthDateRange(year, month)
      const taskRange = toUtcIsoDateTimeRange(monthRange)
      const [tasks, worklogs, issues, dailyCapacity] = await Promise.all([
        queries.readDdsTasks(taskRange.start, taskRange.endExclusive),
        queries.readDdsJiraWorklogs(monthRange.start, monthRange.endExclusive),
        queries.readDdsJiraIssues(),
        queries.readDdsTempoDailyCapacity(monthRange.start, monthRange.endExclusive),
      ])
      set({ tasks, worklogs, issues, dailyCapacity })
    } finally {
      set({ loading: false })
    }
  },

  updateTask: async (taskId, fields) => {
    // Optimistic local update
    set((state) => ({
      tasks: state.tasks.map((t) => (t.task_id === taskId ? { ...t, ...fields } : t)),
    }))
    await queries.updateTask(taskId, fields)
  },

  updateTasks: async (taskIds, fields) => {
    const idSet = new Set(taskIds)
    // Optimistic local update — single state change for all tasks
    set((state) => ({
      tasks: state.tasks.map((t) => (idSet.has(t.task_id) ? { ...t, ...fields } : t)),
    }))
    await Promise.all(taskIds.map((id) => queries.updateTask(id, fields)))
  },

  addTask: async (input) => {
    const task_id = crypto.randomUUID()
    // For custom_input tasks, source_id links back to the DdsCustomInput (same ID)
    const source_id = input.source === 'custom_input' ? task_id : input.source_id
    const task: DdsTask = { ...input, task_id, source_id, revision: 0 }
    set((state) => ({ tasks: [...state.tasks, task] }))
    await queries.createTask({ ...input, task_id, source_id })
  },
}))
