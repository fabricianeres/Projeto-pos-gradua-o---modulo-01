import assert from 'node:assert/strict'
import { once } from 'node:events'
import express from 'express'
import test from 'node:test'
import type {
  NoteDetails,
  NotePage,
  NoteRecord,
  NoteRepository,
  StudentGrades,
} from '../application/ports.js'
import { NoteUseCases } from '../application/use-cases.js'
import { createRoutes } from '../http/routes.js'

const notes: NoteRepository = {
  async create(): Promise<NoteRecord> {
    throw new Error('Unexpected create call')
  },
  async findActiveById(): Promise<NoteDetails | null> {
    return null
  },
  async listByOffer(_offerId, page, pageSize): Promise<NotePage<StudentGrades>> {
    return { itens: [], pagina: page, tamanhoPagina: pageSize, temProximaPagina: false }
  },
  async listByStudent(_studentId, _offerId, page, pageSize): Promise<NotePage<StudentGrades>> {
    return { itens: [], pagina: page, tamanhoPagina: pageSize, temProximaPagina: false }
  },
  async update(): Promise<NoteRecord> {
    throw new Error('Unexpected update call')
  },
  async softDelete(): Promise<void> {
    throw new Error('Unexpected delete call')
  },
}

test('allows note routes without authentication and no longer exposes session routes', async () => {
  const app = express()
  app.use(express.json())
  app.use('/api/v1', createRoutes(new NoteUseCases(notes)))
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')

  try {
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1`

    const notesResponse = await fetch(`${baseUrl}/ofertas/oferta-1/notas`)
    assert.equal(notesResponse.status, 200)
    assert.deepEqual(await notesResponse.json(), {
      itens: [],
      pagina: 1,
      tamanhoPagina: 10,
      temProximaPagina: false,
    })

    const sessionResponse = await fetch(`${baseUrl}/auth/sessao`, { method: 'POST' })
    assert.equal(sessionResponse.status, 404)
  } finally {
    server.close()
    await once(server, 'close')
  }
})

test('creates a note without an authorization header when request data is valid', async () => {
  const created: NoteRecord = {
    notaId: '11e7e7ae-8e15-4edb-b55e-2b399bb0f492',
    ofertaId: 'oferta-1',
    estudanteId: 'estudante-1',
    numeroNota: 1,
    valor: 8.5,
    observacao: null,
    criadaEm: '2026-10-16T13:00:00.000Z',
    atualizadaEm: null,
  }
  const repository: NoteRepository = {
    ...notes,
    async create(offerId, input) {
      assert.equal(offerId, 'oferta-1')
      assert.deepEqual(input, {
        estudanteId: 'estudante-1',
        numeroNota: 1,
        valor: 8.5,
      })
      return created
    },
  }
  const app = express()
  app.use(express.json())
  app.use('/api/v1', createRoutes(new NoteUseCases(repository)))
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')

  try {
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/ofertas/oferta-1/notas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estudanteId: 'estudante-1',
        numeroNota: 1,
        valor: 8.5,
      }),
    })
    assert.equal(response.status, 201)
    assert.deepEqual(await response.json(), created)
  } finally {
    server.close()
    await once(server, 'close')
  }
})
