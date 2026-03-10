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
    // No cleanup — this provider wraps the entire app and never truly unmounts.
    // doInit() already handles stale state (leftover db/worker) on re-init,
    // and the OPFS retry logic handles stale access handles after HMR.
  }, [])

  return <DuckDBContext.Provider value={{ status, error }}>{children}</DuckDBContext.Provider>
}
