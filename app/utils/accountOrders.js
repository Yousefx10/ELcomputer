import { activeCustomerOrderStatuses, completedOrderStatuses } from './orderStatus.js'

export const accountOrderFilters = [
  { value: 'all', label: 'All orders', statuses: null },
  { value: 'active', label: 'In progress', statuses: activeCustomerOrderStatuses },
  { value: 'completed', label: 'Completed', statuses: completedOrderStatuses },
  { value: 'closed', label: 'Cancelled & refunded', statuses: ['cancelled', 'refunded'] }
]

export const getAccountOrderFilter = value => accountOrderFilters.find(item => item.value === value)
  || accountOrderFilters[0]

export const formatAccountMoney = (value, currency = 'EGP') => {
  const amount = Number(value || 0)
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'EGP' }).format(amount)
  } catch {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EGP' }).format(amount)
  }
}

export const formatAccountDate = (value, withTime = false) => {
  const date = new Date(value || '')
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium', ...(withTime ? { timeStyle: 'short' } : {})
  }).format(date)
}

export const paymentStatusLabel = value => ({
  pending: 'Payment pending', paid: 'Paid', failed: 'Payment failed', refunded: 'Refunded'
})[value] || 'Payment status unavailable'

export const paymentStatusClass = value => ({
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
