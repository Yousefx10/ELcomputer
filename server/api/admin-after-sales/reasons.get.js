import { requireAdminRequest } from '../../utils/adminRequest'
import { afterSalesHandler } from '../../utils/afterSalesPolicy.js'
export default defineEventHandler(afterSalesHandler(async event => {
  const { supabaseAdmin } = await requireAdminRequest(event, { permission: 'settings.view' })
  const { data, error } = await supabaseAdmin.from('after_sales_return_reasons').select('*').order('sort_order').order('key')
  if (error) throw error
  return { reasons: data || [] }
}))
