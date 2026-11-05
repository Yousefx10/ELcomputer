import {createError,getHeader,setResponseStatus} from 'h3'
import {getSupabaseAdminClient} from '../../../utils/supabaseAdmin'
import {credentialSecretsMatch} from '../../../utils/credentialSecrets.js'
import {processSmsQueue} from '../../../utils/sms/service.js'
import {readSmsBody,smsHandler} from '../../../utils/sms/admin.js'
import {processOrderSmsEvents} from '../../../utils/sms/orderEvents.js'
import {processClaimCommunications} from '../../../utils/afterSalesCommunications.js'
import {processTransactionalSms} from '../../../utils/sms/transactional.js'
import {processMarketingSms,unsubscribeKeys} from '../../../utils/sms/marketing.js'
export default defineEventHandler(smsHandler(async event=>{
 const on=v=>[true,'true'].includes(v),runtime=useRuntimeConfig(event)
 if(!on(runtime.smsTransactionalEnabled)&&!on(runtime.smsMarketingEnabled)){setResponseStatus(event,404);return {state:'disabled'}}
 const authorize=({trafficType}={})=>{
  const current=useRuntimeConfig(event),saved=String(current.smsWorkerSecret||''),supplied=String(getHeader(event,'x-sms-worker-secret')||'')
  if(saved.length<32||!supplied||!credentialSecretsMatch(saved,supplied))throw createError({statusCode:401,statusMessage:'Invalid worker secret.'})
  if(trafficType==='notification'&&!on(current.smsTransactionalEnabled)||trafficType==='campaign'&&!on(current.smsMarketingEnabled))throw createError({statusCode:403,statusMessage:'SMS channel is disabled.'})
  if(trafficType==='campaign')unsubscribeKeys(current)
 }
 authorize();const body=await readSmsBody(event,1024),db=getSupabaseAdminClient(),tx=await db.rpc('sms_channel_state'),mk=await db.rpc('sms_marketing_state')
 const transactionEnabled=on(runtime.smsTransactionalEnabled)&&!tx.error&&tx.data?.transactionalEnabled,marketingEnabled=on(runtime.smsMarketingEnabled)&&!mk.error&&mk.data===true
 const trafficTypes=[...(transactionEnabled?['notification']:[]),...(marketingEnabled?['campaign']:[])]
 if(!trafficTypes.length){setResponseStatus(event,404);return {state:'disabled'}}
 const results={}
 if(transactionEnabled){const authorizeTx=()=>authorize({trafficType:'notification'});await authorizeTx();results.orderEvents=await processOrderSmsEvents(db,{limit:body.limit});results.claimEvents=await processClaimCommunications(db,{channel:'sms',limit:body.limit||1,authorize:authorizeTx});results.transactionalEvents=await processTransactionalSms(db,{limit:body.limit||1,siteOrigin:runtime.public.siteUrl,authorize:authorizeTx})}
 if(marketingEnabled)results.marketingEvents=await processMarketingSms(db,{limit:body.limit||1,authorize})
 return {...await processSmsQueue(db,{limit:body.limit,authorize,trafficTypes}),...results}
}))
