import {createError} from 'h3'
import {getPdcSettings,validatePdcBaseUrl} from './pdcShipping.js'
import {readPdcShipmentUpdate} from './pdcLookups.js'
import {persistPdcUpdate} from './pdcTracking.js'
export const defaultTrackingPolicy=Object.freeze({enabled:false,interval_seconds:900,max_requests_minute:2,max_requests_hour:20,max_requests_day:100,batch_size:3,concurrency:1,max_failures:8,max_age_days:90,stale_seconds:3600})
const limits={interval_seconds:[300,86400],max_requests_minute:[1,5],max_requests_hour:[1,60],max_requests_day:[1,500],batch_size:[1,5],concurrency:[1,2],max_failures:[1,8],max_age_days:[7,180],stale_seconds:[600,172800]}
const disabled=()=>createError({statusCode:503,statusMessage:'Tracking calls are disabled.',data:{code:'TRACKING_DISABLED'}})
export const trackingPolicy=(value=defaultTrackingPolicy)=>{
 if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.enabled!=='boolean'||Object.keys(value).some(k=>!(k in defaultTrackingPolicy)))throw disabled()
 const result={...defaultTrackingPolicy,...value}
 for(const[k,[min,max]]of Object.entries(limits))if(!Number.isInteger(result[k])||result[k]<min||result[k]>max)throw disabled()
 return result
}
export const requireTrackingAccess=(settings,runtime=useRuntimeConfig())=>{
 const policy=trackingPolicy(settings.tracking_policy)
 if(runtime.pdcTrackingRequestsEnabled!==true||!policy.enabled||!settings.is_enabled||settings.api_mode!=='production')throw disabled()
 validatePdcBaseUrl(settings.base_url,settings.api_mode)
 if(!settings.access_token_encrypted||!/^\d{1,40}$/.test(settings.company_id||''))throw disabled()
 return policy
}
const rpc=async(db,name,args)=>{
 const{data,error}=await db.rpc(name,args).abortSignal(AbortSignal.timeout(4000))
 if(error)throw createError({statusCode:503,statusMessage:'Tracking state is unavailable.'})
 return data
}
const sameProvider=(settings,claim)=>['base_url','api_mode','company_id'].every(k=>settings[k]===claim.provider_identity?.[k])
const errorCode=error=>error?.data?.code==='TRACKING_DISABLED'?'TRACKING_DISABLED':error?.statusCode===409?'IDENTITY_MISMATCH':error?.statusCode===400?'INVALID_STATUS':error?.statusCode===503?'PERSISTENCE_UNCERTAIN':'PROVIDER_UNAVAILABLE'
// Provider reads only. A request token and quota are committed before any external call.
// No booking/label/reverse queue utility is imported or called here.
export const processPdcTracking=async({db,orderId=null,authorize=async()=>{},runtime=useRuntimeConfig(),fetcher=fetch,now=Date.now})=>{
 await authorize()
 const initial=await getPdcSettings(db),policy=requireTrackingAccess(initial,runtime),started=now()
 let reserved=0,checked=0,failed=0,stopped=false,emptyReason=null
 const max=orderId?1:policy.batch_size
 const run=async()=>{
  while(!stopped&&reserved<max&&now()-started<20000){
   // Increment synchronously before awaiting so concurrent slots cannot exceed this batch.
   reserved++
   await authorize()
   const settings=await getPdcSettings(db);requireTrackingAccess(settings,runtime)
   const claim=await rpc(db,'shipping_claim_pdc_tracking',{p_order_id:orderId})
   if(!claim||claim.error){emptyReason=claim?.error||'empty';stopped=true;return}
   const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
   if(![claim.job_id,claim.order_id,claim.token].every(x=>typeof x==='string'&&uuid.test(x))||!(/^[A-Za-z0-9][A-Za-z0-9-]{0,99}$/).test(claim.awb)||typeof claim.ref!=='string'||!claim.ref||claim.ref.length>200)throw createError({statusCode:503,statusMessage:'Tracking claim requires review.'})
   let success=false,code='PROVIDER_UNAVAILABLE'
   try{
    await authorize()
    const current=await getPdcSettings(db);requireTrackingAccess(current,runtime)
    if(!sameProvider(current,claim))throw disabled()
    const update=await readPdcShipmentUpdate(db,current,claim.order_id,claim,fetcher)
    await authorize()
    // A disabled/changed account cannot publish a late response as current evidence.
    const latest=await getPdcSettings(db);requireTrackingAccess(latest,runtime)
    if(!sameProvider(latest,claim))throw disabled()
    await persistPdcUpdate(db,update);success=true;checked++
   }catch(error){code=errorCode(error);failed++}
   const finish=await rpc(db,'shipping_finish_pdc_tracking',{p_job:claim.job_id,p_token:claim.token,p_success:success,p_error:success?null:code})
   if(finish?.error||finish?.finished!==true){stopped=true;throw createError({statusCode:503,statusMessage:'Tracking outcome requires review.'})}
   if(orderId)return
  }
 }
 const settled=await Promise.allSettled(Array.from({length:orderId?1:policy.concurrency},run))
 const rejected=settled.find(x=>x.status==='rejected');if(rejected)throw rejected.reason
 if(orderId&&checked===0){
  if(failed)throw createError({statusCode:502,statusMessage:'The courier update is unavailable.'})
  throw createError({statusCode:emptyReason==='disabled'?503:429,statusMessage:'Tracking is not due or available yet.'})
 }
 return {checked,failed,empty:checked===0&&failed===0,provider_writes:0}
}
export const readTrackingMetadata=async(db,orderId)=>rpc(db,'shipping_pdc_tracking_metadata',{p_order_id:orderId})
