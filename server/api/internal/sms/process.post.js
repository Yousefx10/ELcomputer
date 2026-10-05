import { createError, getHeader } from 'h3'
import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'
import { credentialSecretsMatch } from '../../../utils/credentialSecrets.js'
import { processSmsQueue } from '../../../utils/sms/service.js'
import { readSmsBody, smsHandler } from '../../../utils/sms/admin.js'
export default defineEventHandler(smsHandler(async event => {
  const saved = String(useRuntimeConfig().smsWorkerSecret || '')
  const supplied = String(getHeader(event, 'x-sms-worker-secret') || '')
  if (saved.length < 32 || !supplied || !credentialSecretsMatch(saved, supplied)) throw createError({ statusCode: 401, statusMessage: 'Invalid worker secret.' })
  const body = await readSmsBody(event, 1024)
  return processSmsQueue(getSupabaseAdminClient(), { limit: body.limit })
}))
