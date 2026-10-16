import { randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import { pool } from '../src/infrastructure/database.js'

const offerId = 'oferta-teste-2026-1'
const seededBy = 'carga-local-demo'
const students = [
  { id: 'estudante-001', n1: 8.5, n2: 9.0 },
  { id: 'estudante-002', n1: 7.0, n2: 8.5 },
  { id: 'estudante-003', n1: 6.5, n2: 7.0 },
  { id: 'estudante-004', n1: 9.5, n2: 10.0 },
  { id: 'estudante-005', n1: 5.0, n2: 6.5 },
  { id: 'estudante-006', n1: 8.0, n2: 7.5 },
  { id: 'estudante-007', n1: 4.5, n2: 6.0 },
  { id: 'estudante-008', n1: 7.5, n2: 8.0 },
  { id: 'estudante-009', n1: 6.0, n2: 6.5 },
  { id: 'estudante-010', n1: 10.0, n2: 9.5 },
  { id: 'estudante-011', n1: 5.5, n2: 7.0 },
  { id: 'estudante-012', n1: 8.5, n2: 8.0 },
] as const

async function seedNote(
  client: PoolClient,
  enrollmentId: string,
  studentId: string,
  position: 1 | 2,
  value: number,
): Promise<boolean> {
  const noteId = randomUUID()
  const observation = `Carga de teste local - N${position}`
  const inserted = await client.query<{
    nota_id: string
    posicao: number
    valor: string
    observacao: string
    criada_em: Date
  }>(
    `INSERT INTO nota
       (nota_id, matricula_id, posicao, valor, observacao, criado_por)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT DO NOTHING
     RETURNING nota_id, posicao, valor, observacao, criada_em`,
    [noteId, enrollmentId, position, value, observation, seededBy],
  )

  const note = inserted.rows[0]
  if (!note) return false

  const apiNote = {
    notaId: note.nota_id,
    ofertaId: offerId,
    estudanteId: studentId,
    numeroNota: note.posicao,
    valor: Number(note.valor),
    observacao: note.observacao,
    criadaEm: note.criada_em.toISOString(),
    atualizadaEm: null,
  }

  await client.query(
    `INSERT INTO auditoria
       (auditoria_id, nota_id, tipo_evento, professor_id, estado_novo)
     VALUES ($1, $2, 'CRIACAO', $3, $4::jsonb)`,
    [randomUUID(), note.nota_id, seededBy, JSON.stringify(apiNote)],
  )
  return true
}

async function main(): Promise<void> {
  const client = await pool.connect()
  let insertedNotes = 0

  try {
    await client.query('BEGIN')

    for (const student of students) {
      const enrollment = await client.query<{ matricula_id: string }>(
        `INSERT INTO matricula (matricula_id, estudante_id, oferta_id, status)
         VALUES ($1, $2, $3, 'ATIVA')
         ON CONFLICT (estudante_id, oferta_id)
         DO UPDATE SET status = 'ATIVA', sincronizada_em = CURRENT_TIMESTAMP
         RETURNING matricula_id`,
        [randomUUID(), student.id, offerId],
      )
      const enrollmentId = enrollment.rows[0]!.matricula_id

      if (await seedNote(client, enrollmentId, student.id, 1, student.n1)) insertedNotes += 1
      if (await seedNote(client, enrollmentId, student.id, 2, student.n2)) insertedNotes += 1
    }

    await client.query('COMMIT')
    console.log(
      `Carga local concluida: ${students.length} matriculas verificadas e ${insertedNotes} notas inseridas na oferta ${offerId}.`,
    )
    console.log(`Identificadores de teste: ${students.map(({ id }) => id).join(', ')}`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha ao inserir carga local de teste.')
  process.exitCode = 1
} finally {
  await pool.end()
}
