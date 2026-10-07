import { activeCustomerOrderStatuses, completedOrderStatuses } from './orderStatus.js'

export const accountOrderFilters = [
  { value: 'all', label: 'All orders', statuses: null },
  { value: 'active', label: 'In progress', statuses: activeCustomerOrderStatuses },
  { value: 'completed', label: 'Completed', statuses: completedOrderStatuses },
  { value: 'closed', label: 'Cancelled & refunded', statuses: ['cancelled', 'refunded'] }
]

export const getAccountOrderFilter = value => accountOrderFilters.find(item => item.value === value)
  || accountOrderFilters[0]

export const formatAccountMoney = (value, currency = 'EGP', locale = 'en-US') => {
  const amount = Number(value || 0)
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'EGP' }).format(amount)
  } catch {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EGP' }).format(amount)
  }
}

export const formatAccountDate = (value, withTime = false, locale = 'en-US') => {
  const date = new Date(value || '')
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium', ...(withTime ? { timeStyle: 'short' } : {})
  }).format(date)
}

// SQL returns a policy-local civil date. UTC formatting keeps that date intact
// for customers browsing from any timezone; no entitlement math runs here.
export const formatAccountCalendarDate = (value, locale = 'en-US') => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return 'Date unavailable'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}

export const paymentStatusLabel = value => ({
  partially_paid: 'Partially paid',
  pending: 'Payment pending', paid: 'Paid', failed: 'Payment failed', refunded: 'Refunded'
})[value] || 'Payment status unavailable'

export const paymentStatusClass = value => ({
  partially_paid: 'bg-blue-100 text-blue-700',
  pending: 'bg-amber-50 text-amber-800',
  paid: 'bg-emerald-50 text-emerald-800',
  failed: 'bg-red-50 text-red-800',
  refunded: 'bg-violet-50 text-violet-800'
})[value] || 'bg-slate-100 text-slate-700'

export const orderProgress = order => {
  const status = order?.status || ''
  const placed = { label: 'Order placed', detail: 'We received your order.', date: order?.created_at }
  if (!status) return [placed]

  const terminal = {
    cancelled: 'Order cancelled',
    refunded: 'Order refunded',
    on_hold: 'Order on hold'
  }
  const current = terminal[status] || ({
    pending_payment: 'Waiting for payment',
    processing: 'Processing your order',
    in_progress: 'Processing your order',
    ready_to_deliver: 'Ready to deliver',
    being_shipped: 'With the courier',
    out_for_delivery: 'Out for delivery',
    completed: 'Order completed',
    delivered: 'Delivered'
  })[status] || 'Latest order status'

  // Status history is not stored. Only placement and the current state are confirmed.
  return [placed, { label: current, current: true }]
}
