import { createError } from 'h3'
import { isBuiltInErp, isDaftraErp } from '../../app/utils/erpState.js'

export async function getErpSettings(supabaseAdmin) {
  const { data, error } = await supabaseAdmin.from('site_settings')
    .select('erp_mode,daftra_connection_status,daftra_last_checked_at,daftra_connected_at,daftra_connection_error,erp_state_version,daftra_tested_revision')
    .eq('key', 'default').maybeSingle()
  if (error || !data) throw createError({ statusCode: 503, statusMessage: 'ERP settings are unavailable. Apply the ERP ownership migration.' })
  return data
}

export async function assertBuiltInErpDomain(supabaseAdmin) {
  const settings = await getErpSettings(supabaseAdmin)
  if (!isBuiltInErp(settings)) throw createError({ statusCode: 409, statusMessage: 'This operation is managed in Daftra.' })
  return settings
}

export async function assertExternalErpDomain(supabaseAdmin) {
  const settings = await getErpSettings(supabaseAdmin)
  if (!isDaftraErp(settings)) throw createError({ statusCode: 409, statusMessage: 'Daftra is not the active ERP provider.' })
  return settings
}
