import { getQuery } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { privateProductResponse } from '../../utils/productSave'
import { productListQuery, throwProductListError } from '../../utils/productList'

export default defineEventHandler(async event => {
  privateProductResponse(event)
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'products.view' })
  const query = productListQuery(getQuery(event))
  const { data, error } = await supabaseAdmin.rpc('catalog_product_list', {
    p_admin_id: adminUser.id, p_query: query.q, p_status: query.status,
    p_category: query.category, p_brand: query.brand, p_mode: query.mode,
    p_stock: query.stock, p_sort: query.sort, p_page: query.page
  }).abortSignal(AbortSignal.timeout(10000))
  if (error) throwProductListError(error)
  return data
})
