import { createError, getHeader, readBody } from 'h3'
import { shippingSecretsMatch } from '../../../utils/shippingSecrets'
import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'
import { processDaftraQueue } from '../../../utils/daftraSync'
import { processAutoCourier } from '../../../utils/orderFlow'

// The per-minute order worker: automatic courier booking (Settings → Order flow), then the
// Daftra order queue. A courier problem never blocks Daftra bills.
export default defineEventHandler(async event => {
  const saved=String(useRuntimeConfig().erpWorkerSecret || '').trim()
  const supplied=String(getHeader(event,'x-erp-worker-secret') || '').trim()
  if(saved.length<32 || !supplied || !shippingSecretsMatch(saved,supplied)) throw createError({statusCode:401,statusMessage:'Invalid worker secret.'})
  const body=await readBody(event)
  const db=getSupabaseAdminClient()
  let courier
  if (body?.inventory!==true) {
    try { courier=await processAutoCourier({db}) } catch { courier={active:true,error:'Order flow is unavailable.'} }
  }
  const result=await processDaftraQueue(db,{limit:body?.limit,inventory:body?.inventory===true})
  return courier ? {...result,courier} : result
})
