import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pool } from '../src/infrastructure/database.js'

interface TestNote {
  numeroNota: 1 | 2
  valor: number
}

interface TestStudent {
  estudanteId: string
  statusMatricula: 'ATIVA' | 'INATIVA'
  notas: TestNote[]
}

interface TestFixture {
  ofertaId: string
  estudantes: TestStudent[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseFixture(value: unknown): TestFixture {
  if (!isRecord(value) || typeof value.ofertaId !== 'string' || !Array.isArray(value.estudantes)) {
    throw new Error('A massa de teste deve conter ofertaId e uma lista de estudantes.')
  }

  const estudantes = value.estudantes.map((student): TestStudent => {
    if (
      !isRecord(student) ||
      typeof student.estudanteId !== 'string' ||
      !['ATIVA', 'INATIVA'].includes(String(student.statusMatricula)) ||
      !Array.isArray(student.notas)
    ) {
      throw new Error('A massa contém um estudante ou statusMatricula inválido.')
    }

    const notas = student.notas.map((note): TestNote => {
      if (
        !isRecord(note) ||
        (note.numeroNota !== 1 && note.numeroNota !== 2) ||
        typeof note.valor !== 'number' ||
        !Number.isFinite(note.valor) ||
        note.valor < 0 ||
        note.valor > 10 ||
        !Number.isInteger(note.valor * 10)
      ) {
        throw new Error(`Nota inválida na massa do estudante ${student.estudanteId}.`)
      }
      return { numeroNota: note.numeroNota, valor: note.valor }
    })

    return {
      estudanteId: student.estudanteId,
      statusMatricula: student.statusMatricula as TestStudent['statusMatricula'],
      notas,
    }
  })

  if (!value.ofertaId.trim() || value.ofertaId.length > 100) {
    throw new Error('ofertaId deve conter de 1 a 100 caracteres.')
  }

  return { ofertaId: value.ofertaId, estudantes }
}

async function main(): Promise<void> {
  const rawFixture = await readFile(resolve(process.cwd(), 'test-data/massa-teste.json'), 'utf8')
  const fixture = parseFixture(JSON.parse(rawFixture) as unknown)
  const client = await pool.connect()
  let insertedEnrollments = 0
  let insertedNotes = 0

  try {
    await client.query('BEGIN')

    for (const student of fixture.estudantes) {
      if (!student.estudanteId.trim() || student.estudanteId.length > 100) {
        throw new Error('estudanteId deve conter de 1 a 100 caracteres.')
      }

      const enrollment = await client.query<{ matricula_id: string }>(
        `INSERT INTO matricula (matricula_id, estudante_id, oferta_id, status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (estudante_id, oferta_id)
         DO UPDATE SET status = EXCLUDED.status, sincronizada_em = CURRENT_TIMESTAMP
         RETURNING matricula_id`,
        [randomUUID(), student.estudanteId, fixture.ofertaId, student.statusMatricula],
      )
      insertedEnrollments += 1

      for (const note of student.notas) {
        const noteId = randomUUID()
        const observation = `Massa local de teste - N${note.numeroNota}`
        const result = await client.query<{
          nota_id: string
          posicao: number
          valor: string | number
          observacao: string
          criada_em: Date | string
        }>(
          `INSERT INTO nota
             (nota_id, matricula_id, posicao, valor, observacao, criado_por)
           VALUES ($1, $2, $3, $4, $5, 'massa-teste-local')
           ON CONFLICT (matricula_id, posicao) WHERE excluida_em IS NULL DO NOTHING
           RETURNING nota_id, posicao, valor, observacao, criada_em`,
          [noteId, enrollment.rows[0]!.matricula_id, note.numeroNota, note.valor, observation],
        )

        const inserted = result.rows[0]
        if (!inserted) continue

        await client.query(
          `INSERT INTO auditoria
             (auditoria_id, nota_id, tipo_evento, professor_id, estado_novo)
           VALUES ($1, $2, 'CRIACAO', 'massa-teste-local', $3::jsonb)`,
          [
            randomUUID(),
            inserted.nota_id,
            JSON.stringify({
              notaId: inserted.nota_id,
              ofertaId: fixture.ofertaId,
              estudanteId: student.estudanteId,
              numeroNota: inserted.posicao,
              valor: Number(inserted.valor),
              observacao: inserted.observacao,
              criadaEm: new Date(inserted.criada_em).toISOString(),
              atualizadaEm: null,
            }),
          ],
        )
        insertedNotes += 1
      }
    }

    await client.query('COMMIT')
    console.log(
      `Massa carregada em ${fixture.ofertaId}: ${insertedEnrollments} matrículas verificadas e ${insertedNotes} notas novas.`,
    )
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
  console.error(error instanceof Error ? error.message : 'Falha ao carregar a massa de teste.')
  process.exitCode = 1
} finally {
  await pool.end()
}
