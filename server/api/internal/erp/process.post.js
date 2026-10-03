import { createError, getHeader, readBody } from 'h3'
import { shippingSecretsMatch } from '../../../utils/shippingSecrets'
import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'
import { processDaftraQueue } from '../../../utils/daftraSync'

export default defineEventHandler(async event => {
  const saved=String(useRuntimeConfig().erpWorkerSecret || '').trim()
  const supplied=String(getHeader(event,'x-erp-worker-secret') || '').trim()
  if(saved.length<32 || !supplied || !shippingSecretsMatch(saved,supplied)) throw createError({statusCode:401,statusMessage:'Invalid worker secret.'})
  const body=await readBody(event)
  return processDaftraQueue(getSupabaseAdminClient(),{limit:body?.limit,inventory:body?.inventory===true})
})
