import type { NextFunction, Request, Response } from 'express'
import { unauthorized } from '../domain/errors.js'
import type { ApiRequest } from './request-context.js'
import type { LocalSessionService } from '../application/use-cases.js'

export function requireSession(sessions: LocalSessionService) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    try {
      const authorization = request.header('authorization')
      const match = authorization?.match(/^Bearer ([A-Za-z0-9_-]{40,100})$/)
      if (!match) throw unauthorized()
      const professorId = sessions.verify(match[1])
      ;(request as ApiRequest).context.professorId = professorId
      next()
    } catch (error) {
      next(error)
    }
  }
}
