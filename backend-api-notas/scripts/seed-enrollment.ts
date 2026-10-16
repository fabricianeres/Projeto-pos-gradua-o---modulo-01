import { randomUUID } from 'node:crypto'
import { pool } from '../src/infrastructure/database.js'

const [estudanteId, ofertaId, status = 'ATIVA'] = process.argv.slice(2)

try {
  if (!estudanteId || !ofertaId || estudanteId.length > 100 || ofertaId.length > 100) {
    throw new Error('Uso: npm run enrollment:seed -- <estudanteId> <ofertaId> [ATIVA|INATIVA]')
  }
  if (status !== 'ATIVA' && status !== 'INATIVA') {
    throw new Error('status deve ser ATIVA ou INATIVA.')
  }
  await pool.query(
    `INSERT INTO matricula (matricula_id, estudante_id, oferta_id, status)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (estudante_id, oferta_id)
     DO UPDATE SET status = EXCLUDED.status, sincronizada_em = CURRENT_TIMESTAMP`,
    [randomUUID(), estudanteId, ofertaId, status],
  )
  console.log(`Matricula ${estudanteId}/${ofertaId} gravada como ${status}.`)
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha ao gravar matricula local.')
  process.exitCode = 1
} finally {
  await pool.end()
}
