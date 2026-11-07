import { getAvailablePaymentMethods } from './paymentMethods'

export const checkoutPaymentMethods = (settings, capabilities, { restricted = false, preorder = false } = {}) =>
  getAvailablePaymentMethods(settings).filter(method => (!restricted || method.value === 'card')
    && (!capabilities?.purchase?.beta || capabilities.purchase.paymentMethods?.includes(method.value))
    && (!capabilities?.purchase?.paymentFirst||['card','cash','instapay'].includes(method.value))
    && (method.value!=='instapay'||capabilities?.manualTransfer?.available===true)
    && (method.value !== 'card' || capabilities?.card?.available === true)
    && (!preorder || ['bank_transfer', 'instapay'].includes(method.value)))

export { checkoutDeliveryOptions } from './deliveryOptions'

// Read saved customer balances only. Delivery never proves cash was collected.
export const codPaymentState = order => {
  if (['cancelled', 'refunded'].includes(order.status)) return 'closed'
  const paid = Number(order.amount_paid), total = Number(order.total_amount)
  if (!Number.isFinite(paid) || !Number.isFinite(total) || total <= 0) return 'review'
  if (order.payment_status === 'paid' && paid === total) return 'collected'
  if (order.payment_status === 'partially_paid' && paid > 0 && paid < total) return 'partial'
  if (order.payment_status === 'pending' && paid === 0) return 'awaiting'
  return 'review'
}
