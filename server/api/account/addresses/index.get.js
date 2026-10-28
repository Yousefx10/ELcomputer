import { setHeader, getQuery, createError } from 'h3'
import { requireCustomerRequest } from '../../../utils/customerRequest'
import { deliveryAddressProjection, throwSavedAddressError } from '../../../utils/customerDeliveryAddresses.js'

export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const { authUser, supabaseAdmin } = await requireCustomerRequest(event)
  if (Object.keys(getQuery(event)).length) throw createError({ statusCode: 400, statusMessage: 'Invalid saved address request.' })
  const { data, error } = await supabaseAdmin.from('customer_delivery_addresses')
    .select(deliveryAddressProjection).eq('customer_id', authUser.id)
    .order('created_at').order('id').limit(20)
  if (error) throwSavedAddressError(error)
  return { addresses: data || [], limit: 20 }
})
