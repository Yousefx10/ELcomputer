const statuses = new Set(['pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed', 'checkout-draft'])
export function historicalStatusKey(value) {
  const status = String(value || '').replace(/^wc-/, '')
  return statuses.has(status) ? `historicalOrders.status.${status}` : 'historicalOrders.status.unknown'
}
export function historicalDate(value, locale) {
  const date = new Date(value || '')
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {dateStyle:'medium'}).format(date)
}
