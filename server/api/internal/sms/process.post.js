import { createError, getHeader } from 'h3'
import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'
import { credentialSecretsMatch } from '../../../utils/credentialSecrets.js'
import { processSmsQueue } from '../../../utils/sms/service.js'
import { readSmsBody, smsHandler } from '../../../utils/sms/admin.js'
import { processOrderSmsEvents } from '../../../utils/sms/orderEvents.js'
import { processClaimCommunications } from '../../../utils/afterSalesCommunications.js'
export default defineEventHandler(smsHandler(async event => {
  const authorize=()=>{
    const saved = String(useRuntimeConfig().smsWorkerSecret || ''), supplied = String(getHeader(event, 'x-sms-worker-secret') || '')
    if (saved.length < 32 || !supplied || !credentialSecretsMatch(saved, supplied)) throw createError({ statusCode: 401, statusMessage: 'Invalid worker secret.' })
  }
  authorize()
  const body = await readSmsBody(event, 1024)
  const db = getSupabaseAdminClient()
  authorize()
  const orderEvents = await processOrderSmsEvents(db, { limit: body.limit })
  const claimEvents=await processClaimCommunications(db,{channel:'sms',limit:body.limit||1,authorize})
  return { ...await processSmsQueue(db, { limit: body.limit,authorize }), orderEvents,claimEvents }
}))
