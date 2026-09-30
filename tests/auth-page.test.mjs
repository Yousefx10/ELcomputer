import assert from 'node:assert/strict'
import test from 'node:test'
import { authErrorKey, safeCustomerReturnPath } from '../app/utils/authPage.js'

test('customer return paths keep local destinations and reject external or privileged destinations', () => {
  assert.equal(safeCustomerReturnPath('/account/orders?filter=active#latest'), '/account/orders?filter=active#latest')
  assert.equal(safeCustomerReturnPath('/ar/checkout'), '/ar/checkout')
  for (const path of ['https://example.org', '//example.org', '/\\example.org', '/%2f%2fexample.org', '/dashboard', '/ar/dashboard/users', '/api/account', '/login?mode=signup', '/auth/callback', '/\nexample.org']) {
    assert.equal(safeCustomerReturnPath(path), '/account', path)
  }
})

test('common authentication failures resolve to safe customer messages', () => {
  assert.equal(authErrorKey({ code: 'invalid_credentials' }), 'authPage.invalidCredentials')
  assert.equal(authErrorKey({ code: 'email_not_confirmed' }), 'authPage.emailNotConfirmed')
  assert.equal(authErrorKey({ code: 'provider_disabled' }, 'oauth'), 'authPage.providerUnavailable')
  assert.equal(authErrorKey({ message: 'backend credentials and details' }), 'authPage.requestFailed')
})
