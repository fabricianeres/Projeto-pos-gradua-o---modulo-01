import { randomBytes, createHash } from 'node:crypto'
import { scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import type {
  AccessAuditRepository,
  NoteDetails,
  NotePage,
  NoteRecord,
  NoteRepository,
  ProfessorCredentialRepository,
  StudentGrades,
} from './ports.js'
import { badRequest, notFound, unauthorized } from '../domain/errors.js'
import {
  validateCreateNote,
  validateUpdateNote,
  type CreateNoteInput,
  type UpdateNoteInput,
} from '../domain/note.js'

const scryptCost = 16384
const scryptBlockSize = 8
const scryptParallelization = 1
const tokenBytes = 32
const maxPageSize = 10

function derivePasswordHash(password: string, salt: Buffer, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      length,
      {
        N: scryptCost,
        r: scryptBlockSize,
        p: scryptParallelization,
        maxmem: 64 * 1024 * 1024,
      },
      (error, derived) => {
        if (error) reject(error)
        else resolve(derived)
      },
    )
  })
}

export async function hashTestPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derived = await derivePasswordHash(password, salt, 64)
  return `scrypt$${scryptCost}$${scryptBlockSize}$${scryptParallelization}$${salt.toString('hex')}$${derived.toString('hex')}`
}

export async function verifyTestPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, costText, blockText, parallelText, saltHex, expectedHex] = encoded.split('$')
  if (algorithm !== 'scrypt' || !costText || !blockText || !parallelText || !saltHex || !expectedHex) {
    return false
  }
  const N = Number(costText)
  const r = Number(blockText)
  const p = Number(parallelText)
  if (N !== scryptCost || r !== scryptBlockSize || p !== scryptParallelization) return false

  let salt: Buffer
  let expected: Buffer
  try {
    salt = Buffer.from(saltHex, 'hex')
    expected = Buffer.from(expectedHex, 'hex')
  } catch {
    return false
  }
  if (salt.length !== 16 || expected.length !== 64) return false
  const actual = await derivePasswordHash(password, salt, expected.length)
  return timingSafeEqual(actual, expected)
}

export class LocalSessionService {
  private readonly activeSessions = new Map<string, { professorId: string; expiresAt: number }>()

  constructor(
    private readonly credentials: ProfessorCredentialRepository,
    private readonly ttlMinutes: number,
  ) {}

  async create(professorId: string, password: string): Promise<{
    token: string
    professorId: string
    expiresAt: string
  }> {
    if (!professorId.trim() || !password) {
      throw badRequest('Informe o identificador do professor e a senha de teste.')
    }
    if (!(await this.credentials.verify(professorId, password))) {
      throw unauthorized('Identificador ou senha de teste invalidos.')
    }
    for (const [key, session] of this.activeSessions) {
      if (session.expiresAt <= Date.now()) this.activeSessions.delete(key)
    }
    const token = randomBytes(tokenBytes).toString('base64url')
    const expiresAt = Date.now() + this.ttlMinutes * 60_000
    this.activeSessions.set(this.tokenKey(token), { professorId, expiresAt })
    return {
      token,
      professorId,
      expiresAt: new Date(expiresAt).toISOString(),
    }
  }

  verify(token: string | undefined): string {
    if (!token) throw unauthorized()
    const key = this.tokenKey(token)
    const session = this.activeSessions.get(key)
    if (!session) throw unauthorized()
    if (session.expiresAt <= Date.now()) {
      this.activeSessions.delete(key)
      throw unauthorized()
    }
    return session.professorId
  }

  revoke(token: string | undefined): void {
    if (!token) throw unauthorized()
    const key = this.tokenKey(token)
    if (!this.activeSessions.delete(key)) throw unauthorized()
  }

  private tokenKey(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }
}

function validateIdentifier(value: string, field: string): void {
  if (!value.trim()) throw badRequest(`O campo ${field} e obrigatorio.`, [{ campo: field, mensagem: 'Campo obrigatorio.' }])
  if (value.length > 100) throw badRequest(`O campo ${field} excede 100 caracteres.`)
}

function validatePage(page: number, size: number): void {
  if (!Number.isInteger(page) || page < 1) throw badRequest('pagina deve ser um inteiro maior que zero.')
  if (!Number.isInteger(size) || size < 1 || size > maxPageSize) {
    throw badRequest(`tamanhoPagina deve estar entre 1 e ${maxPageSize}.`)
  }
}

export class NoteUseCases {
  constructor(private readonly notes: NoteRepository) {}

  create(ofertaId: string, input: CreateNoteInput, professorId: string): Promise<NoteRecord> {
    validateIdentifier(ofertaId, 'ofertaId')
    validateCreateNote(input)
    return this.notes.create(ofertaId, input, professorId)
  }

  async get(notaId: string): Promise<NoteDetails> {
    validateIdentifier(notaId, 'notaId')
    const note = await this.notes.findActiveById(notaId)
    if (!note) throw notFound('Nota nao encontrada.')
    return note
  }

  listByOffer(ofertaId: string, page: number, size: number): Promise<NotePage<StudentGrades>> {
    validateIdentifier(ofertaId, 'ofertaId')
    validatePage(page, size)
    return this.notes.listByOffer(ofertaId, page, size)
  }

  listByStudent(
    estudanteId: string,
    ofertaId: string,
    page: number,
    size: number,
  ): Promise<NotePage<StudentGrades>> {
    validateIdentifier(estudanteId, 'estudanteId')
    validateIdentifier(ofertaId, 'ofertaId')
    validatePage(page, size)
    return this.notes.listByStudent(estudanteId, ofertaId, page, size)
  }

  async update(notaId: string, input: UpdateNoteInput, professorId: string): Promise<NoteRecord> {
    validateIdentifier(notaId, 'notaId')
    validateUpdateNote(input)
    return this.notes.update(notaId, input, professorId)
  }

  async softDelete(notaId: string, professorId: string): Promise<void> {
    validateIdentifier(notaId, 'notaId')
    await this.notes.softDelete(notaId, professorId)
  }
}

export class AccessAuditor {
  constructor(private readonly repository: AccessAuditRepository) {}

  record(input: {
    professorId: string | null
    method: string
    path: string
    status: number
    requestId: string
  }): Promise<void> {
    return this.repository.record(input)
  }
}
