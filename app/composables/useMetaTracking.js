import {metaBrowserPrivacyAllowed,metaPublicPath} from '~/utils/metaTracking'
import {getStorefrontAudienceAccessToken,getStorefrontAudienceStatus,STOREFRONT_AUDIENCE_ELIGIBLE} from './useStorefrontAudience'

const sent=new Set(),pending=new Set()
let sdkPromise,testTimer
export const useMetaTracking=()=>{
 const state=useState('store-meta-tracking',()=>({enabled:false,pixelId:'',revision:0,testExpiresAt:null,choice:null,settingsOpen:false,busy:false,error:false}))
 const allowed=()=>state.value.enabled&&(!state.value.testExpiresAt||Date.parse(state.value.testExpiresAt)>Date.now())&&state.value.choice==='granted'&&metaBrowserPrivacyAllowed()&&getStorefrontAudienceStatus()===STOREFRONT_AUDIENCE_ELIGIBLE
 const safeLocation=()=>!!metaPublicPath(window.location.pathname)&&!window.location.search&&!window.location.hash
 const headers=()=>{const token=getStorefrontAudienceAccessToken();return token?{authorization:'Bearer '+token}:{}}
 const loadPixel=async()=>{
  if(!allowed())return false
  if(!sdkPromise){sdkPromise=new Promise(resolve=>{
   const timeout=setTimeout(()=>resolve(false),10000)
   const q=function(...args){q.callMethod?q.callMethod(...args):q.queue.push(args)};q.queue=[];q.loaded=true;q.version='2.0';q.push=q;window.fbq=q;window._fbq=q
   q('consent','grant');q('set','autoConfig',false,state.value.pixelId);q('init',state.value.pixelId)
   const script=document.createElement('script');script.async=true;script.src='https://connect.facebook.net/en_US/fbevents.js';script.referrerPolicy='no-referrer';script.onload=()=>{clearTimeout(timeout);resolve(true)};script.onerror=()=>{clearTimeout(timeout);resolve(false)};document.head.appendChild(script)
  })}
  return sdkPromise
 }
 const deliver=async (event,authorization)=>{
  if(!safeLocation()||headers().authorization!==authorization||!event||!allowed()||sent.has(event.eventId)||pending.has(event.eventId))return
  pending.add(event.eventId)
  try{
   let already=false
   try{already=sessionStorage.getItem('store-meta:'+event.eventId)==='sent'}catch{}
   if(already){sent.add(event.eventId);return}
   if(!await loadPixel()||!allowed()||!safeLocation()||headers().authorization!==authorization)return
   window.fbq('consent','grant')
   window.fbq(event.eventName==='CODOrderPlaced'?'trackCustom':'track',event.eventName,event.data||{},{eventID:event.eventId})
   sent.add(event.eventId);try{sessionStorage.setItem('store-meta:'+event.eventId,'sent')}catch{}
  }finally{pending.delete(event.eventId)}
 }
 const track=async(eventName,payload={})=>{
  if(!allowed())return
  const path=metaPublicPath(payload.path||window.location.pathname);if(!path)return
  const event={eventName,eventId:/^[a-f0-9-]{36}$/i.test(payload.eventId||'')?payload.eventId:crypto.randomUUID(),path}
  if(payload.productId)event.productId=payload.productId
  if(payload.variantId)event.variantId=payload.variantId
  if(payload.cartId)event.cartId=payload.cartId
  if(payload.quantity!==undefined)event.quantity=payload.quantity
  try{const requestHeaders=headers(),r=await $fetch('/api/marketing/events',{method:'POST',headers:requestHeaders,body:event,retry:0});await deliver(r.event,requestHeaders.authorization)}catch{/* Optional tracking never interrupts shopping. */}
 }
 const purchase=async orderId=>{
  if(!allowed()||!safeLocation()||!/^[a-f0-9-]{36}$/i.test(orderId||''))return
  try{const requestHeaders=headers(),r=await $fetch('/api/marketing/purchase',{method:'POST',headers:requestHeaders,body:{orderId},retry:0});await deliver(r.event,requestHeaders.authorization)}catch{}
 }
 const choose=async granted=>{
  if(state.value.busy)return
  state.value.busy=true;state.value.error=false
  try{
   const result=await $fetch('/api/marketing/consent',{method:'POST',headers:headers(),body:{granted:granted&&metaBrowserPrivacyAllowed()},retry:0})
   state.value.choice=result.granted?'granted':'denied';state.value.settingsOpen=false
   try{localStorage.setItem('store-marketing-choice',JSON.stringify({choice:state.value.choice,revision:state.value.revision,expires:Date.now()+180*86400000}))}catch{}
   if(!result.granted){sent.clear();window.fbq?.('consent','revoke');for(const name of ['_fbp','_fbc'])document.cookie=name+'=; Max-Age=0; Path=/; SameSite=Lax'}
   else await track('PageView')
  }catch{state.value.error=true}finally{state.value.busy=false}
 }
 const initialize=async()=>{
  if(!import.meta.client||!metaBrowserPrivacyAllowed())return
  try{
   const requestHeaders=headers(),config=await $fetch('/api/marketing/config',{headers:requestHeaders,retry:0});if(headers().authorization!==requestHeaders.authorization)return;Object.assign(state.value,config)
   clearTimeout(testTimer);if(!config.enabled){window.fbq?.('consent','revoke');return}
   if(config.testExpiresAt)testTimer=setTimeout(()=>{state.value.enabled=false;window.fbq?.('consent','revoke')},Math.max(0,Date.parse(config.testExpiresAt)-Date.now()))
   let saved;try{saved=JSON.parse(localStorage.getItem('store-marketing-choice')||'null')}catch{}
   if(saved?.revision===config.revision&&saved.expires>Date.now()){state.value.choice=saved.choice;return}
   state.value.choice=null
  }catch{state.value.enabled=false}
 }
 return {state,initialize,choose,track,purchase,allowed}
}
