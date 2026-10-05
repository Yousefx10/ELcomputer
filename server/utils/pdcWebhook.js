import { assertMethod, createError, getHeader, setHeader } from 'h3'
import { getPdcSettings } from './pdcShipping.js'
import { decryptShippingSecret, shippingSecretsMatch } from './shippingSecrets.js'
import { readPaymentCallbackBody } from './payments/body.js'
import { parsePdcWebhook, persistPdcUpdate } from './pdcTracking.js'

export const handlePdcWebhook = async (event, db) => {
  assertMethod(event, 'POST')
  setHeader(event, 'Cache-Control', 'no-store')
  const requestSecret = getHeader(event, 'x-webhook-secret')
  if (!requestSecret || requestSecret.length > 4096) throw createError({ statusCode: 401, statusMessage: 'Invalid webhook secret.' })
  const signal = AbortSignal.timeout(7500)
  let timer
  const work = async () => {
    const settings = await getPdcSettings(db, signal)
    if (!settings.webhook_secret_encrypted) throw createError({ statusCode: 503, statusMessage: 'Courier webhook is not configured.' })
    if (!shippingSecretsMatch(decryptShippingSecret(settings.webhook_secret_encrypted), requestSecret)) throw createError({ statusCode: 401, statusMessage: 'Invalid webhook secret.' })
    if (!settings.is_enabled) throw createError({ statusCode: 503, statusMessage: 'Courier tracking is disabled.' })
    if (!/^application\/json(?:\s*;|$)/i.test(getHeader(event, 'content-type') || '')) throw createError({ statusCode: 415, statusMessage: 'JSON is required.' })
    const raw = await readPaymentCallbackBody(event, 8192, 2000)
    let body
    try { body = JSON.parse(raw) } catch { throw createError({ statusCode: 400, statusMessage: 'Invalid courier update.' }) }
    return persistPdcUpdate(db, parsePdcWebhook(body, settings.status_timezone), signal)
  }
  try {
    return await Promise.race([work(), new Promise((_, reject) => {
      timer = setTimeout(() => reject(createError({ statusCode: 503, statusMessage: 'Courier update timed out.' })), 7500)
      timer.unref?.()
    })])
  } finally { clearTimeout(timer) }
}
