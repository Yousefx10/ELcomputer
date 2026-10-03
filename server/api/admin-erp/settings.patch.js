import { createError, readBody } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { getDaftraConfigSummary } from '../../utils/daftra'

export default defineEventHandler(async event => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission:'settings.edit' })
  const body = await readBody(event)
  if (body?.confirmed !== true || !['built_in','daftra'].includes(body.mode)
    || !Number.isSafeInteger(body.stateVersion)) throw createError({ statusCode:400,statusMessage:'Confirm the reviewed ERP transition.' })
  if (body.mode==='daftra' && !(await getDaftraConfigSummary(supabaseAdmin)).configured) {
    throw createError({statusCode:409,statusMessage:'Save and test Daftra credentials first.'})
  }
  const { data,error } = await supabaseAdmin.rpc('erp_change_mode',{
    p_admin_id:adminUser.id,p_mode:body.mode,p_expected_version:body.stateVersion,
    p_choice:body.choice,p_review_id:body.reviewId || null
  })
  if (error) throw createError({statusCode:409,statusMessage:'ERP transition could not complete. Reload, test and review again.'})
  return data
})
