import { readBody } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { privateProductResponse } from '../../utils/productSave'
import { prepareProductBulk, throwProductBulkError } from '../../utils/productBulk'

export default defineEventHandler(async event => {
  privateProductResponse(event)
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'products.edit' })
  const command = prepareProductBulk(await readBody(event))
  const { data, error } = await supabaseAdmin.rpc('catalog_bulk_products', {
    p_admin_id: adminUser.id, p_request_id: command.request_id, p_operation: command.operation,
    p_reference_id: command.reference_id, p_items: command.items
  }).abortSignal(AbortSignal.timeout(60000))
  if (error) throwProductBulkError(error)
  if (!data) throwProductBulkError({})
  return data
})
