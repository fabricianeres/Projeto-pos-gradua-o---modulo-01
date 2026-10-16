import assert from 'node:assert/strict'
import test from 'node:test'
import {
  LocalSessionService,
  hashTestPassword,
  verifyTestPassword,
} from '../application/use-cases.js'
import { ApplicationError } from '../domain/errors.js'
import type { ProfessorCredentialRepository } from '../application/ports.js'

test('authenticates a local test professor and supports revoking the session', async () => {
  const password = 'local-test-password-123'
  const storedHash = await hashTestPassword(password)
  const credentials: ProfessorCredentialRepository = {
    async verify(professorId, candidate) {
      return professorId === 'prof-1' && (await verifyTestPassword(candidate, storedHash))
    },
  }
  const sessions = new LocalSessionService(credentials, 30)
  const session = await sessions.create('prof-1', password)

  assert.equal(sessions.verify(session.token), 'prof-1')
  sessions.revoke(session.token)
  assert.throws(
    () => sessions.verify(session.token),
    (error: unknown) => error instanceof ApplicationError && error.status === 401,
  )
})

test('uses a salted password hash that can be verified without storing the password', async () => {
  const password = 'local-test-password-123'
  const hash = await hashTestPassword(password)
  assert.notEqual(hash, password)
  assert.equal(await verifyTestPassword(password, hash), true)
  assert.equal(await verifyTestPassword('another-password', hash), false)
})

test('rejects invalid local test credentials', async () => {
  const credentials: ProfessorCredentialRepository = {
    async verify() {
      return false
    },
  }
  const sessions = new LocalSessionService(credentials, 30)

  await assert.rejects(
    sessions.create('prof-1', 'wrong-password'),
    (error: unknown) => error instanceof ApplicationError && error.status === 401,
  )
})
