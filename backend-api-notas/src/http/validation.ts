import type { Request } from 'express'
import { badRequest } from '../domain/errors.js'

export function bodyObject(request: Request, allowed: string[]): Record<string, unknown> {
  if (typeof request.body !== 'object' || request.body === null || Array.isArray(request.body)) {
    throw badRequest('O corpo da requisicao deve ser um objeto JSON.')
  }
  const body = request.body as Record<string, unknown>
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key))
  if (unknown.length) {
    throw badRequest('A requisicao contem propriedades desconhecidas.', unknown.map((key) => ({
      campo: key,
      mensagem: 'Propriedade nao permitida.',
    })))
  }
  return body
}

export function requiredString(value: unknown, field: string, maxLength = 100): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw badRequest(`O campo ${field} e obrigatorio.`, [{ campo: field, mensagem: 'Informe um texto.' }])
  }
  const trimmed = value.trim()
  if (trimmed.length > maxLength) {
    throw badRequest(`O campo ${field} excede ${maxLength} caracteres.`, [
      { campo: field, mensagem: `Tamanho maximo: ${maxLength} caracteres.` },
    ])
  }
  return trimmed
}

export function requiredNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw badRequest(`O campo ${field} deve ser numerico.`, [
      { campo: field, mensagem: 'Informe um numero JSON valido.' },
    ])
  }
  return value
}

export function queryInteger(
  value: unknown,
  field: string,
  defaultValue: number,
  maximum?: number,
): number {
  if (value === undefined) return defaultValue
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw badRequest(`${field} deve ser um numero inteiro positivo.`)
  }
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1 || (maximum !== undefined && parsed > maximum)) {
    throw badRequest(
      maximum === undefined
        ? `${field} deve ser maior que zero.`
        : `${field} deve estar entre 1 e ${maximum}.`,
    )
  }
  return parsed
}

export function uuidPath(value: string, field: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw badRequest(`${field} deve ser um UUID valido.`, [
      { campo: field, mensagem: 'Informe um UUID valido.' },
    ])
  }
  return value
}
