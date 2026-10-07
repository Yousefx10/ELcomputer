import { createError } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { afterSalesHandler, afterSalesScope, afterSalesRpc, readAfterSalesBody, validateAfterSalesValues } from '../../utils/afterSalesPolicy.js'
export default defineEventHandler(afterSalesHandler(async event => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'settings.edit' })
  const body = await readAfterSalesBody(event)
  if (Object.keys(body).some(key => !['scope', 'id', 'section', 'revision', 'values'].includes(key)) || !Number.isInteger(body.revision) || body.revision < 0) {
    throw createError({ statusCode: 400, statusMessage: 'Enter valid after-sales policy values.' })
  }
  const scopeKey = afterSalesScope(body.scope, body.id)
  const values = validateAfterSalesValues(body.values, { scope: body.scope, section: body.section })
  const record = await afterSalesRpc(supabaseAdmin, 'after_sales_save_policy', { p_admin_id: adminUser.id, p_scope_key: scopeKey, p_section: body.section, p_revision: body.revision, p_values: values })
  return { record }
}))
