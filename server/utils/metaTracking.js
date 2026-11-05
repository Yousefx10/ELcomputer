import {metaPublicPath} from '~/utils/metaTracking'
import {createHash,randomBytes} from 'node:crypto'
import {createError,getCookie,setCookie,getHeader,getRequestURL,setHeader} from 'h3'
import {getSupabaseAdminClient} from './supabaseAdmin'
import {getOptionalStoreAnalyticsUserId} from './storeAnalytics'
import {assertStoreAnalyticsRateLimit} from './storeAnalyticsRateLimit'
import {decryptCredentialSecret} from './credentialSecrets'

export const metaEnabled=runtime=>[true,'true'].includes(runtime.metaTrackingEnabled)
export const metaPrivacyAllowed=event=>!['1','yes'].includes(String(getHeader(event,'dnt')||'').toLowerCase())&&getHeader(event,'sec-gpc')!=='1'
export const metaHeaders=event=>{setHeader(event,'Cache-Control','private, no-store');setHeader(event,'Referrer-Policy','no-referrer');setHeader(event,'X-Content-Type-Options','nosniff')}
export const metaHash=value=>createHash('sha256').update(value).digest('hex')
export const metaConsentHash=event=>{const value=getCookie(event,'store-marketing-consent')||'';return /^[a-f0-9]{64}$/.test(value)?metaHash(value):''}
export const metaSameOrigin=event=>{
 const origin=getHeader(event,'origin'),site=new URL(useRuntimeConfig(event).public.siteUrl).origin
 if(origin!==site)throw createError({statusCode:403,statusMessage:'This request is unavailable.'})
}
export async function metaRpc(db,name,input={}){
 const {data,error}=await db.rpc(name,input)
 if(error)throw createError({statusCode:error.code==='42501'?403:error.code==='P0001'&&error.message==='Tracking settings changed.'?409:400,statusMessage:'Tracking request could not be completed.'})
 return data
}
export async function metaIdentity(event,db){
 const user=await getOptionalStoreAnalyticsUserId(event,db)
 if(user){const internal=await db.rpc('store_analytics_is_internal_user',{p_user_id:user});if(internal.error||internal.data!==false)return {allowed:false,user:null}}
 const scope=await metaRpc(db,'commerce_meta_settings',{p_customer:user});if(scope?.testMode&&(!scope.enabled||Number(useRuntimeConfig(event).metaTestRevision)!==Number(scope.revision)))return {allowed:false,user}
 return {allowed:metaPrivacyAllowed(event),user}
}
export async function captureMetaBrowserContext(event,db){
 const hash=metaConsentHash(event);if(!hash||!metaPrivacyAllowed(event))return
 const valid=value=>/^fb\.[0-9]\.[0-9]{10,13}\.[A-Za-z0-9._-]{1,200}$/.test(value||'')?value:null
 try{await metaRpc(db,'commerce_meta_context',{p_hash:hash,p_fbp:valid(getCookie(event,'_fbp')),p_fbc:valid(getCookie(event,'_fbc'))})}catch{}
}
export async function saveMetaConsent(event,granted){
 metaSameOrigin(event);assertStoreAnalyticsRateLimit(event,{scope:'marketing-consent',limit:30})
 const runtime=useRuntimeConfig(event);if(!metaEnabled(runtime))return {granted:false}
 const db=getSupabaseAdminClient(),identity=await metaIdentity(event,db)
 const previous=getCookie(event,'store-marketing-consent')
 if(granted&&/^[a-f0-9]{64}$/.test(previous||''))await metaRpc(db,'commerce_meta_consent',{p_hash:metaHash(previous),p_granted:false,p_agent:''})
 const token=!granted&&/^[a-f0-9]{64}$/.test(previous||'')?previous:randomBytes(32).toString('hex')
 const result=await metaRpc(db,'commerce_meta_consent',{p_hash:metaHash(token),p_granted:granted&&identity.allowed,p_user:identity.user,p_agent:String(getHeader(event,'user-agent')||'').slice(0,512)})
 setCookie(event,'store-marketing-consent',token,{httpOnly:true,secure:new URL(runtime.public.siteUrl).protocol==='https:',sameSite:'strict',path:'/',maxAge:180*86400})
 return result
}
export async function bindMetaCheckout(event,user,body,db,runtime){
 // Tracking cannot change the purchase outcome. The binding precedes any provider POST.
 if(!metaEnabled(runtime)||!metaConsentHash(event))return
 if(!metaPrivacyAllowed(event)){try{await metaRpc(db,'commerce_meta_consent',{p_hash:metaConsentHash(event),p_granted:false,p_agent:''})}catch{};return}
 if(!/^[a-f0-9-]{36}$/i.test(body?.cart_id||''))return
 await captureMetaBrowserContext(event,db)
 try{await metaRpc(db,'commerce_meta_bind_checkout',{p_user:user.id,p_cart:body.cart_id,p_hash:metaConsentHash(event)})}catch{/* Fail closed for tracking; preserve commerce. */}
}
export async function recordMetaEvent(event,body){
 metaSameOrigin(event);assertStoreAnalyticsRateLimit(event,{scope:'marketing-events',limit:120})
 if(!metaEnabled(useRuntimeConfig(event))||!metaPrivacyAllowed(event)||!metaConsentHash(event))return {event:null}
 const db=getSupabaseAdminClient(),identity=await metaIdentity(event,db)
 if(!identity.allowed)return {event:null}
 await captureMetaBrowserContext(event,db)
 const path=metaPublicPath(body.path);if(!path)throw createError({statusCode:400,statusMessage:'Tracking event unavailable.'})
 return {event:await metaRpc(db,'commerce_meta_event',{p_hash:metaConsentHash(event),p_user:identity.user,p_event:{...body,path}})}
}
export function metaEventPayload(context,origin){
 const base=new URL(origin);if(base.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(base.hostname))throw Error('Invalid tracking origin')
 const {source_path,...event}=context.event
 if(!String(source_path).startsWith('/')||String(source_path).startsWith('//'))throw Error('Invalid source path')
 const url=new URL(source_path,base);url.search='';url.hash=''
 return {data:[{...event,event_source_url:url.href}],...(context.testEventCode?{test_event_code:context.testEventCode}:{})}
}
export async function dispatchMetaEvent({db,runtime,fetcher=fetch,decrypt=decryptCredentialSecret}){
 if(!metaEnabled(runtime)||![true,'true'].includes(runtime.metaDispatchEnabled))return {state:'disabled'}
 const claim=await metaRpc(db,'commerce_meta_claim');if(!claim)return {state:'empty'}
 let outcome='uncertain'
 try{
  const context=await metaRpc(db,'commerce_meta_dispatch',{p_id:claim.id,p_lease:claim.lease})
  if(!context)return {state:'held'}
  if(context.testEventCode&&(Number(runtime.metaTestRevision)!==Number(context.revision)||['Purchase','CODOrderPlaced'].includes(context.event?.event_name))){await metaRpc(db,'commerce_meta_finish',{p_id:claim.id,p_lease:claim.lease,p_outcome:'rejected'});return {state:'held'}}
  if(!/^[0-9]{5,30}$/.test(context.pixelId)||!/^v[0-9]{2,3}\.0$/.test(context.graphVersion))throw Error('Invalid tracking configuration')
  const payload=metaEventPayload(context,runtime.public.siteUrl),token=decrypt(context.tokenEncrypted,'Meta Conversions API')
  const response=await fetcher(`https://graph.facebook.com/${context.graphVersion}/${context.pixelId}/events`,{method:'POST',redirect:'error',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)})
  // No provider payload, token, URL query or user data enters logs or diagnostics.
  if(response.status===429||response.status>=500)outcome='transient'
  else if(!response.ok)outcome='rejected'
  else{const text=await response.text();if(text.length>65536)throw Error('Invalid acknowledgement');const result=JSON.parse(text);outcome=result.events_received===1?'accepted':'uncertain'}
 }catch{/* Lost acknowledgements retry only the same durable event ID. */}
 await metaRpc(db,'commerce_meta_finish',{p_id:claim.id,p_lease:claim.lease,p_outcome:outcome})
 return {state:outcome}
}

// Only the existing authenticated server quote can supply checkout conversion values.
export async function captureMetaQuote(event,db,user,cart,review){
 try{
  if(!metaEnabled(useRuntimeConfig(event))||!metaPrivacyAllowed(event)||!metaConsentHash(event)||!Array.isArray(review?.lines))return
  const contents=review.lines.map(row=>({id:row.variantId||row.productId,quantity:Number(row.quantity),item_price:Number(row.total)/Number(row.quantity)}))
  if(!contents.length||contents.length>100||contents.some(row=>!row.id||!Number.isInteger(row.quantity)||row.quantity<1||!Number.isFinite(row.item_price)))return
  const data={currency:'EGP',value:Number(review.totalAmount),content_type:'product',content_ids:contents.map(row=>row.id),contents,num_items:contents.reduce((sum,row)=>sum+row.quantity,0)}
  await metaRpc(db,'commerce_meta_quote',{p_user:user,p_cart:cart,p_hash:metaConsentHash(event),p_data:data,p_expires:review.expiresAt})
 }catch{/* Marketing never changes or blocks a quote. */}
}
