import type { Table } from 'apache-arrow'
import { useCallback, useContext } from 'react'

import { DuckDBContext } from './context'
import type { DuckDBContextValue } from './context'
import { getConnection } from './init'
import { isMutation } from './mutation'

export interface UseDuckDBResult extends DuckDBContextValue {
  isReady: boolean
  query: (sql: string) => Promise<Table>
}

export function useDuckDB(): UseDuckDBResult {
  const ctx = useContext(DuckDBContext)

  const query = useCallback(async (sql: string): Promise<Table> => {
    const conn = getConnection()
    const result = await conn.query(sql)

    if (isMutation(sql)) {
      await conn.query('FORCE CHECKPOINT;')
    }

    return result
  }, [])

  return {
    ...ctx,
    isReady: ctx.status === 'ready',
    query,
  }
}
