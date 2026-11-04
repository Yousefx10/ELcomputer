import { createError, getHeader,setResponseStatus } from 'h3'
import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'
import { credentialSecretsMatch } from '../../../utils/credentialSecrets.js'
import { processSmsQueue } from '../../../utils/sms/service.js'
import { readSmsBody, smsHandler } from '../../../utils/sms/admin.js'
import { processOrderSmsEvents } from '../../../utils/sms/orderEvents.js'
import { processClaimCommunications } from '../../../utils/afterSalesCommunications.js'
import {processTransactionalSms} from '../../../utils/sms/transactional'
export default defineEventHandler(smsHandler(async event => {
  const runtime=useRuntimeConfig(event),enabled=[true,'true'].includes(runtime.smsTransactionalEnabled)
  if(!enabled){setResponseStatus(event,404);return {state:'disabled'}}
  const authorize=({trafficType}={})=>{
    const saved = String(useRuntimeConfig().smsWorkerSecret || ''), supplied = String(getHeader(event, 'x-sms-worker-secret') || '')
    if (saved.length < 32 || !supplied || !credentialSecretsMatch(saved, supplied)) throw createError({ statusCode: 401, statusMessage: 'Invalid worker secret.' })
    if(trafficType&&trafficType!=='notification')throw createError({statusCode:403,statusMessage:'SMS channel is disabled.'})
  }
  authorize()
  const body = await readSmsBody(event, 1024)
  const db = getSupabaseAdminClient()
  const channel=await db.rpc('sms_channel_state');if(channel.error||!channel.data?.transactionalEnabled){setResponseStatus(event,404);return {state:'disabled'}}
  authorize()
  const orderEvents = await processOrderSmsEvents(db, { limit: body.limit })
  const claimEvents=await processClaimCommunications(db,{channel:'sms',limit:body.limit||1,authorize})
  const transactionalEvents=await processTransactionalSms(db,{limit:body.limit||1,siteOrigin:runtime.public.siteUrl,authorize})
  return { ...await processSmsQueue(db, { limit: body.limit,authorize,trafficTypes:['notification'] }), orderEvents,claimEvents,transactionalEvents }
}))
