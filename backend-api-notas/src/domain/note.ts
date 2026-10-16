import { badRequest } from './errors.js'

export interface CreateNoteInput {
  estudanteId: string
  numeroNota: number
  valor: number
  observacao?: string
}

export interface UpdateNoteInput {
  valor?: number
  observacao?: string | null
}

export function validateCreateNote(input: CreateNoteInput): void {
  if (!input.estudanteId.trim()) {
    throw badRequest('O identificador do estudante e obrigatorio.', [
      { campo: 'estudanteId', mensagem: 'Informe o identificador do estudante.' },
    ])
  }
  if (input.estudanteId.length > 100) {
    throw badRequest('O identificador do estudante excede 100 caracteres.', [
      { campo: 'estudanteId', mensagem: 'Tamanho maximo: 100 caracteres.' },
    ])
  }
  if (input.numeroNota !== 1 && input.numeroNota !== 2) {
    throw badRequest('O numero da nota deve ser 1 (N1) ou 2 (N2).', [
      { campo: 'numeroNota', mensagem: 'Valores permitidos: 1 ou 2.' },
    ])
  }
  validateGrade(input.valor)
  if (input.observacao !== undefined && input.observacao.length > 500) {
    throw badRequest('A observacao excede 500 caracteres.', [
      { campo: 'observacao', mensagem: 'Tamanho maximo: 500 caracteres.' },
    ])
  }
}

export function validateUpdateNote(input: UpdateNoteInput): void {
  if (input.valor === undefined && input.observacao === undefined) {
    throw badRequest('Informe ao menos o valor ou a observacao para atualizar.')
  }
  if (input.valor !== undefined) validateGrade(input.valor)
  if (input.observacao !== undefined && input.observacao !== null && input.observacao.length > 500) {
    throw badRequest('A observacao excede 500 caracteres.', [
      { campo: 'observacao', mensagem: 'Tamanho maximo: 500 caracteres.' },
    ])
  }
}

export function validateGrade(value: number): void {
  const scaled = value * 10
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > 10 ||
    !Number.isInteger(scaled)
  ) {
    throw badRequest('O valor da nota deve estar entre 0 e 10, com no maximo uma casa decimal.', [
      { campo: 'valor', mensagem: 'Informe um numero de 0 a 10 com no maximo uma casa decimal.' },
    ])
  }
}

export function calculateAverage(n1: number | null, n2: number | null): number | null {
  if (n1 === null || n2 === null) return null
  return Math.floor(((n1 + n2) / 2) * 10 + 0.5) / 10
}
