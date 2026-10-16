import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg'
import { config } from '../config.js'

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: config.databasePoolSize,
  application_name: 'api-cadastro-notas-local',
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
})

export async function inTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await operation(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function query<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[],
): Promise<QueryResult<Row>> {
  return pool.query<Row>(text, values)
}

export type { PoolClient }
