import { createError, getQuery } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { privateProductResponse } from '../../utils/productSave'
import { productListQuery, throwProductListError } from '../../utils/productList'

export default defineEventHandler(async event => {
  privateProductResponse(event)
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'products.view' })
  const { kind, q, selected, ...extra } = getQuery(event)
  if (!['category', 'brand'].includes(kind) || Object.keys(extra).length) {
    throw createError({ statusCode: 400, statusMessage: 'Product filters are invalid.' })
  }
  const query = productListQuery({ ...(q !== undefined ? { q } : {}), ...(selected !== undefined ? { [kind]: selected } : {}) })
  const { data, error } = await supabaseAdmin.rpc('catalog_product_filter_options', {
    p_admin_id: adminUser.id, p_kind: kind, p_query: query.q, p_selected: query[kind]
  }).abortSignal(AbortSignal.timeout(10000))
  if (error) throwProductListError(error)
  return data
})
