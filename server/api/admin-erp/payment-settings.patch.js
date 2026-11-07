import { createError, readBody, setHeader } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { recordAdminActivity } from '../../utils/adminLogs'
import { assertExternalErpDomain } from '../../utils/erpOwnership'
import { readDaftraPaymentOptions } from '../../utils/daftraCatalog'
import { PAYMENT_SETTING_ERRORS } from '../../utils/daftraSync'

export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'settings.edit' })
  await assertExternalErpDomain(supabaseAdmin)
  const body = await readBody(event)
  const methodOf = value => String(value ?? '').trim()
  const treasuryOf = value => value === null || value === '' || value === undefined ? null : Number(value)
  const method = methodOf(body?.method), treasuryId = treasuryOf(body?.treasuryId)
  const codMethod = methodOf(body?.codMethod), codTreasuryId = treasuryOf(body?.codTreasuryId)
  const validMethod = value => !value || /^[A-Za-z0-9_-]{1,60}$/.test(value)
  const validTreasury = value => value === null || (Number.isSafeInteger(value) && value > 0)
  if (![method, codMethod].every(validMethod) || ![treasuryId, codTreasuryId].every(validTreasury)) {
    throw createError({ statusCode: 400, statusMessage: 'Choose a valid payment method and treasury.' })
  }
  if (treasuryId !== null || codTreasuryId !== null) {
    const { treasuries } = await readDaftraPaymentOptions()
    if ([treasuryId, codTreasuryId].some(id => id !== null && !treasuries.some(treasury => treasury.id === id))) throw createError({ statusCode: 409, statusMessage: 'This treasury was not found in Daftra.' })
  }
  const { data, error } = await supabaseAdmin.from('erp_provider_settings')
    .update({ online_payment_method: method || null, online_treasury_id: treasuryId, cod_payment_method: codMethod || null, cod_treasury_id: codTreasuryId })
    .eq('id', 'daftra').select('id').maybeSingle()
  if (error || !data) throw createError({ statusCode: 409, statusMessage: 'Save the Daftra connection first.' })
  // Bills that stopped only for a missing or refused payment method retry now.
  let requeued = 0
  if (method || codMethod) {
    const retry = await supabaseAdmin.from('erp_sync_jobs').update({ status: 'pending', attempts: 0, last_error: null, available_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('provider', 'daftra').eq('operation', 'order.export').eq('status', 'failed').in('last_error', PAYMENT_SETTING_ERRORS).select('id')
    if (!retry.error) requeued = (retry.data || []).length
  }
  await recordAdminActivity({ supabaseAdmin, adminUser, actionKey: 'settings.erp.payments-update', description: 'Updated Daftra payment settings.',
    metadata: { method: method || null, treasuryId, codMethod: codMethod || null, codTreasuryId, requeued } })
  return { method, treasuryId, codMethod, codTreasuryId, requeued }
})
