import { Router, type Request, type Response, type NextFunction } from 'express'
import type { NoteUseCases, LocalSessionService } from '../application/use-cases.js'
import { requireSession } from './auth-middleware.js'
import type { ApiRequest } from './request-context.js'
import { bodyObject, queryInteger, requiredNumber, requiredString, uuidPath } from './validation.js'
import { badRequest } from '../domain/errors.js'

function asyncRoute(
  handler: (request: Request, response: Response) => Promise<void>,
) {
  return (request: Request, response: Response, next: NextFunction): void => {
    void handler(request, response).catch(next)
  }
}

function bearerToken(request: Request): string | undefined {
  const match = request.header('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{40,100})$/)
  return match?.[1]
}

function auditProfessor(request: Request): string {
  const professorId = (request as ApiRequest).context.professorId
  if (!professorId) throw badRequest('A sessao autenticada nao contem o identificador do professor.')
  return professorId
}

export function createRoutes(notes: NoteUseCases, sessions: LocalSessionService): Router {
  const router = Router()

  router.post('/auth/sessao', asyncRoute(async (request, response) => {
    const body = bodyObject(request, ['professorId', 'senha'])
    const professorId = requiredString(body.professorId, 'professorId')
    if (typeof body.senha !== 'string' || body.senha.length < 1 || body.senha.length > 1024) {
      throw badRequest('O campo senha e obrigatorio.')
    }
    const session = await sessions.create(professorId, body.senha)
    ;(request as ApiRequest).context.professorId = session.professorId
    response.status(200).json(session)
  }))

  router.delete('/auth/sessao', (request, response, next) => {
    try {
      const token = bearerToken(request)
      const professorId = sessions.verify(token)
      sessions.revoke(token)
      ;(request as ApiRequest).context.professorId = professorId
      response.status(204).end()
    } catch (error) {
      next(error)
    }
  })

  const authenticated = requireSession(sessions)
  const protectedRouter = Router()
  protectedRouter.use(authenticated)

  protectedRouter.post('/ofertas/:ofertaId/notas', asyncRoute(async (request, response) => {
    const body = bodyObject(request, ['estudanteId', 'numeroNota', 'valor', 'observacao'])
    const estudanteId = requiredString(body.estudanteId, 'estudanteId')
    const numeroNota = requiredNumber(body.numeroNota, 'numeroNota')
    const valor = requiredNumber(body.valor, 'valor')
    if (body.observacao !== undefined && typeof body.observacao !== 'string') {
      throw badRequest('O campo observacao deve ser texto.')
    }
    const nota = await notes.create(
      requiredString(request.params.ofertaId, 'ofertaId'),
      {
        estudanteId,
        numeroNota,
        valor,
        ...(typeof body.observacao === 'string' ? { observacao: body.observacao } : {}),
      },
      auditProfessor(request),
    )
    response.status(201).json(nota)
  }))

  protectedRouter.get('/notas/:notaId', asyncRoute(async (request, response) => {
    response.status(200).json(await notes.get(uuidPath(request.params.notaId, 'notaId')))
  }))

  protectedRouter.get('/ofertas/:ofertaId/notas', asyncRoute(async (request, response) => {
    const page = queryInteger(request.query.pagina, 'pagina', 1)
    const pageSize = queryInteger(request.query.tamanhoPagina, 'tamanhoPagina', 10, 10)
    response.status(200).json(
      await notes.listByOffer(requiredString(request.params.ofertaId, 'ofertaId'), page, pageSize),
    )
  }))

  protectedRouter.get('/estudantes/:estudanteId/notas', asyncRoute(async (request, response) => {
    const ofertaId = typeof request.query.ofertaId === 'string' ? request.query.ofertaId : ''
    const page = queryInteger(request.query.pagina, 'pagina', 1)
    const pageSize = queryInteger(request.query.tamanhoPagina, 'tamanhoPagina', 10, 10)
    response.status(200).json(
      await notes.listByStudent(
        requiredString(request.params.estudanteId, 'estudanteId'),
        requiredString(ofertaId, 'ofertaId'),
        page,
        pageSize,
      ),
    )
  }))

  protectedRouter.patch('/notas/:notaId', asyncRoute(async (request, response) => {
    const body = bodyObject(request, ['valor', 'observacao'])
    const value = body.valor === undefined ? undefined : requiredNumber(body.valor, 'valor')
    const observation = body.observacao
    if (observation !== undefined && observation !== null && typeof observation !== 'string') {
      throw badRequest('O campo observacao deve ser texto ou null.')
    }
    const nota = await notes.update(
      uuidPath(request.params.notaId, 'notaId'),
      {
        ...(value === undefined ? {} : { valor: value }),
        ...(observation === undefined ? {} : { observacao: observation }),
      },
      auditProfessor(request),
    )
    response.status(200).json(nota)
  }))

  protectedRouter.delete('/notas/:notaId', asyncRoute(async (request, response) => {
    await notes.softDelete(uuidPath(request.params.notaId, 'notaId'), auditProfessor(request))
    response.status(204).end()
  }))

  router.use(protectedRouter)
  return router
}
