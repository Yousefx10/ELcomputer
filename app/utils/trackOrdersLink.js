// Dashboard-set target of the storefront "Track your orders" link (owner request 7 Nov 2026).
// The database check mirrors these rules; anything else falls back to the tracking page.
export const DEFAULT_TRACK_ORDERS_LINK = '/track'
const INTERNAL = /^\/(?!\/)[A-Za-z0-9/_.~?=&%#-]{0,200}$/
const EXTERNAL = /^https:\/\/[A-Za-z0-9.-]+(:[0-9]{1,5})?(\/[^\s<>"]*)?$/
export const trackOrdersLinkError = value => {
  const text = String(value ?? '').trim()
  if (INTERNAL.test(text)) return null
  return text.length <= 300 && EXTERNAL.test(text) ? null : 'invalid'
}
export const trackOrdersTarget = value => {
  const text = String(value ?? '').trim()
  if (!text || trackOrdersLinkError(text)) return { to: DEFAULT_TRACK_ORDERS_LINK, external: false }
  return { to: text, external: text.startsWith('https://') }
}
