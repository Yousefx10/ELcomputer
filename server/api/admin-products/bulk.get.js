import { createError, getQuery } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { privateProductResponse } from '../../utils/productSave'
import { throwProductBulkError } from '../../utils/productBulk'
import { bulkUuid } from '../../../app/utils/productBulk'

export default defineEventHandler(async event => {
  privateProductResponse(event)
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'products.edit' })
  const query = getQuery(event)
  if (Object.keys(query).length !== 1 || !bulkUuid(query.request_id)) throw createError({ statusCode: 400, statusMessage: 'Batch request is invalid.' })
  const { data, error } = await supabaseAdmin.rpc('catalog_product_bulk_status', {
    p_admin_id: adminUser.id, p_request_id: query.request_id.toLowerCase()
  }).abortSignal(AbortSignal.timeout(10000))
  if (error) throwProductBulkError(error)
  return { result: data }
})
