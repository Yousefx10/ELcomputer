import { getPaymobConfig } from '../../utils/payments/paymob.js'
import { paymentHandler, paymentNoStore } from '../../utils/payments/index.js'
export default paymentHandler(event => {
  paymentNoStore(event)
  try {
    const config = getPaymobConfig(useRuntimeConfig(event))
    return { card: { available: config.methods.some(method => method.method === 'card' && method.available), provider: 'paymob', mode: config.mode }, express: [] }
  } catch { return { card: { available: false }, express: [] } }
})
