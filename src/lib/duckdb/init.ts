import * as duckdb from '@duckdb/duckdb-wasm'
import type { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm'

import { isOPFSAvailable } from './opfs'
import { runSchema } from './schema'

const DB_NAME = 'no-drama-llama'
const DB_FILE = `${DB_NAME}.db`
const DB_PATH = `opfs://${DB_FILE}`

// Module-level singletons — outside React lifecycle
let db: AsyncDuckDB | null = null
let conn: AsyncDuckDBConnection | null = null
let worker: Worker | null = null
let workerBlobUrl: string | null = null
let initPromise: Promise<void> | null = null

async function doInit(): Promise<void> {
  // 0. Close any leftover state (e.g. after HMR hot-reload)
  if (db || worker) {
    await closeDuckDB()
  }

  // 1. OPFS check
  const opfsAvailable = await isOPFSAvailable()
  if (!opfsAvailable) {
    throw new Error('OPFS is not supported in this browser')
  }

  // 2. Resolve bundle
  const bundles = duckdb.getJsDelivrBundles()
  const bundle = await duckdb.selectBundle(bundles)

  // 3. Create worker
  workerBlobUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], {
      type: 'text/javascript',
    }),
  )
  worker = new Worker(workerBlobUrl)

  // 4. Instantiate
  const logger = new duckdb.ConsoleLogger(
    import.meta.env.DEV ? duckdb.LogLevel.INFO : duckdb.LogLevel.WARNING,
  )
  db = new duckdb.AsyncDuckDB(logger, worker)
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker)

  // 5. Open with OPFS (retry to handle stale access handles after HMR / remount)
  const MAX_RETRIES = 3
  const RETRY_DELAY_MS = 300
  for (let attempt = 0; ; attempt++) {
    try {
      await db.open({
        path: DB_PATH,
        accessMode: duckdb.DuckDBAccessMode.READ_WRITE,
        query: { castDecimalToDouble: true },
      })
      break
    } catch (err) {
      if (
        attempt < MAX_RETRIES &&
        err instanceof Error &&
        err.message.includes('Access Handle')
      ) {
        if (import.meta.env.DEV) {
          console.warn(`[DuckDB] OPFS handle busy, retrying (${attempt + 1}/${MAX_RETRIES})…`)
        }
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)))
        continue
      }
      throw err
    }
  }

  // 6. Connect
  conn = await db.connect()

  // 7. Write mode workaround
  const tempName = `_init_${Date.now()}`
  await conn.query(`CREATE OR REPLACE TABLE "${tempName}" AS SELECT 1;`)
  await conn.query(`DROP TABLE "${tempName}";`)

  // 8. Create / migrate schema
  await runSchema(conn)

  if (import.meta.env.DEV) {
    console.debug(`[DuckDB] Ready with OPFS persistence: ${DB_PATH}`)
  }
}

/**
 * Initialize DuckDB. Idempotent — returns same promise if called twice.
 * Cleans up partial state on failure so retry is possible.
 */
export async function initializeDuckDB(): Promise<void> {
  if (db && conn) return
  if (initPromise) return initPromise
  initPromise = doInit().catch(async (err) => {
    // Clean up partial state so OPFS handles are released and retry is possible
    await closeDuckDB()
    throw err
  })
  return initPromise
}

/**
 * Get the singleton connection. Throws if not initialized.
 */
export function getConnection(): AsyncDuckDBConnection {
  if (!conn) {
    throw new Error('DuckDB not initialized. Call initializeDuckDB() first.')
  }
  return conn
}

/**
 * Close DuckDB. Best-effort checkpoint, then teardown all resources.
 */
export async function closeDuckDB(): Promise<void> {
  if (conn) {
    try {
      await conn.query('FORCE CHECKPOINT;')
    } catch {
      // best-effort
    }
    try {
      await conn.close()
    } catch {
      // best-effort
    }
    conn = null
  }

  if (db) {
    try {
      await db.terminate()
    } catch {
      // best-effort
    }
    db = null
  }

  if (worker) {
    worker.terminate()
    worker = null
  }
  if (workerBlobUrl) {
    URL.revokeObjectURL(workerBlobUrl)
    workerBlobUrl = null
  }

  initPromise = null
}
