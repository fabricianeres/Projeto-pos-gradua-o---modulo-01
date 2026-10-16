import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateAverage, validateCreateNote, validateGrade } from '../domain/note.js'
import { ApplicationError } from '../domain/errors.js'

test('accepts grade values in range with at most one decimal', () => {
  assert.doesNotThrow(() => validateGrade(0))
  assert.doesNotThrow(() => validateGrade(8.5))
  assert.doesNotThrow(() => validateGrade(10))
})

test('rejects invalid grade range and precision', () => {
  for (const value of [-0.1, 10.1, 8.35, Number.NaN]) {
    assert.throws(
      () => validateGrade(value),
      (error: unknown) => error instanceof ApplicationError && error.status === 400,
    )
  }
})

test('only N1 and N2 can be created', () => {
  assert.doesNotThrow(() => validateCreateNote({
    estudanteId: 'estudante-1',
    numeroNota: 1,
    valor: 8.5,
  }))
  assert.throws(
    () => validateCreateNote({
      estudanteId: 'estudante-1',
      numeroNota: 3,
      valor: 8.5,
    }),
    (error: unknown) => error instanceof ApplicationError && error.code === 'REQUISICAO_INVALIDA',
  )
})

test('calculates and rounds the mean arithmetically', () => {
  assert.equal(calculateAverage(8.3, 8.4), 8.4)
  assert.equal(calculateAverage(8.3, 8.5), 8.4)
  assert.equal(calculateAverage(8.3, null), null)
  assert.equal(calculateAverage(null, 9), null)
})
