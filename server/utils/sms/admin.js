import { createError, setHeader } from 'h3'
import { readPaymentCallbackBody } from '../payments/body.js'

export const readSmsBody = async (event, limit = 1048576) => {
  try {
    const body = JSON.parse(await readPaymentCallbackBody(event, limit, 5000))
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error()
    return body
  } catch (error) {
    throw createError({ statusCode: [413, 408].includes(error.statusCode) ? error.statusCode : 400, statusMessage: 'Invalid SMS request.' })
  }
}
export const smsHandler = handler => async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  try { return await handler(event) } catch (error) {
    if (error.statusCode && error.statusCode < 500) throw error
    const allowed = ['SMS provider is disabled.', 'SMS provider is not ready.', 'SMS settings are unavailable.']
    throw createError({ statusCode: 503, statusMessage: allowed.includes(error.statusMessage) ? error.statusMessage : 'SMS service is unavailable.' })
  }
}
