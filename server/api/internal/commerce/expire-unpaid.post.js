import { createError, getHeader, setHeader } from 'h3'
import { timingSafeEqual } from 'node:crypto'
import { getSupabaseAdminClient } from '../../../utils/supabaseAdmin'

export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const expected = Buffer.from(String(useRuntimeConfig(event).commerceWorkerSecret || ''))
  const actual = Buffer.from(String(getHeader(event, 'x-commerce-worker-secret') || ''))
  if (expected.length < 32 || expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid worker secret.' })
  }
  const { data, error } = await getSupabaseAdminClient().rpc('commerce_expire_unpaid_card_orders', { p_limit: 25 })
  if (error) throw createError({ statusCode: 503, statusMessage: 'Order expiry requires review.' })
  return data
})
