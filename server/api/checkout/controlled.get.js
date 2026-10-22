import { requireCustomerRequest } from '../../utils/customerRequest'
import { paymentHandler } from '../../utils/payments/index.js'
import { controlledPurchase } from '../../utils/controlledPurchase.js'

export default paymentHandler(async event => {
  const { authUser, supabaseAdmin } = await requireCustomerRequest(event)
  return controlledPurchase({ db: supabaseAdmin, user: authUser, runtime: useRuntimeConfig(event), action: 'view' })
})
