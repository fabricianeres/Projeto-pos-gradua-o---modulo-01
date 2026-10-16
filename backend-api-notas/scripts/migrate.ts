import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pool } from '../src/infrastructure/database.js'

try {
  const migration = await readFile(resolve(process.cwd(), 'migrations/001_initial_schema.sql'), 'utf8')
  await pool.query(migration)
  console.log('Migracao inicial aplicada.')
} catch (error) {
  console.error('Falha ao aplicar migracao:', error instanceof Error ? error.message : 'erro desconhecido')
  process.exitCode = 1
} finally {
  await pool.end()
}
