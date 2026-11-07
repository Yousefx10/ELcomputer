import { createError, setHeader } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { assertExternalErpDomain } from '../../utils/erpOwnership'
import { readDaftraPaymentOptions } from '../../utils/daftraCatalog'

// Daftra payment method and treasury used to mark card and Apple Pay bills paid.
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const { supabaseAdmin } = await requireAdminRequest(event, { permission: 'settings.view' })
  await assertExternalErpDomain(supabaseAdmin)
  const { data, error } = await supabaseAdmin.from('erp_provider_settings').select('online_payment_method,online_treasury_id').eq('id', 'daftra').maybeSingle()
  if (error) throw createError({ statusCode: 503, statusMessage: 'ERP settings are unavailable.' })
  let options = { treasuries: [], methodsInUse: [] }, remoteError = ''
  try { options = await readDaftraPaymentOptions() } catch { remoteError = 'Daftra lists are unavailable. Try again later.' }
  return { method: data?.online_payment_method || '', treasuryId: data?.online_treasury_id || null, ...options, remoteError }
})
