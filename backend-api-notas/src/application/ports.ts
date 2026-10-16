import type { CreateNoteInput, UpdateNoteInput } from '../domain/note.js'

export interface NoteRecord {
  notaId: string
  ofertaId: string
  estudanteId: string
  numeroNota: 1 | 2
  valor: number
  observacao: string | null
  criadaEm: string
  atualizadaEm: string | null
}

export interface NoteDetails extends NoteRecord {
  n1: number | null
  n2: number | null
  media: number | null
}

export interface StudentGrades {
  estudanteId: string
  ofertaId: string
  n1: number | null
  n2: number | null
  media: number | null
}

export interface NotePage<T> {
  itens: T[]
  pagina: number
  tamanhoPagina: number
  temProximaPagina: boolean
}

export interface NoteRepository {
  create(ofertaId: string, input: CreateNoteInput, professorId: string): Promise<NoteRecord>
  findActiveById(notaId: string): Promise<NoteDetails | null>
  listByOffer(ofertaId: string, page: number, pageSize: number): Promise<NotePage<StudentGrades>>
  listByStudent(
    estudanteId: string,
    ofertaId: string,
    page: number,
    pageSize: number,
  ): Promise<NotePage<StudentGrades>>
  update(notaId: string, input: UpdateNoteInput, professorId: string): Promise<NoteRecord>
  softDelete(notaId: string, professorId: string): Promise<void>
}

export interface ProfessorCredentialRepository {
  verify(professorId: string, password: string): Promise<boolean>
}

export interface AccessAuditRepository {
  record(input: {
    professorId: string | null
    method: string
    path: string
    status: number
    requestId: string
  }): Promise<void>
}
