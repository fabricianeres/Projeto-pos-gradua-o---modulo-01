import type {
  AccessAuditRepository,
  NoteDetails,
  NotePage,
  NoteRecord,
  NoteRepository,
  StudentGrades,
} from './ports.js'
import { badRequest, notFound } from '../domain/errors.js'
import {
  validateCreateNote,
  validateUpdateNote,
  type CreateNoteInput,
  type UpdateNoteInput,
} from '../domain/note.js'

const maxPageSize = 10

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

  create(ofertaId: string, input: CreateNoteInput): Promise<NoteRecord> {
    validateIdentifier(ofertaId, 'ofertaId')
    validateCreateNote(input)
    return this.notes.create(ofertaId, input)
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

  async update(notaId: string, input: UpdateNoteInput): Promise<NoteRecord> {
    validateIdentifier(notaId, 'notaId')
    validateUpdateNote(input)
    return this.notes.update(notaId, input)
  }

  async softDelete(notaId: string): Promise<void> {
    validateIdentifier(notaId, 'notaId')
    await this.notes.softDelete(notaId)
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
