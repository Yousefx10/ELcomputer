import { requireAdminRequest } from '../../utils/adminRequest'
import { privateProductResponse, saveProduct } from '../../utils/productSave'

export default defineEventHandler(async event => {
  privateProductResponse(event)
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'products.add' })
  return await saveProduct(supabaseAdmin, adminUser, await readBody(event), 'create')
})
