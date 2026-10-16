import { Router, type Request, type Response, type NextFunction } from 'express'
import type { NoteUseCases } from '../application/use-cases.js'
import { bodyObject, queryInteger, requiredNumber, requiredString, uuidPath } from './validation.js'
import { badRequest } from '../domain/errors.js'

function asyncRoute(
  handler: (request: Request, response: Response) => Promise<void>,
) {
  return (request: Request, response: Response, next: NextFunction): void => {
    void handler(request, response).catch(next)
  }
}

export function createRoutes(notes: NoteUseCases): Router {
  const router = Router()

  router.post('/ofertas/:ofertaId/notas', asyncRoute(async (request, response) => {
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
    )
    response.status(201).json(nota)
  }))

  router.get('/notas/:notaId', asyncRoute(async (request, response) => {
    response.status(200).json(await notes.get(uuidPath(request.params.notaId, 'notaId')))
  }))

  router.get('/ofertas/:ofertaId/notas', asyncRoute(async (request, response) => {
    const page = queryInteger(request.query.pagina, 'pagina', 1)
    const pageSize = queryInteger(request.query.tamanhoPagina, 'tamanhoPagina', 10, 10)
    response.status(200).json(
      await notes.listByOffer(requiredString(request.params.ofertaId, 'ofertaId'), page, pageSize),
    )
  }))

  router.get('/estudantes/:estudanteId/notas', asyncRoute(async (request, response) => {
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

  router.patch('/notas/:notaId', asyncRoute(async (request, response) => {
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
    )
    response.status(200).json(nota)
  }))

  router.delete('/notas/:notaId', asyncRoute(async (request, response) => {
    await notes.softDelete(uuidPath(request.params.notaId, 'notaId'))
    response.status(204).end()
  }))

  return router
}
