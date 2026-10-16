import type { Request } from 'express'

export interface RequestContext {
  requestId: string
  professorId: string | null
}

export interface ApiRequest extends Request {
  context: RequestContext
}
