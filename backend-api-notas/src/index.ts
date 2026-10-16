import { config } from './config.js'
import { AccessAuditor, NoteUseCases } from './application/use-cases.js'
import { createApp } from './http/app.js'
import {
  PostgresAccessAuditRepository,
  PostgresNoteRepository,
} from './infrastructure/postgres-repositories.js'
import { pool } from './infrastructure/database.js'

async function main(): Promise<void> {
  await pool.query('SELECT 1')
  const app = createApp(
    new NoteUseCases(new PostgresNoteRepository()),
    new AccessAuditor(new PostgresAccessAuditRepository()),
  )

  const server = app.listen(config.port, config.host, () => {
    console.log(JSON.stringify({
      level: 'info',
      event: 'server_started',
      address: `http://${config.host}:${config.port}`,
    }))
  })
  let shuttingDown = false

  const shutdown = (signal: string): void => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(JSON.stringify({ level: 'info', event: 'shutdown_started', signal }))
    server.close((error) => {
      if (error) {
        console.error(JSON.stringify({ level: 'error', event: 'server_close_failed', error: error.message }))
        process.exitCode = 1
      }
      void pool.end()
    })
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

void main().catch(async (error: unknown) => {
  console.error(JSON.stringify({
    level: 'error',
    event: 'server_start_failed',
    error: error instanceof Error ? error.message : 'unknown_error',
  }))
  await pool.end()
  process.exitCode = 1
})
