import { createContext } from 'react'

export type DuckDBStatus = 'loading' | 'ready' | 'error'

export interface DuckDBContextValue {
  status: DuckDBStatus
  error: string | null
}

export const DuckDBContext = createContext<DuckDBContextValue>({
  status: 'loading',
  error: null,
})
