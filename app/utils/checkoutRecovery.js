import {subtractPurchasedLines} from './purchasedCart.js'
const prefix = 'elcomputer-checkout-pending-'
export const cartCompletionPrefix = 'elcomputer-cart-completed-'
const completionKey = (id, owner = '') => cartCompletionPrefix + (owner ? encodeURIComponent(owner) + ':' : '') + id

// Acknowledgements write only this marker, never the mutable cart envelope.
// Concurrent cart edits therefore cannot be erased by a stale read/write pair.
export const acknowledgeCart = (storage, snapshot, nextId, owner = '') => {
  const key = completionKey(snapshot.id, owner)
  if (!storage.getItem(key)) storage.setItem(key, JSON.stringify({ revision: snapshot.revision, nextId }))
}

export const acknowledgePurchasedCart = (storage, snapshot, nextId, receipt, owner = '') => {
  if (!/^[0-9a-f-]{36}$/i.test(receipt || '') || !Array.isArray(snapshot?.items) || !snapshot.items.length) return false
  const lines = snapshot.items.map(({cart_key, cart_line_id, quantity}) => ({cart_key, cart_line_id, quantity}))
  if (lines.some(line => !line.cart_key || !/^[0-9a-f-]{36}$/i.test(line.cart_line_id || '') || !Number.isInteger(line.quantity) || line.quantity < 1)) return false
  const key = completionKey(snapshot.id, owner)
  if (!storage.getItem(key)) storage.setItem(key, JSON.stringify({kind:'paid_lines', revision:snapshot.revision, nextId, receipt, lines}))
  return true
}

export const restoreCart = (storage, state, owner = '') => {
  const restored = { ...state }
  for (let count = 0; restored.id && count < 32; count++) {
    const marker = JSON.parse(storage.getItem(completionKey(restored.id, owner)) || 'null')
    if (!marker?.revision || !/^[0-9a-f-]{36}$/i.test(marker.nextId || '')) break
    if (marker.kind === 'paid_lines') {
      restored.items = subtractPurchasedLines(restored.items, marker.lines)
      restored.revision += ':paid:' + marker.receipt
      restored.id = restored.items.length ? marker.nextId : ''
      if (!restored.items.length) restored.coupon = null
      continue
    }
    if (marker.revision === restored.revision) {
      return { id: '', revision: restored.revision + ':completed', items: [], coupon: null }
    }
    restored.id = marker.nextId
    restored.revision += ':fork:' + marker.nextId
  }
  return restored
}

export const readPendingCheckout = (storage, userId) => {
  if (!userId) return null
  try {
    const value = JSON.parse(storage.getItem(prefix + userId) || 'null')
    return value?.version === 1 && value.userId === userId && value.body?.cart_id && value.body?.quote_id && Array.isArray(value.review?.lines) ? value : null
  } catch { return null }
}

// Retain each request before moving the compatibility pointer. A second tab or
// a changed basket must never replay another cart's frozen checkout command.
const cartRequestKey = command => prefix + command.userId + ':' + command.body.cart_id + ':' + command.cart.revision
const requestKey = command => cartRequestKey(command) + ':' + command.body.quote_id
const retainRequest = (storage, command) => {
  if (command?.cart?.revision && !storage.getItem(requestKey(command))) storage.setItem(requestKey(command), JSON.stringify(command))
}
export const readPendingCheckoutForCart = (storage, userId, cart) => {
  const previous = readPendingCheckout(storage, userId)
  if (previous) {
    retainRequest(storage, previous)
    if (previous?.cart?.revision && !storage.getItem(cartRequestKey(previous))) storage.setItem(cartRequestKey(previous), JSON.stringify(previous))
  }
  let candidate
  try { candidate = JSON.parse(storage.getItem(prefix + userId + ':' + cart.id + ':' + cart.revision) || 'null') } catch { return null }
  const matches = command => command?.version === 1 && command.userId === userId
    && command.body?.cart_id === cart.id && command.cart?.revision === cart.revision
    && command.body?.quote_id && Array.isArray(command.review?.lines)
  return matches(candidate) ? candidate : matches(previous) ? previous : null
}
export const savePendingCheckout = (storage, command) => {
  const previous = readPendingCheckout(storage, command.userId)
  if (previous) retainRequest(storage, previous)
  retainRequest(storage, command)
  if (command?.cart?.revision) storage.setItem(cartRequestKey(command), JSON.stringify(command))
  storage.setItem(prefix + command.userId, JSON.stringify(command))
}

export const removePendingCheckout = (storage, command) => {
  if (command?.cart?.revision) {
    const key = requestKey(command)
    const retained = JSON.parse(storage.getItem(key) || 'null')
    if (retained?.body?.quote_id === command.body.quote_id) storage.removeItem(key)
    const pointer = JSON.parse(storage.getItem(cartRequestKey(command)) || 'null')
    if (pointer?.body?.quote_id === command.body.quote_id) storage.removeItem(cartRequestKey(command))
  }
  const current = readPendingCheckout(storage, command.userId)
  if (current?.body.cart_id === command.body.cart_id && current?.body.quote_id === command.body.quote_id) storage.removeItem(prefix + command.userId)
}

export const checkoutLock = async (userId, action) => {
  if (typeof navigator !== 'undefined' && navigator.locks) return navigator.locks.request(prefix + userId, action)
  return action()
}
