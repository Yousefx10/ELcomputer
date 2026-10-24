import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { build } from 'esbuild'
import { resolve } from 'node:path'
import { ref, computed, watch, effectScope, onScopeDispose } from 'vue'
import { cartStateKey, accountCartOwner } from '../app/utils/cartSession.js'
import { readPendingCheckout, savePendingCheckout, restoreCart } from '../app/utils/checkoutRecovery.js'

let active, transport
Object.assign(globalThis, { ref, computed, watch, effectScope, onScopeDispose,
  onMounted: action => action(), useNuxtApp: () => active.app,
  useSupabaseSession: () => active.session, useSupabaseUser: () => active.claims,
  useSupabaseClient: () => { const f = active; return { auth: { getSession: () => f.getSession() } } },
  useStoreAnalytics: () => ({ trackEvent() {} }),
  useState: (key, initial) => { if (!active.state.has(key)) active.state.set(key, ref(initial())); return active.state.get(key) },
  $fetch: (...args) => transport(...args)
})
const bundled = await build({ stdin: { resolveDir: resolve('.'), contents: `
  export { useCart } from './app/composables/useCart.js';
  export { useCustomerIdentity } from './app/composables/useCustomerIdentity.js';
  export { useCustomerScope } from './app/composables/useCustomerScope.js';`, loader: 'js' },
  bundle: true, write: false, format: 'esm', platform: 'node', alias: { '~': resolve('app') }, define: { 'import.meta.client': 'true' } })
const { useCart, useCustomerScope, useCustomerIdentity } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'))
const storage = () => {
  const values = new Map()
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
}
const fixture = (id = randomUUID(), localStorage = storage()) => {
  const listeners = new Map(), stops = [], scope = effectScope()
  const f = { app: { vueApp: { onUnmount: fn => stops.push(fn) } }, state: new Map(), claims: ref(null),
    session: ref(id ? { access_token: 'token-' + id, user: { id, email: id + '@example.invalid' } } : null),
    window: { localStorage, sessionStorage: storage(), crypto: { randomUUID }, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener() {} },
    getSession: async () => ({ data: { session: f.session.value } }),
    enter: fn => { active = f; globalThis.window = f.window; globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} }; return scope.run(fn) },
    switch: id => f.enter(() => { f.session.value = id ? { access_token: 'token-' + id, user: { id } } : null }),
    sync: () => f.enter(() => listeners.get('storage')?.({ key: null })),
    dispose: () => { scope.stop(); stops.forEach(fn => fn()) }
  }
  f.cart = f.enter(useCart)
  return f
}
const product = title => ({ id: randomUUID(), title, stock_quantity: 10, price: 12 })
const defer = () => { let done; const promise = new Promise(resolve => { done = resolve }); return { promise, done } }

test('account, guest and legacy carts never merge or inherit another owner', t => {
  const a = randomUUID(), b = randomUUID(), f = fixture(a); t.after(f.dispose)
  f.window.localStorage.setItem('elcomputer-cart-state-v2', JSON.stringify({ items: [product('Unowned legacy item')] }))
  f.cart.syncCart(); assert.deepEqual(f.cart.items.value, [])
  const first = product('Account A item'); f.cart.addItem(first)
  f.cart.setAppliedCoupon({ code: 'A-PRIVATE' })
  const cartA = f.cart.cartId.value
  f.switch(b)
  assert.deepEqual(f.cart.items.value, []); assert.equal(f.cart.appliedCoupon.value, null)
  const second = product('Account B item'); f.cart.addItem(second)
  f.switch(a)
  assert.equal(f.cart.cartId.value, cartA); assert.equal(f.cart.items.value[0].title, first.title)
  assert.equal(f.cart.appliedCoupon.value.code, 'A-PRIVATE')
  f.switch(null); assert.deepEqual(f.cart.items.value, [])
  f.cart.addItem(product('Anonymous item'))
  const guestOwner = f.cart.owner.value
  f.switch(b)
  assert.equal(f.cart.items.value[0].title, second.title)
  f.switch(null)
  assert.notEqual(f.cart.owner.value, guestOwner); assert.deepEqual(f.cart.items.value, [])
  assert.ok(f.window.localStorage.getItem('elcomputer-cart-state-v2'))
})

test('an anonymous basket survives its own reload without becoming an authenticated basket', t => {
  const f = fixture(null); t.after(f.dispose)
  f.cart.addItem(product('Guest-only item'))
  const key = f.cart.owner.value
  assert.ok(key.startsWith('guest:'))
  assert.equal(JSON.parse(f.window.localStorage.getItem(cartStateKey(key))).owner, key)
  f.cart.syncCart(); assert.equal(f.cart.items.value[0].title, 'Guest-only item')
  f.switch(randomUUID()); assert.deepEqual(f.cart.items.value, [])
})

test('multi-tab completion preserves edits and cannot consume a different customer cart', t => {
  const id = randomUUID(), shared = storage(), one = fixture(id, shared), two = fixture(id, shared)
  t.after(one.dispose); t.after(two.dispose)
  one.enter(() => one.cart.addItem(product('Shared A item')))
  two.sync()
  const snapshot = { owner: two.cart.owner.value, id: two.cart.cartId.value, revision: two.cart.revision.value }
  one.enter(() => one.cart.setQuantity(one.cart.items.value[0].cart_key, 2))
  two.enter(() => two.cart.completeCart(snapshot))
  one.sync()
  assert.equal(one.cart.items.value[0].quantity, 2)
  assert.notEqual(one.cart.cartId.value, snapshot.id)
  two.switch(randomUUID()); two.enter(() => two.cart.addItem(product('B item')))
  const before = JSON.stringify(two.cart.items.value)
  two.enter(() => two.cart.completeCart(snapshot))
  assert.equal(JSON.stringify(two.cart.items.value), before)
  one.sync(); assert.equal(one.cart.items.value[0].title, 'Shared A item')
})

test('storage failure during an account transition still clears the previous cart', t => {
  const f = fixture(); t.after(f.dispose)
  f.cart.addItem(product('Private item'))
  f.window.localStorage.getItem = () => { throw Error('Storage unavailable') }
  f.switch(randomUUID())
  assert.deepEqual(f.cart.items.value, []); assert.equal(f.cart.appliedCoupon.value, null)
})

test('session authority ignores old JWT claims and stale A -> B -> A responses', async t => {
  const a = randomUUID(), b = randomUUID(), f = fixture(a); t.after(f.dispose)
  f.claims.value = { sub: a }
  const scope = f.enter(useCustomerScope), response = defer()
  transport = async () => response.promise
  const request = scope.request('/api/account/orders/private')
  await Promise.resolve(); await Promise.resolve()
  f.switch(b)
  assert.equal(f.enter(useCustomerIdentity).accountId.value, b)
  f.switch(a); response.done({ private: 'A receipt' })
  await assert.rejects(request, /session changed/)
  assert.equal(scope.isCurrent(), false)
})

test('an account switch while resolving auth cannot send an old action as the new account', async t => {
  const f = fixture(); t.after(f.dispose)
  const session = defer(), scope = f.enter(useCustomerScope)
  f.getSession = () => session.promise
  let sent = 0; transport = async () => { sent++; return {} }
  const pending = scope.request('/api/checkout', { method: 'POST', body: { old: true }, retry: 0 })
  f.switch(randomUUID()); session.done({ data: { session: f.session.value } })
  await assert.rejects(pending, /session changed/); assert.equal(sent, 0)
})

test('session cancellation preserves per-request timeouts and caller abort signals', async t => {
  const f = fixture(); t.after(f.dispose)
  const scope = f.enter(useCustomerScope)
  transport = async (_path, options) => new Promise((_done, fail) => {
    if (options.signal.aborted) fail(options.signal.reason)
    else options.signal.addEventListener('abort', () => fail(options.signal.reason), { once: true })
  })
  await assert.rejects(scope.request('/api/payments/status', { timeout: 10 }), error => error.name === 'TimeoutError')
  assert.equal(scope.isCurrent(), true)
  const caller = new AbortController(), pending = scope.request('/api/account/messages', { signal: caller.signal })
  caller.abort(new Error('Caller stopped'))
  await assert.rejects(pending, /Caller stopped/)
  transport = async () => ({ stillUsable: true })
  assert.deepEqual(await scope.request('/api/account/messages'), { stillUsable: true })
})

test('pending checkout recovery stays with its original customer and exact command', () => {
  const a = randomUUID(), b = randomUUID(), local = storage()
  const command = { version: 1, userId: a, body: { cart_id: randomUUID(), quote_id: randomUUID(), address: { street_address: 'A private address' } }, review: { lines: [] } }
  savePendingCheckout(local, command)
  assert.equal(readPendingCheckout(local, b), null)
  assert.deepEqual(readPendingCheckout(local, a), command)
  local.setItem('elcomputer-checkout-pending-' + b, JSON.stringify(command))
  assert.equal(readPendingCheckout(local, b), null)
})

test('cart completion markers are scoped even when two owners have the same cart UUID', () => {
  const local = storage(), id = randomUUID(), revision = randomUUID(), owner = accountCartOwner(randomUUID())
  local.setItem(cartStateKey(owner), JSON.stringify({ version: 3, owner, id, revision, items: [] }))
  local.setItem('elcomputer-cart-completed-' + id, JSON.stringify({ revision, nextId: randomUUID() }))
  assert.equal(restoreCart(local, { id, revision, items: [product('Current item')] }, owner).items.length, 1)
})
