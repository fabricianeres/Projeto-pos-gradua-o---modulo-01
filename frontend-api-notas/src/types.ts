export interface ApiErrorDetail {
  campo?: string
  mensagem: string
}

export interface ApiErrorBody {
  codigo?: string
  mensagem?: string
  detalhes?: ApiErrorDetail[]
}

export interface ApiResult<T = unknown> {
  status: number
  body: T | null
}

export interface CreateNoteRequest {
  estudanteId: string
  numeroNota: 1 | 2
  valor: number
  observacao?: string
}

export interface UpdateNoteRequest {
  valor?: number
  observacao?: string
}

export interface ApiProblem extends Error {
  status?: number
  code?: string
  details?: ApiErrorDetail[]
}
