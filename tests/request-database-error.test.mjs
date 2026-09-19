import { test } from 'node:test'
import assert from 'node:assert/strict'
import { throwRequestDatabaseError } from '../server/utils/requestDatabaseError.js'

test('account lookup errors retain server diagnostics without exposing database text', () => {
  const originalError = console.error
  const logged = []
  console.error = (...args) => logged.push(args)
  try {
    for (const accountType of ['Customer', 'Admin']) {
      assert.throws(
        () => throwRequestDatabaseError(accountType, {
          code: '42P01', message: 'relation private_customer_profiles does not exist'
        }),
        error => error.statusCode === 500
          && error.statusMessage === 'Could not verify your account. Please try again.'
          && !JSON.stringify(error).includes('private_customer_profiles')
      )
    }
  } finally {
    console.error = originalError
  }
  assert.equal(logged.length, 2)
  assert.equal(logged[0][1].code, '42P01')
})
