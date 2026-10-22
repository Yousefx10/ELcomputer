import { getQuery } from 'h3'
import { requireAdminRequest } from '../../../utils/adminRequest'
import { pdpId, privatePresentationResponse, presentationError } from '../../../utils/productPresentation'

export default defineEventHandler(async event => {
  privatePresentationResponse(event)
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'products.edit' })
  const query = getQuery(event)
  const productId = pdpId(event.context.params?.id)
  if (query.request_id) {
    const { data, error } = await supabaseAdmin.rpc('catalog_product_presentation_status', { p_admin_id: adminUser.id, p_request_id: pdpId(query.request_id) })
    if (error) presentationError(error)
    if (data?.committed && data.product_id !== productId) presentationError({ code: '42501' })
    return data
  }
  const { data, error } = await supabaseAdmin.rpc('catalog_product_presentation', { p_admin_id: adminUser.id, p_product_id: productId })
  if (error) presentationError(error)
  return data
})
