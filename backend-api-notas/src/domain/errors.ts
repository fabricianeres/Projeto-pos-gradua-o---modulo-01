export interface ErrorDetail {
  campo?: string
  mensagem: string
}

export class ApplicationError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details: ErrorDetail[] = [],
  ) {
    super(message)
    this.name = 'ApplicationError'
  }
}

export function badRequest(message: string, details: ErrorDetail[] = []): ApplicationError {
  return new ApplicationError(message, 400, 'REQUISICAO_INVALIDA', details)
}

export function notFound(message: string, code = 'RECURSO_NAO_ENCONTRADO'): ApplicationError {
  return new ApplicationError(message, 404, code)
}

export function conflict(message: string, code = 'CONFLITO'): ApplicationError {
  return new ApplicationError(message, 409, code)
}

export function unauthorized(message = 'Sessao ausente, invalida ou expirada.'): ApplicationError {
  return new ApplicationError(message, 401, 'NAO_AUTENTICADO')
}

export function unprocessable(message: string, code: string): ApplicationError {
  return new ApplicationError(message, 422, code)
}
