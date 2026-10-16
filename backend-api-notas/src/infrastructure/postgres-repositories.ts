import { randomUUID } from 'node:crypto'
import type { PoolClient, QueryResultRow } from 'pg'
import type {
  AccessAuditRepository,
  NoteDetails,
  NotePage,
  NoteRecord,
  NoteRepository,
  ProfessorCredentialRepository,
  StudentGrades,
} from '../application/ports.js'
import type { CreateNoteInput, UpdateNoteInput } from '../domain/note.js'
import { conflict, notFound, unprocessable } from '../domain/errors.js'
import { inTransaction, query } from './database.js'
import { verifyTestPassword } from '../application/use-cases.js'

interface NoteRow extends QueryResultRow {
  nota_id: string
  oferta_id: string
  estudante_id: string
  posicao: number
  valor: string | number
  observacao: string | null
  criada_em: Date | string
  atualizada_em: Date | string | null
}

interface NoteDetailsRow extends NoteRow {
  n1: string | number | null
  n2: string | number | null
  media: string | number | null
}

function mapNote(row: NoteRow): NoteRecord {
  return {
    notaId: row.nota_id,
    ofertaId: row.oferta_id,
    estudanteId: row.estudante_id,
    numeroNota: row.posicao as 1 | 2,
    valor: Number(row.valor),
    observacao: row.observacao,
    criadaEm: asIsoString(row.criada_em),
    atualizadaEm: row.atualizada_em ? asIsoString(row.atualizada_em) : null,
  }
}

function asIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function mapGrades(row: QueryResultRow): StudentGrades {
  return {
    estudanteId: String(row.estudante_id),
    ofertaId: String(row.oferta_id),
    n1: row.n1 === null ? null : Number(row.n1),
    n2: row.n2 === null ? null : Number(row.n2),
    media: row.media === null ? null : Number(row.media),
  }
}

async function writeMutationAudit(
  client: PoolClient,
  values: {
    notaId: string
    event: 'CRIACAO' | 'ATUALIZACAO' | 'EXCLUSAO_LOGICA'
    professorId: string
    before: unknown
    after: unknown
  },
): Promise<void> {
  await client.query(
    `INSERT INTO auditoria
       (auditoria_id, nota_id, tipo_evento, professor_id, estado_anterior, estado_novo, ocorrido_em)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, CURRENT_TIMESTAMP)`,
    [
      randomUUID(),
      values.notaId,
      values.event,
      values.professorId,
      values.before === null ? null : JSON.stringify(values.before),
      values.after === null ? null : JSON.stringify(values.after),
    ],
  )
}

export class PostgresNoteRepository implements NoteRepository {
  async create(ofertaId: string, input: CreateNoteInput, professorId: string): Promise<NoteRecord> {
    try {
      return await inTransaction(async (client) => {
        const enrollment = await client.query<{ matricula_id: string }>(
          `SELECT matricula_id
             FROM matricula
            WHERE oferta_id = $1 AND estudante_id = $2 AND status = 'ATIVA'
            FOR UPDATE`,
          [ofertaId, input.estudanteId],
        )
        if (!enrollment.rowCount) {
          throw unprocessable('O estudante nao possui matricula ativa nesta oferta.', 'MATRICULA_INATIVA')
        }

        const notaId = randomUUID()
        const inserted = await client.query<NoteRow>(
          `INSERT INTO nota
             (nota_id, matricula_id, posicao, valor, observacao, criado_por, criada_em)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
           RETURNING nota_id, posicao, valor, observacao, criada_em, atualizada_em`,
          [notaId, enrollment.rows[0]!.matricula_id, input.numeroNota, input.valor, input.observacao ?? null, professorId],
        )
        const row = inserted.rows[0]!
        const result = await client.query<NoteRow>(
          `SELECT n.nota_id, m.oferta_id, m.estudante_id, n.posicao, n.valor,
                  n.observacao, n.criada_em, n.atualizada_em
             FROM nota n
             JOIN matricula m ON m.matricula_id = n.matricula_id
            WHERE n.nota_id = $1`,
          [row.nota_id],
        )
        const note = mapNote(result.rows[0]!)
        await writeMutationAudit(client, {
          notaId,
          event: 'CRIACAO',
          professorId,
          before: null,
          after: note,
        })
        return note
      })
    } catch (error) {
      if (isPgError(error, '23505')) {
        throw conflict('Ja existe uma nota ativa para esta posicao, estudante e oferta.', 'NOTA_DUPLICADA')
      }
      throw error
    }
  }

  async findActiveById(notaId: string): Promise<NoteDetails | null> {
    const result = await query<NoteDetailsRow>(
      `SELECT n.nota_id, m.oferta_id, m.estudante_id, n.posicao, n.valor,
              n.observacao, n.criada_em, n.atualizada_em,
              MAX(g.valor) FILTER (WHERE g.posicao = 1) AS n1,
              MAX(g.valor) FILTER (WHERE g.posicao = 2) AS n2,
              CASE
                WHEN COUNT(g.nota_id) FILTER (WHERE g.posicao IN (1, 2)) = 2
                THEN ROUND(
                  (MAX(g.valor) FILTER (WHERE g.posicao = 1)
                   + MAX(g.valor) FILTER (WHERE g.posicao = 2)) / 2,
                  1
                )
                ELSE NULL
              END AS media
         FROM nota n
         JOIN matricula m ON m.matricula_id = n.matricula_id
         LEFT JOIN nota g ON g.matricula_id = n.matricula_id AND g.excluida_em IS NULL
        WHERE n.nota_id = $1 AND n.excluida_em IS NULL
        GROUP BY n.nota_id, m.oferta_id, m.estudante_id, n.posicao, n.valor,
                 n.observacao, n.criada_em, n.atualizada_em`,
      [notaId],
    )
    const row = result.rows[0]
    if (!row) return null
    return {
      ...mapNote(row),
      n1: row.n1 === null ? null : Number(row.n1),
      n2: row.n2 === null ? null : Number(row.n2),
      media: row.media === null ? null : Number(row.media),
    }
  }

  async listByOffer(ofertaId: string, page: number, pageSize: number): Promise<NotePage<StudentGrades>> {
    return this.listGrades(
      `m.oferta_id = $1`,
      [ofertaId],
      page,
      pageSize,
    )
  }

  async listByStudent(
    estudanteId: string,
    ofertaId: string,
    page: number,
    pageSize: number,
  ): Promise<NotePage<StudentGrades>> {
    return this.listGrades(
      `m.estudante_id = $1 AND m.oferta_id = $2`,
      [estudanteId, ofertaId],
      page,
      pageSize,
    )
  }

  private async listGrades(
    predicate: string,
    params: unknown[],
    page: number,
    pageSize: number,
  ): Promise<NotePage<StudentGrades>> {
    const offset = (page - 1) * pageSize
    const limitIndex = params.length + 1
    const offsetIndex = params.length + 2
    const result = await query(
      `WITH selecionadas AS (
         SELECT m.matricula_id, m.estudante_id, m.oferta_id
           FROM matricula m
          WHERE m.status = 'ATIVA' AND ${predicate}
            AND EXISTS (
              SELECT 1 FROM nota nx
               WHERE nx.matricula_id = m.matricula_id
                 AND nx.excluida_em IS NULL
            )
          ORDER BY m.matricula_id
          LIMIT $${limitIndex} OFFSET $${offsetIndex}
       )
       SELECT s.estudante_id, s.oferta_id,
              MAX(n.valor) FILTER (WHERE n.posicao = 1) AS n1,
              MAX(n.valor) FILTER (WHERE n.posicao = 2) AS n2,
              CASE
                WHEN COUNT(n.nota_id) FILTER (WHERE n.posicao IN (1, 2)) = 2
                THEN ROUND(
                  (MAX(n.valor) FILTER (WHERE n.posicao = 1)
                   + MAX(n.valor) FILTER (WHERE n.posicao = 2)) / 2,
                  1
                )
                ELSE NULL
              END AS media
         FROM selecionadas s
         JOIN nota n ON n.matricula_id = s.matricula_id AND n.excluida_em IS NULL
        GROUP BY s.matricula_id, s.estudante_id, s.oferta_id
        ORDER BY s.matricula_id`,
      [...params, pageSize + 1, offset],
    )
    const rows = result.rows
    const temProximaPagina = rows.length > pageSize
    const pageRows = rows.slice(0, pageSize)
    return {
      itens: pageRows.map(mapGrades),
      pagina: page,
      tamanhoPagina: pageSize,
      temProximaPagina,
    }
  }

  async update(notaId: string, input: UpdateNoteInput, professorId: string): Promise<NoteRecord> {
    return inTransaction(async (client) => {
      const currentResult = await client.query<NoteRow>(
        `SELECT n.nota_id, m.oferta_id, m.estudante_id, n.posicao, n.valor,
                n.observacao, n.criada_em, n.atualizada_em
           FROM nota n
           JOIN matricula m ON m.matricula_id = n.matricula_id
          WHERE n.nota_id = $1 AND n.excluida_em IS NULL
          FOR UPDATE OF n`,
        [notaId],
      )
      if (!currentResult.rowCount) throw notFound('Nota nao encontrada.')
      const current = mapNote(currentResult.rows[0]!)
      await client.query<NoteRow>(
        `UPDATE nota
            SET valor = COALESCE($2, valor),
                observacao = CASE WHEN $3::boolean THEN $4 ELSE observacao END,
                atualizado_por = $5,
                atualizada_em = CURRENT_TIMESTAMP
          WHERE nota_id = $1
        RETURNING nota_id, posicao, valor, observacao, criada_em, atualizada_em`,
        [notaId, input.valor ?? null, input.observacao !== undefined, input.observacao ?? null, professorId],
      )
      const output = await client.query<NoteRow>(
        `SELECT n.nota_id, m.oferta_id, m.estudante_id, n.posicao, n.valor,
                n.observacao, n.criada_em, n.atualizada_em
           FROM nota n JOIN matricula m ON m.matricula_id = n.matricula_id
          WHERE n.nota_id = $1`,
        [notaId],
      )
      const note = mapNote(output.rows[0]!)
      await writeMutationAudit(client, {
        notaId,
        event: 'ATUALIZACAO',
        professorId,
        before: current,
        after: note,
      })
      return note
    })
  }

  async softDelete(notaId: string, professorId: string): Promise<void> {
    await inTransaction(async (client) => {
      const currentResult = await client.query<NoteRow>(
        `SELECT n.nota_id, m.oferta_id, m.estudante_id, n.posicao, n.valor,
                n.observacao, n.criada_em, n.atualizada_em
           FROM nota n
           JOIN matricula m ON m.matricula_id = n.matricula_id
          WHERE n.nota_id = $1 AND n.excluida_em IS NULL
          FOR UPDATE OF n`,
        [notaId],
      )
      if (!currentResult.rowCount) throw notFound('Nota nao encontrada.')
      const before = mapNote(currentResult.rows[0]!)
      await client.query(
        `UPDATE nota
            SET excluido_por = $2, excluida_em = CURRENT_TIMESTAMP
          WHERE nota_id = $1`,
        [notaId, professorId],
      )
      await writeMutationAudit(client, {
        notaId,
        event: 'EXCLUSAO_LOGICA',
        professorId,
        before,
        after: { ...before, excluida: true },
      })
    })
  }
}

function isPgError(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}

export class PostgresProfessorCredentialRepository implements ProfessorCredentialRepository {
  async verify(professorId: string, password: string): Promise<boolean> {
    const result = await query<{ senha_hash: string }>(
      'SELECT senha_hash FROM professor_teste WHERE professor_id = $1',
      [professorId],
    )
    if (!result.rowCount) return false
    return verifyTestPassword(password, result.rows[0]!.senha_hash)
  }
}

export class PostgresAccessAuditRepository implements AccessAuditRepository {
  async record(input: {
    professorId: string | null
    method: string
    path: string
    status: number
    requestId: string
  }): Promise<void> {
    await query(
      `INSERT INTO auditoria
         (auditoria_id, tipo_evento, professor_id, metodo_http, caminho, status_http, request_id, ocorrido_em)
       VALUES ($1, 'ACESSO', $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [
        randomUUID(),
        input.professorId,
        input.method,
        input.path.slice(0, 500),
        input.status,
        input.requestId,
      ],
    )
  }
}
