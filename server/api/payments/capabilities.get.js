import { getPaymobConfig } from '../../utils/payments/paymob.js'
import { paymentHandler, paymentNoStore } from '../../utils/payments/index.js'
import { requireCustomerRequest } from '../../utils/customerRequest'
import { controlledPaymentRuntime } from '../../utils/controlledPurchase.js'
import { normalPurchaseScope, publicPurchasingEnabled, safePurchaseCapability } from '../../utils/normalPurchase.js'
export default paymentHandler(async event => {
  paymentNoStore(event)
  const runtime = useRuntimeConfig(event)
  let scope = null
  if (!publicPurchasingEnabled(runtime)) {
    try {
      const { authUser } = await requireCustomerRequest(event)
      scope = normalPurchaseScope(runtime, authUser)
    } catch { return { card: { available: false }, express: [], purchase: { available: false } } }
  }
  const purchase = safePurchaseCapability(scope)
  try {
    const config = getPaymobConfig(scope ? controlledPaymentRuntime(runtime) : runtime)
    const available = config.methods.some(method => method.method === 'card' && method.available)
    return { card: { available, initiationAvailable: available && (!scope || scope.payment_enabled), provider: 'paymob', mode: config.mode }, express: [], purchase }
  } catch { return { card: { available: false }, express: [], purchase } }
})
