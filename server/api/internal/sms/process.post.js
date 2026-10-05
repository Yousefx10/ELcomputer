import { createError, getHeader } from 'h3'
import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'
import { credentialSecretsMatch } from '../../../utils/credentialSecrets.js'
import { processSmsQueue } from '../../../utils/sms/service.js'
import { readSmsBody, smsHandler } from '../../../utils/sms/admin.js'
import { processOrderSmsEvents } from '../../../utils/sms/orderEvents.js'
export default defineEventHandler(smsHandler(async event => {
  const saved = String(useRuntimeConfig().smsWorkerSecret || '')
  const supplied = String(getHeader(event, 'x-sms-worker-secret') || '')
  if (saved.length < 32 || !supplied || !credentialSecretsMatch(saved, supplied)) throw createError({ statusCode: 401, statusMessage: 'Invalid worker secret.' })
  const body = await readSmsBody(event, 1024)
  const db = getSupabaseAdminClient()
  const orderEvents = await processOrderSmsEvents(db, { limit: body.limit })
  return { ...await processSmsQueue(db, { limit: body.limit }), orderEvents }
}))
