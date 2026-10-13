import { getQuery } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { privateProductResponse, productId, throwProductSaveError } from '../../utils/productSave'

export default defineEventHandler(async event => {
  privateProductResponse(event)
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event)
  const { data, error } = await supabaseAdmin.rpc('catalog_product_save_status', {
    p_admin_id: adminUser.id, p_request_id: productId(getQuery(event).request_id)
  })
  if (error) throwProductSaveError(error)
  return { result: data }
})
