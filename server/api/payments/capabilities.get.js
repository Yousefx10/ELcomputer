import {getSupabaseAdminClient} from '../../utils/supabaseAdmin'
import {paymentFirstEnabled} from '../../utils/payments/checkout.js'
import { getPaymobConfig } from '../../utils/payments/paymob.js'
import { paymentHandler, paymentNoStore } from '../../utils/payments/index.js'
import { requireCustomerRequest } from '../../utils/customerRequest'
import { controlledPaymentRuntime } from '../../utils/controlledPurchase.js'
import { normalPurchaseScope, publicPurchasingEnabled, safePurchaseCapability } from '../../utils/normalPurchase.js'
import { betaPurchaseCapability, betaPurchasePolicy } from '../../utils/betaPurchase.js'
import { pixelEnabledFor } from '../../utils/payments/methods.js'
export default paymentHandler(async event => {
  paymentNoStore(event)
  const runtime = useRuntimeConfig(event)
  let scope = null
  let customerId = ''
  if (!publicPurchasingEnabled(runtime)) {
    try {
      const { authUser } = await requireCustomerRequest(event)
      customerId = authUser.id
      scope = normalPurchaseScope(runtime, authUser)
    } catch { return { card: { available: false }, express: [], purchase: { available: false } } }
  }
  let beta
  try {
    if (publicPurchasingEnabled(runtime) && betaPurchasePolicy(runtime)?.customer_ids) {
      const { authUser } = await requireCustomerRequest(event)
      normalPurchaseScope(runtime, authUser)
    }
    beta = betaPurchaseCapability(runtime)
  }
  catch { return { card: { available: false }, express: [], purchase: { available: false } } }
  const purchase = { ...safePurchaseCapability(scope), ...beta }
  let lifecycle=null
  if(paymentFirstEnabled(runtime)){try{const r=await getSupabaseAdminClient().rpc('commerce_payment_checkout_readiness');if(!r.error)lifecycle=r.data}catch{}}
  if(paymentFirstEnabled(runtime))purchase.paymentFirst=lifecycle?.enabled===true
  const manualTransfer={available:paymentFirstEnabled(runtime)&&[true,'true'].includes(runtime.manualTransferEnabled)&&lifecycle?.manual?.ready===true&&(!purchase.beta||purchase.paymentMethods?.includes('instapay')===true)}
  try {
    const config = getPaymobConfig(scope ? controlledPaymentRuntime(runtime) : runtime)
    if ([true, 'true'].includes(runtime.paymobPixelEnabled) && !customerId) {
      try { customerId = (await requireCustomerRequest(event)).authUser.id } catch {}
    }
    const embedded = pixelEnabledFor(runtime, customerId)
    const available = (!paymentFirstEnabled(runtime)||lifecycle?.enabled===true)&&config.methods.some(method => method.method === 'card' && method.available)
    const apple = config.methods.find(method => method.method === 'apple_pay')
    return { manualTransfer,card: { available, initiationAvailable: available && (!scope || scope.payment_enabled), provider: 'paymob', mode: config.mode, experience: embedded ? 'embedded' : 'redirect' }, express: available && embedded && apple?.available ? [{ method: 'apple_pay', available: true, experience: 'embedded' }] : [], purchase }
  } catch { return { manualTransfer,card: { available: false }, express: [], purchase } }
})
