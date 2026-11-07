import { createError } from 'h3'
import { requireCustomerRequest } from '../../utils/customerRequest'
import { normalPurchaseScope } from '../../utils/normalPurchase.js'
import { betaPurchasePolicy } from '../../utils/betaPurchase.js'

export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const { authUser, supabaseAdmin } = await requireCustomerRequest(event)
  const scope = normalPurchaseScope(useRuntimeConfig(event), authUser)
  let query = supabaseAdmin.from('commerce_shipping_companies')
    .select('id,name,client_shipping_price,checkout_governorates,provider,cod_collection_enabled')
    .eq('is_active', true).eq('checkout_enabled', true)
  if (scope) query = query.eq('id', scope.shipping_company_id)
  const beta = betaPurchasePolicy(useRuntimeConfig(event))
  if (beta) query = query.eq('id', beta.shipping_company_id)
  const { data, error } = await query.order('name').limit(50)
  if (error) throw createError({ statusCode: 503, statusMessage: 'Delivery options are unavailable.' })
  // Governorate prices come from the same database function that prices the order.
  const priced = await supabaseAdmin.rpc('checkout_shipping_prices')
  if (priced.error) throw createError({ statusCode: 503, statusMessage: 'Delivery options are unavailable.' })
  const prices = priced.data && typeof priced.data === 'object' ? priced.data : {}
  setHeader(event, 'Cache-Control', 'private, no-store')
  // Carrier costs, return costs, notes and provider secrets remain private.
  return { options: (data || []).map(row => ({ id: row.id, name: row.name,
    price: Number(row.client_shipping_price), governorates: row.checkout_governorates,
    ...(prices[row.id] ? { prices: Object.fromEntries(Object.entries(prices[row.id]).map(([area, fee]) => [area, Number(fee)])) } : {}),
    cashAvailable: row.provider === 'manual' && row.cod_collection_enabled === true })) }
})
