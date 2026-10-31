import {createError,getHeader,setHeader} from 'h3'
import {shippingSecretsMatch} from '../../../utils/shippingSecrets'
import {getSupabaseAdminClient} from '../../../utils/supabaseAdmin'
import {processPdcTracking} from '../../../utils/pdcTrackingPolling'
export default defineEventHandler(async event=>{
 setHeader(event,'Cache-Control','private, no-store')
 const requested=getHeader(event,'x-pdc-tracking-secret')||''
 const authorize=()=>{
  const runtime=useRuntimeConfig(),secret=runtime.pdcTrackingWorkerSecret||''
  if(secret.length<32||requested.length>4096||!shippingSecretsMatch(secret,requested))throw createError({statusCode:401,statusMessage:'Worker authorization required.'})
  if(runtime.pdcTrackingWorkerEnabled!==true)throw createError({statusCode:503,statusMessage:'Tracking worker is disabled.'})
 }
 authorize()
 return processPdcTracking({db:getSupabaseAdminClient(),authorize})
})
