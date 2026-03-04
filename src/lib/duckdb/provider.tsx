import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { DuckDBContext } from './context'
import type { DuckDBStatus } from './context'
import { initializeDuckDB } from './init'

export function DuckDBProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<DuckDBStatus>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    initializeDuckDB()
      .then(() => setStatus('ready'))
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err))
        setStatus('error')
      })

  }, [])

  return (
    <DuckDBContext.Provider value={{ status, error }}>
      {children}
    </DuckDBContext.Provider>
  )
}
