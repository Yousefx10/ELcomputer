import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveAccountUser } from '../app/utils/accountSession.js'

test('account user resolver uses an already populated user', async () => {
  const currentUser = { id: 'current' }
  const supabase = { auth: { getUser: () => { throw new Error('Unnecessary user lookup') } } }
  assert.deepEqual(await resolveAccountUser(supabase, currentUser), currentUser)
})

test('account user resolver normalizes verified Nuxt JWT claims', async () => {
  const claims = { sub: 'claim-user', email: 'customer@example.test' }
  const supabase = { auth: { getUser: () => { throw new Error('Unnecessary user lookup') } } }
  assert.deepEqual(await resolveAccountUser(supabase, claims), { ...claims, id: claims.sub })
})

test('account user resolver falls back to an authenticated user lookup', async () => {
  const authUser = { id: 'session-user' }
  const supabase = { auth: { getUser: async () => ({ data: { user: authUser }, error: null }) } }
  assert.equal(await resolveAccountUser(supabase, null), authUser)
})

test('account user resolver reports absent and failed sessions', async () => {
  const missing = { auth: { getUser: async () => ({ data: { user: null }, error: null }) } }
  assert.equal(await resolveAccountUser(missing, null), null)
  const failure = new Error('Session lookup failed')
  const broken = { auth: { getUser: async () => ({ data: null, error: failure }) } }
  await assert.rejects(resolveAccountUser(broken, null), failure)
})

test('account user resolver does not wait forever for a stalled session', async () => {
  const stalled = { auth: { getUser: () => new Promise(() => {}) } }
  await assert.rejects(resolveAccountUser(stalled, null, 5), /timed out/)
})
