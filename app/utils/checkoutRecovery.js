const prefix = 'elcomputer-checkout-pending-'
export const cartCompletionPrefix = 'elcomputer-cart-completed-'

// Acknowledgements write only this marker, never the mutable cart envelope.
// Concurrent cart edits therefore cannot be erased by a stale read/write pair.
export const acknowledgeCart = (storage, snapshot, nextId) => {
  const key = cartCompletionPrefix + snapshot.id
  if (!storage.getItem(key)) storage.setItem(key, JSON.stringify({ revision: snapshot.revision, nextId }))
}

export const restoreCart = (storage, state) => {
  const restored = { ...state }
  for (let count = 0; restored.id && count < 32; count++) {
    const marker = JSON.parse(storage.getItem(cartCompletionPrefix + restored.id) || 'null')
    if (!marker?.revision || !/^[0-9a-f-]{36}$/i.test(marker.nextId || '')) break
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

export const savePendingCheckout = (storage, command) => {
  storage.setItem(prefix + command.userId, JSON.stringify(command))
}

export const removePendingCheckout = (storage, command) => {
  const current = readPendingCheckout(storage, command.userId)
  if (current?.body.cart_id === command.body.cart_id && current?.body.quote_id === command.body.quote_id) storage.removeItem(prefix + command.userId)
}

export const checkoutLock = async (userId, action) => {
  if (typeof navigator !== 'undefined' && navigator.locks) return navigator.locks.request(prefix + userId, action)
  return action()
}
