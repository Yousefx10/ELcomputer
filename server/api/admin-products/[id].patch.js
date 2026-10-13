import { requireAdminRequest } from '../../utils/adminRequest'
import { privateProductResponse, productId, saveProduct } from '../../utils/productSave'

export default defineEventHandler(async event => {
  privateProductResponse(event)
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'products.edit' })
  const id = productId(event.context.params?.id)
  return await saveProduct(supabaseAdmin, adminUser, await readBody(event), 'update', id)
})
