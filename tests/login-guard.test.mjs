import test from 'node:test'
import assert from 'node:assert/strict'

import { createLoginRequestGuard, isDatabaseConfiguredForLogin } from '../lib/login-request-guard.ts'

test('duplicate login attempts for the same user are blocked until the first request finishes', () => {
  const guard = createLoginRequestGuard()

  assert.equal(guard.begin('alice@example.com|Receptionist'), true)
  assert.equal(guard.begin('alice@example.com|Receptionist'), false)

  guard.finish('alice@example.com|Receptionist')

  assert.equal(guard.begin('alice@example.com|Receptionist'), true)
  guard.finish('alice@example.com|Receptionist')
})

test('different users can start login attempts in parallel', () => {
  const guard = createLoginRequestGuard()

  assert.equal(guard.begin('alice@example.com|Receptionist'), true)
  assert.equal(guard.begin('bob@example.com|Clinician'), true)

  guard.finish('alice@example.com|Receptionist')
  guard.finish('bob@example.com|Clinician')
})

test('login is unavailable when the database is not configured', () => {
  const previous = process.env.DATABASE_URL
  delete process.env.DATABASE_URL

  try {
    assert.equal(isDatabaseConfiguredForLogin(), false)
  } finally {
    if (previous === undefined) {
      delete process.env.DATABASE_URL
    } else {
      process.env.DATABASE_URL = previous
    }
  }
})
