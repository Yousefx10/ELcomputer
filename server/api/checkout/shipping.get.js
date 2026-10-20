import { createError } from 'h3'
import { requireCustomerRequest } from '../../utils/customerRequest'

export default defineEventHandler(async event => {
  const { supabaseAdmin } = await requireCustomerRequest(event)
  const { data, error } = await supabaseAdmin.from('commerce_shipping_companies')
    .select('id,name,client_shipping_price,checkout_governorates')
    .eq('is_active', true).eq('checkout_enabled', true).order('name').limit(50)
  if (error) throw createError({ statusCode: 503, statusMessage: 'Delivery options are unavailable.' })
  setHeader(event, 'Cache-Control', 'private, no-store')
  // Carrier costs, return costs, notes and provider secrets remain private.
  return { options: (data || []).map(row => ({ id: row.id, name: row.name,
    price: Number(row.client_shipping_price), governorates: row.checkout_governorates })) }
})
