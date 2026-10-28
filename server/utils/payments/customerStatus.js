import { PaymentError, toMinorUnits } from './paymob.js'

// Private ledger reads require an already owned order. Redirects, local
// deadlines and order lifecycle changes never establish payment outcome.
export const projectCustomerPayment = (order, attempt, transactions = [], now = Date.now()) => {
  const result = status => ({ status, verified: status === 'paid',
    mode: attempt?.mode || null, recovery: 'review', changeMethodAvailable: false })
  const payable = order.payment_method === 'card' && !order.is_preorder
    && ['pending_payment', 'on_hold'].includes(order.status)
    && ['pending', 'failed'].includes(order.payment_status)
  if (order.payment_method !== 'card' || order.is_preorder) return { ...result('not_applicable'), recovery: 'none' }
  if (!attempt) return order.payment_status === 'pending' && payable
    ? { ...result('awaiting_payment'), recovery: 'start' } : result('provider_uncertain')
  let amount
  try { amount = toMinorUnits(order.total_amount) } catch { return result('provider_uncertain') }
  const contextMatches = attempt.order_id === order.id && attempt.provider === 'paymob'
    && attempt.method === 'card' && attempt.currency === order.currency
    && order.currency === 'EGP' && Number(attempt.amount_minor) === amount
  const rows = transactions.filter(row => row.attempt_id === attempt.id && row.provider === 'paymob')
  const succeeded = rows.filter(row => row.status === 'succeeded')
  if (!contextMatches) return result('provider_uncertain')
  if (succeeded.length || attempt.status === 'succeeded' || order.payment_status === 'paid') {
    let paidAmount
    try { paidAmount = toMinorUnits(order.amount_paid) } catch { /* remain unverified */ }
    const verified = attempt.mode === 'live' && attempt.status === 'succeeded'
      && succeeded.length === 1 && order.payment_status === 'paid'
      && paidAmount === amount && Number.isFinite(Date.parse(order.paid_at))
      && Number.isFinite(Date.parse(attempt.paid_at))
      && !['cancelled', 'refunded'].includes(order.status)
    if (verified) return { ...result('paid'), recovery: 'none' }
    if (attempt.mode === 'test' && attempt.status === 'succeeded' && succeeded.length === 1
      && order.payment_status !== 'paid') return { ...result('test_succeeded'), recovery: 'none' }
    return result('provider_uncertain')
  }
  // A signed failed transaction describes that transaction, not proof that no
  // other provider payment exists. Recovery still requires reconciliation.
  if (attempt.status === 'failed' && rows.some(row => row.status === 'failed')
    && !rows.some(row => row.status === 'pending')) return result('failed')
  const deadline = Date.parse(attempt.expires_at)
  if (!payable || !Number.isFinite(deadline) || deadline <= now || attempt.error_code
    || !['pending', 'initiated'].includes(attempt.status)) return result('provider_uncertain')
  return result('pending')
}

export const readCustomerPayment = async (db, ownedOrder, now = Date.now()) => {
  const attemptResult = await db.from('payment_attempts')
    .select('id, order_id, provider, method, mode, amount_minor, currency, status, paid_at, expires_at, error_code')
    .eq('order_id', ownedOrder.id).eq('provider', 'paymob').maybeSingle()
  if (attemptResult.error) throw new PaymentError('payment_status_unavailable')
  const attempt = attemptResult.data
  let transactions = []
  if (attempt) {
    const rows = await db.from('payment_transactions').select('attempt_id, provider, status')
      .eq('attempt_id', attempt.id).eq('provider', 'paymob').order('created_at', { ascending: false }).limit(101)
    if (rows.error) throw new PaymentError('payment_status_unavailable')
    transactions = rows.data || []
    // A truncated ledger must not hide an earlier success or duplicate.
    if (transactions.length > 100) return { status: 'provider_uncertain', verified: false,
      mode: attempt.mode, recovery: 'review', changeMethodAvailable: false }
  }
  return projectCustomerPayment(ownedOrder, attempt, transactions, now)
}

export const readOwnedPaymentStatus = async (db, userId, orderId) => {
  const { data: order, error } = await db.from('customer_orders')
    .select('id, order_number, status, payment_status, payment_method, is_preorder, total_amount, amount_paid, paid_at, currency')
    .eq('id', orderId).eq('user_id', userId).maybeSingle()
  if (error) throw new PaymentError('payment_status_unavailable')
  if (!order) throw new PaymentError('order_not_found', 404)
  return { orderId: order.id, orderNumber: order.order_number, orderStatus: order.status,
    ...await readCustomerPayment(db, order) }
}
