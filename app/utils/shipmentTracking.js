export const shippingStates = ['registered', 'picked_up', 'in_transit', 'arrived_at_hub', 'out_for_delivery', 'delivered', 'delivery_attempted', 'delayed', 'rescheduled', 'held', 'returning', 'returned', 'cancelled', 'lost', 'damaged', 'partial_delivery', 'unknown']
export const shipmentStateKey = state => `shipment.states.${shippingStates.includes(state) ? state : 'unknown'}`
export const shipmentExceptionStates = ['delivery_attempted', 'delayed', 'rescheduled', 'held', 'returning', 'returned', 'cancelled', 'lost', 'damaged', 'partial_delivery']

// Only recognized reference reasons reach customers. Raw courier text stays server-side.
const reasonNames = ['Company Closed', 'Not Home', 'Consignee Moved', 'Item Quality', 'Missing Item', 'Incorrect Item', 'Wrong COD', 'Check First', 'Order Cancelled', 'Not Ordered', 'Payment Not Ready', 'Consignee Request', 'Customer Travel', 'Phone Closed', 'Always busy', 'No Answer', 'Phone Out Of Service', 'Wrong Consignee Name', 'Wrong Phone Number', 'Packaging Damage', 'Partial Damage', 'Total Damage', 'Incorrect street Name', 'Incorrect Building Number']
export const shipmentReasonKey = reason => {
  const text = String(reason || '').trim().toLowerCase().replaceAll('consingee', 'consignee')
  const index = reasonNames.findIndex(name => text === name.toLowerCase() || text.endsWith(`-${name.toLowerCase()}`) || text.endsWith(`- ${name.toLowerCase()}`))
  return index < 0 ? null : `shipment.reasons.r${index}`
}

export const shipmentTimeline = (order, shipping) => {
  const steps = [{ id: 'placed', label_key: 'shipment.orderPlaced', date: order?.created_at, source: 'order' }]
  if (order?.paid_at && order.payment_status === 'paid') steps.push({ id: 'paid', label_key: 'shipment.paymentConfirmed', date: order.paid_at, source: 'order' })
  if (order?.packing_completed_at) steps.push({ id: 'packed', label_key: 'shipment.packed', date: order.packing_completed_at, source: 'order' })
  for (const event of shipping?.events || []) steps.push({
    id: event.id, label_key: shipmentStateKey(event.state), date: event.status_at || event.observed_at,
    observed: !event.status_at, source: 'courier', reason_key: event.reason_key, exception: shipmentExceptionStates.includes(event.state)
  })
  return steps.sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())
}
