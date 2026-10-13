import { requireAdminRequest } from '../../utils/adminRequest'
import { privateProductResponse, productId, throwProductSaveError } from '../../utils/productSave'

export default defineEventHandler(async event => {
  privateProductResponse(event)
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'products.edit' })
  const { data, error } = await supabaseAdmin.rpc('catalog_product_edit_snapshot', {
    p_admin_id: adminUser.id, p_product_id: productId(event.context.params?.id)
  })
  if (error) throwProductSaveError(error)
  return data
})
