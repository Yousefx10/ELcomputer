import { createError, setHeader } from 'h3'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const keys = ['command_id', 'action', 'collection_id', 'amount', 'reference', 'received_on', 'confirmed']

export function codCashCommand(orderId, body) {
  let valid = false
  try {
    valid = uuid.test(orderId) && body && typeof body === 'object' && !Array.isArray(body)
      && Object.keys(body).length === keys.length && keys.every(key => Object.hasOwn(body, key))
      && uuid.test(body.command_id) && ['receive', 'reconcile'].includes(body.action)
      && (body.action === 'receive' ? body.collection_id === null : uuid.test(body.collection_id))
      && ['string', 'number'].includes(typeof body.amount)
      && /^\d+(\.\d{1,2})?$/.test(String(body.amount)) && Number(body.amount) > 0 && Number(body.amount) < 1e10
      && typeof body.reference === 'string' && body.reference.trim().length >= 3 && body.reference.trim().length <= 120
      && typeof body.received_on === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.received_on)
      && Number(body.received_on.slice(0, 4)) > 0
      && new Date(body.received_on + 'T00:00:00Z').toISOString().slice(0, 10) === body.received_on
      && body.confirmed === true
  } catch { /* Calendar errors fail closed. */ }
  if (!valid) throwCodCashError({ message: 'cod:invalid' })
  return { ...body, command_id: body.command_id.toLowerCase(), reference: body.reference.trim() }
}

export function codCashResponse(event) {
  setHeader(event, 'cache-control', 'private, no-store')
  setHeader(event, 'pragma', 'no-cache')
}

export function throwCodCashError(error) {
  const reason = error?.message?.match(/^cod:(permission|invalid|reused|reset|missing|ineligible|history|balance|mismatch|duplicate|date)$/)?.[1]
    || (error?.code === '42501' ? 'permission' : error?.code === '23505' ? 'duplicate' : 'unknown')
  const messages = {
    permission: 'Order or treasury permission is required.',
    invalid: 'Check the cash amount, reference, date and confirmation.',
    reused: 'This command has different details.',
    reset: 'This cash record was cleared by System Reset.',
    missing: 'Order or cash receipt not found.',
    ineligible: 'Use delivered normal COD orders with built-in accounting.',
    history: 'Existing payment history needs financial review.',
    balance: 'Cash exceeds the outstanding balance.',
    mismatch: 'Match the receipt amount and collection date.',
    duplicate: 'This receipt or reference is already recorded.',
    date: 'The cash date cannot precede the order.',
    unknown: 'Result unknown. Retry the same cash command.'
  }
  throw createError({ statusCode: reason === 'permission' ? 403 : reason === 'unknown' ? 503
    : reason === 'missing' ? 404 : ['invalid', 'date'].includes(reason) ? 400 : 409,
  statusMessage: messages[reason], data: { codCashError: reason } })
}

export async function loadCodCollections(supabaseAdmin, order) {
  if (order.is_preorder || order.payment_method !== 'cash') return null
  const { data: collections, error } = await supabaseAdmin.from('order_cod_collections')
    .select('id, amount, reference, received_on, confirmed_by, recorded_at').eq('order_id', order.id).order('recorded_at')
  if (error) throwCodCashError({})
  let reconciliations = []
  if (collections.length) {
    const result = await supabaseAdmin.from('order_cod_reconciliations')
      .select('id, collection_id, treasury_transaction_id, reference, reconciled_by, recorded_at')
      .in('collection_id', collections.map(item => item.id)).order('recorded_at')
    if (result.error) throwCodCashError({})
    reconciliations = result.data
  }
  const reconciled = new Set(reconciliations.map(item => item.collection_id))
  const cents = amount => Math.round(Number(amount) * 100)
  const received = collections.reduce((sum, item) => sum + cents(item.amount), 0)
  const posted = collections.reduce((sum, item) => sum + (reconciled.has(item.id) ? cents(item.amount) : 0), 0)
  return { collections, reconciliations, received: received / 100, reconciled: posted / 100,
    outstanding: (cents(order.total_amount) - cents(order.amount_paid)) / 100,
    awaiting_reconciliation: (received - posted) / 100,
    history_consistent: received === cents(order.amount_paid) && order.payment_status === (received > 0
      ? received === cents(order.total_amount) ? 'paid' : 'partially_paid' : 'pending')
      && (received > 0 && received === cents(order.total_amount)) === Boolean(order.paid_at) }
}
