import { createError, readBody, setHeader } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { recordAdminActivity } from '../../utils/adminLogs'
import { assertExternalErpDomain } from '../../utils/erpOwnership'
import { readDaftraPaymentOptions } from '../../utils/daftraCatalog'

export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'settings.edit' })
  await assertExternalErpDomain(supabaseAdmin)
  const body = await readBody(event)
  const method = String(body?.method ?? '').trim()
  const treasuryId = body?.treasuryId === null || body?.treasuryId === '' || body?.treasuryId === undefined ? null : Number(body.treasuryId)
  if ((method && !/^[A-Za-z0-9_-]{1,60}$/.test(method)) || (treasuryId !== null && !(Number.isSafeInteger(treasuryId) && treasuryId > 0))) {
    throw createError({ statusCode: 400, statusMessage: 'Choose a valid payment method and treasury.' })
  }
  if (treasuryId !== null) {
    const { treasuries } = await readDaftraPaymentOptions()
    if (!treasuries.some(treasury => treasury.id === treasuryId)) throw createError({ statusCode: 409, statusMessage: 'This treasury was not found in Daftra.' })
  }
  const { data, error } = await supabaseAdmin.from('erp_provider_settings')
    .update({ online_payment_method: method || null, online_treasury_id: treasuryId }).eq('id', 'daftra').select('id').maybeSingle()
  if (error || !data) throw createError({ statusCode: 409, statusMessage: 'Save the Daftra connection first.' })
  await recordAdminActivity({ supabaseAdmin, adminUser, actionKey: 'settings.erp.payments-update', description: 'Updated Daftra online payment settings.',
    metadata: { method: method || null, treasuryId } })
  return { method, treasuryId }
})
