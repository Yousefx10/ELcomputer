import { getQuery } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { afterSalesHandler, afterSalesScope, afterSalesRpc } from '../../utils/afterSalesPolicy.js'
export default defineEventHandler(afterSalesHandler(async event => {
  const { supabaseAdmin } = await requireAdminRequest(event, { permission: 'settings.view' })
  const { scope = 'global', id } = getQuery(event)
  const scopeKey = afterSalesScope(scope, id)
  const { data, error } = await supabaseAdmin.from('after_sales_policies').select('*').eq('scope_key', scopeKey).maybeSingle()
  if (error) throw error
  let scopeItem = null
  if (scope !== 'global') {
    const result = await supabaseAdmin.from(scope === 'product' ? 'products' : 'categories').select(scope === 'product' ? 'id,title,category_id' : 'id,name,name_ar').eq('id', id).maybeSingle()
    if (result.error) throw result.error
    scopeItem = result.data
  }
  const effective = await afterSalesRpc(supabaseAdmin, 'after_sales_resolve_policy', { p_product_id: scope === 'product' ? id : null, p_category_id: scope === 'category' ? id : null })
  const parent = scope === 'global' ? null : await afterSalesRpc(supabaseAdmin, 'after_sales_resolve_policy', { p_category_id: scope === 'product' ? scopeItem?.category_id || null : null })
  const { updated_by: _author, ...record } = data || { scope_key: scopeKey, revision: 0 }
  return { record, effective, parent, scope_item: scopeItem }
}))
