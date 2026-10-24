export const cartStatePrefix = 'commerce-cart-v3:'
export const guestCartSessionKey = 'commerce-cart-guest-session'
export const cartStateKey = owner => cartStatePrefix + encodeURIComponent(owner)
export const accountCartOwner = accountId => accountId ? 'account:' + accountId : ''

// v2 and older browser-wide envelopes have no trustworthy owner. Preserve them
// on disk, but never infer ownership or copy them into a customer/guest basket.
export const readOwnedCart = (storage, owner) => {
  const raw = storage.getItem(cartStateKey(owner))
  if (!raw) return null
  const value = JSON.parse(raw)
  return value?.version === 3 && value.owner === owner && Array.isArray(value.items) ? value : null
}
