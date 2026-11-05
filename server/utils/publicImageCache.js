import {getSupabaseAdminClient} from './supabaseAdmin'
import {normalizePublicImageCache} from '../../app/utils/publicImageCache.js'
let cached=null,refresh=null
const counters={startedAt:new Date().toISOString(),responses:0,revalidated:0,headResponses:0,bodyBytesOffered:0,revalidationBytesAvoided:0}
export function recordPublicImageResponse(status,size,head=false){
  const add=(key,value)=>{counters[key]=Math.min(Number.MAX_SAFE_INTEGER,counters[key]+value)}
  add('responses',1)
  if(head)add('headResponses',1)
  if(status===304){add('revalidated',1);if(!head)add('revalidationBytesAvoided',size)}
  else if(!head)add('bodyBytesOffered',size)
}
export const publicImageCacheDiagnostics=()=>({...counters,scope:'current-process',browserFreshHitsMeasured:false})
export async function publicImageCacheSettings(){
  if(cached&&cached.expires>Date.now())return cached.value
  if(refresh)return refresh
  refresh=(async()=>{
    try{
      let query=getSupabaseAdminClient().from('site_settings').select('public_image_cache').eq('key','default')
      if(typeof query.abortSignal==='function')query=query.abortSignal(AbortSignal.timeout(1000))
      const {data,error}=await query.maybeSingle()
      const value=normalizePublicImageCache(error?null:data?.public_image_cache)
      cached={value,expires:Date.now()+15000};return value
    }catch{
      const value=normalizePublicImageCache(null)
      cached={value,expires:Date.now()+15000};return value
    }

  })()
  try{return await refresh}finally{refresh=null}
}
export function publicImageValidators(stat,config){
  return {etag:`W/"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs*1000).toString(16)}"`,modified:stat.mtime.toUTCString(),
    cache:config.enabled?`public, max-age=${config.maxAge}, must-revalidate`:'no-store'}
}
export function imageNotModified(header,etag){
  return typeof header==='string'&&header.split(',').map(value=>value.trim().replace(/^W\//,'')).some(value=>value==='*'||value===etag.replace(/^W\//,''))
}
