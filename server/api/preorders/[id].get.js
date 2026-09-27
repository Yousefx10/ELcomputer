import { createError, getRouterParam } from 'h3'
import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default defineEventHandler(async event => {
  const productId = getRouterParam(event, 'id')
  if (!UUID.test(productId || '')) throw createError({ statusCode: 400, statusMessage: 'Invalid product.' })
  const { data, error } = await getSupabaseAdminClient().rpc('commerce_preorder_availability', { p_product_id: productId })
  if (error) throw createError({ statusCode: 500, statusMessage: 'Could not check preorder availability.' })
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Preorder not found.' })
  setHeader(event, 'Cache-Control', 'no-store')
  return data
})
