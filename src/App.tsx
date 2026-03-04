import { useEffect } from 'react'

import llamaSvg from '@/assets/llama-svgrepo-com.svg'
import { useDuckDB } from '@/lib/duckdb'

function App() {
  const { query, isReady, status, error } = useDuckDB()

  useEffect(() => {
    if (!isReady) return

    const smoke = async () => {
      try {
        await query('CREATE TABLE IF NOT EXISTS _smoke (id INTEGER, msg VARCHAR)')
        await query("INSERT INTO _smoke VALUES (1, 'hello from DuckDB')")
        const result = await query('SELECT * FROM _smoke')
        console.log('[DuckDB smoke test] rows:', result.toArray())
        await query('DROP TABLE _smoke')
        console.log('[DuckDB smoke test] PASSED')
      } catch (err) {
        console.error('[DuckDB smoke test] FAILED:', err)
      }
    }

    smoke()
  }, [isReady, query])

  return (
    <div className="flex min-h-svh items-center justify-center">
      <img src={llamaSvg} alt="Llama" className="h-64 w-64" />
      {status === 'loading' && (
        <p className="text-muted-foreground absolute bottom-4 text-sm">Loading DuckDB...</p>
      )}
      {error && <p className="absolute bottom-4 text-sm text-red-500">DuckDB error: {error}</p>}
    </div>
  )
}

export default App
