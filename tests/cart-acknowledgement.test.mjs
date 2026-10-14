import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { acknowledgeCart, restoreCart } from '../app/utils/checkoutRecovery.js'

test('acknowledgement interleaved with another tab edit cannot overwrite the newer cart', () => {
  const cart = { id: randomUUID(), revision: randomUUID(), items: [{ quantity: 1 }], coupon: null }
  const newer = { ...cart, revision: randomUUID(), items: [{ quantity: 2 }] }
  const values = new Map([['cart-envelope', JSON.stringify(cart)]]), writes = []
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => {
    // Another tab's genuine edit lands at the acknowledgement write boundary.
    values.set('cart-envelope', JSON.stringify(newer))
    writes.push(key); values.set(key, value)
  } }
  const fork = randomUUID()
  acknowledgeCart(storage, cart, fork)
  assert.deepEqual(JSON.parse(values.get('cart-envelope')), newer)
  assert.ok(writes.every(key => key !== 'cart-envelope'))
  const restored = restoreCart(storage, JSON.parse(values.get('cart-envelope')))
  assert.equal(restored.items[0].quantity, 2); assert.equal(restored.id, fork)
  acknowledgeCart(storage, cart, randomUUID())
  assert.equal(restoreCart(storage, newer).id, fork)
})

test('reload hides only consumed revisions and chained purchases retain later changes', () => {
  const values = new Map(), storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) }
  const cart = { id: randomUUID(), revision: randomUUID(), items: [{ quantity: 1 }], coupon: null }
  acknowledgeCart(storage, cart, randomUUID())
  assert.deepEqual(restoreCart(storage, cart).items, [])
  const newer = { ...cart, revision: randomUUID(), items: [{ quantity: 2 }] }, restored = restoreCart(storage, newer)
  acknowledgeCart(storage, restored, randomUUID())
  assert.deepEqual(restoreCart(storage, newer).items, [])
  const later = restoreCart(storage, { ...newer, revision: randomUUID(), items: [{ quantity: 3 }] })
  assert.equal(later.items[0].quantity, 3); assert.notEqual(later.id, restored.id)
})
