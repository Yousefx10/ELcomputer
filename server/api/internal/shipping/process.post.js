import { createError, getHeader } from 'h3'
import { processPdcShippingQueue } from '../../../utils/pdcShipping'
import { shippingSecretsMatch } from '../../../utils/shippingSecrets'
import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig()
  const savedWorkerSecret = String(runtimeConfig.shippingWorkerSecret || '').trim()
  const requestWorkerSecret = String(getHeader(event, 'x-shipping-worker-secret') || '').trim()

  if (
    savedWorkerSecret.length < 32
    || !requestWorkerSecret
    || !shippingSecretsMatch(savedWorkerSecret, requestWorkerSecret)
  ) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid worker secret.'
    })
  }

  const body = await readBody(event)

  return await processPdcShippingQueue({
    supabaseAdmin: getSupabaseAdminClient(),
    limit: body?.limit
  })
})
