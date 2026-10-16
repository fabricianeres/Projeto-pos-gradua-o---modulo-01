import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import express, { type NextFunction, type Request, type Response } from 'express'
import type { AccessAuditor, LocalSessionService, NoteUseCases } from '../application/use-cases.js'
import { config } from '../config.js'
import { ApplicationError } from '../domain/errors.js'
import type { ApiRequest } from './request-context.js'
import { createRoutes } from './routes.js'

export function createApp(
  notes: NoteUseCases,
  sessions: LocalSessionService,
  auditor: AccessAuditor,
) {
  const app = express()
  app.disable('x-powered-by')
  app.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store')
    next()
  })
  app.use((request, response, next) => {
    const host = request.hostname.toLowerCase()
    if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') {
      response.status(403).json({
        codigo: 'HOST_NAO_PERMITIDO',
        mensagem: 'A API local aceita somente conexoes por loopback.',
      })
      return
    }
    next()
  })

  app.use((request, response, next) => {
    const origin = request.header('origin')
    if (origin && config.frontendOrigins.has(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin)
      response.setHeader('Vary', 'Origin')
      response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Request-Id')
      response.setHeader('Access-Control-Max-Age', '600')
    }
    if (request.method === 'OPTIONS') {
      if (origin && !config.frontendOrigins.has(origin)) {
        response.status(403).end()
        return
      }
      response.status(204).end()
      return
    }
    next()
  })

  app.use((request, response, next) => {
    const requestId = randomUUID()
    response.setHeader('X-Request-Id', requestId)
    ;(request as ApiRequest).context = { requestId, professorId: null }
    response.on('finish', () => {
      const context = (request as ApiRequest).context
      void auditor.record({
        professorId: context.professorId,
        method: request.method,
        path: request.route
          ? `${request.baseUrl}${String(request.route.path)}`
          : request.path.replace(/\/(notas|estudantes|ofertas)\/[^/]+/g, '/$1/:id'),
        status: response.statusCode,
        requestId,
      }).catch((error: unknown) => {
        console.error(JSON.stringify({
          level: 'error',
          event: 'access_audit_failed',
          requestId,
          error: error instanceof Error ? error.message : 'unknown_error',
        }))
      })
    })
    next()
  })

  app.use(express.json({ limit: '32kb', strict: true }))
  app.get('/api/v1/health', (_request, response) => {
    response.status(200).json({ status: 'ok' })
  })
  app.get('/api/v1/openapi.yaml', async (_request, response, next) => {
    try {
      const contract = await readFile(resolve(process.cwd(), 'openapi.yaml'), 'utf8')
      response.type('text/yaml').send(contract)
    } catch (error) {
      next(error)
    }
  })

  app.use('/api/v1', createRoutes(notes, sessions))
  app.use((_request, response) => {
    response.status(404).json({
      codigo: 'ROTA_NAO_ENCONTRADA',
      mensagem: 'A rota solicitada nao existe.',
      detalhes: [],
    })
  })

  app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
    const requestId = (request as ApiRequest).context?.requestId ?? 'sem-request-id'
    if (error instanceof SyntaxError && 'body' in error) {
      response.status(400).json({
        codigo: 'JSON_INVALIDO',
        mensagem: 'O corpo da requisicao contem JSON invalido.',
        detalhes: [],
      })
      return
    }
    if (error instanceof ApplicationError) {
      response.status(error.status).json({
        codigo: error.code,
        mensagem: error.message,
        detalhes: error.details,
      })
      return
    }
    if (typeof error === 'object' && error !== null && 'status' in error && error.status === 413) {
      response.status(413).json({
        codigo: 'CORPO_MUITO_GRANDE',
        mensagem: 'O corpo da requisicao excede o limite de 32 KB.',
        detalhes: [],
      })
      return
    }

    console.error(JSON.stringify({
      level: 'error',
      event: 'request_failed',
      requestId,
      error: error instanceof Error ? error.message : 'unknown_error',
    }))
    response.status(500).json({
      codigo: 'ERRO_INTERNO',
      mensagem: 'Ocorreu uma falha inesperada.',
      detalhes: [],
    })
  })

  return app
}
