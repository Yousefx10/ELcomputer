import { createError } from 'h3'
import { readCustomerShipment } from './customerShipment.js'

// Owner request 7 Nov 2026 (phase 3A): anyone with an AWB or order number can follow the parcel.
// Reads the website's own tracking records only; visitors never trigger a courier call.
export const normalizeAwb = value => {
  const text = String(value ?? '').trim().toUpperCase()
  return /^[A-Z0-9][A-Z0-9-]{3,39}$/.test(text) ? text : null
}
// "ORD-20261107-E7663BB340" or "20261107-E7663BB340". The random suffix keeps numbers unguessable.
export const normalizeOrderNumber = value => {
  const match = String(value ?? '').trim().toUpperCase().match(/^(?:ORD-)?(\d{8}-[A-Z0-9]{6,16})$/)
  return match ? `ORD-${match[1]}` : null
}
const FINISHED_SHIPMENT = new Set(['delivered', 'returned', 'cancelled'])
const unavailable = () => createError({ statusCode: 503, statusMessage: 'Tracking is unavailable. Please try again later.' })

// Courier states and times only: no order, customer, address, amount or raw courier text.
export const publicShipment = shipment => ({
  awb: shipment.awb, current_state: shipment.current_state, has_update: shipment.has_update === true,
  status_at: shipment.status_at || null, observed_at: shipment.observed_at || null, reason_key: shipment.reason_key || null,
  booked_at: shipment.booked_at || null, latest_update_at: shipment.latest_update_at || null, stale: shipment.stale === true,
  events: (shipment.events || []).map(event => ({ state: event.state, status_at: event.status_at || null, observed_at: event.observed_at || null, reason_key: event.reason_key || null }))
})

export const readPublicShipment = async (db, awb) => {
  const { data, error } = await db.from('shipping_order_jobs').select('order_id,awb').eq('awb', awb).limit(2)
  if (error) throw unavailable()
  if (!data || data.length !== 1) return null
  const shipment = await readCustomerShipment(db, data[0].order_id)
  if (shipment?.unavailable) throw unavailable()
  if (!shipment?.booking_verified || shipment.awb !== awb) return null
  return publicShipment(shipment)
}

// Same courier-only result as an AWB lookup; an order with no booked shipment reads as not found.
export const readPublicShipmentByOrder = async (db, orderNumber) => {
  const { data, error } = await db.from('customer_orders').select('id').eq('order_number', orderNumber).limit(2)
  if (error) throw unavailable()
  if (!data || data.length !== 1) return null
  const shipment = await readCustomerShipment(db, data[0].id)
  if (shipment?.unavailable) throw unavailable()
  return shipment?.booking_verified ? publicShipment(shipment) : null
}

const OPEN_STATUSES = ['pending_payment', 'processing', 'ready_to_deliver', 'being_shipped', 'out_for_delivery', 'on_hold', 'in_progress']
// A signed-in customer's undelivered orders from the last 90 days, newest first.
export const readOpenOrderShipments = async (db, userId, { limit = 5, now = Date.now() } = {}) => {
  const { data, error } = await db.from('customer_orders').select('id,order_number,status,payment_method,created_at')
    .eq('user_id', userId).in('status', OPEN_STATUSES).gte('created_at', new Date(now - 90 * 86400000).toISOString())
    .order('created_at', { ascending: false }).limit(20)
  if (error) throw unavailable()
  const orders = []
  for (const order of data || []) {
    if (orders.length >= limit) break
    // An unpaid card attempt is not an order to follow.
    if (order.status === 'pending_payment' && order.payment_method === 'card') continue
    const shipment = await readCustomerShipment(db, order.id)
    const visible = shipment?.booking_verified && !shipment.unavailable ? publicShipment(shipment) : null
    if (visible && FINISHED_SHIPMENT.has(visible.current_state)) continue
    orders.push({ id: order.id, order_number: order.order_number, status: order.status, payment_method: order.payment_method, created_at: order.created_at, shipment: visible })
  }
  return orders
}
