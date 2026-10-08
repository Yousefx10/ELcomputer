import { createError, setHeader } from 'h3'
import { readPaymentCallbackBody } from '../payments/body.js'
export const emailFail = (message, statusCode = 400) => { throw createError({ statusCode, statusMessage: message }) }
export const emailRpc = async (db, action, input = {}, actor = null) => {
 const { data, error } = await db.rpc('email_command',{ p_action: action, p_input: input, p_actor: actor })
 if (error) {
  const codes = { '42501':403, '40001':409, '23505':409, '22023':400, '54000':429, '55000':503 }
  const messages = { '42501':'Email permission denied.', '40001':'Email settings changed. Reload before saving.', '23505':'This email request was already used with different content.', '22023':'Email configuration or content is unavailable.', '54000':'Email rate limit reached.', '55000':'Email provider is disabled or unavailable.' }
  emailFail(messages[error.code] || 'Email service is unavailable.',codes[error.code] || 503)
 }
 return data
}
export const readEmailBody = async (event, limit = 65536) => {
 try { const value=JSON.parse(await readPaymentCallbackBody(event,limit,5000)); if(!value || typeof value!=='object' || Array.isArray(value)) throw Error(); return value }
 catch(error){ emailFail('Invalid email request.',[408,413].includes(error.statusCode)?error.statusCode:400) }
}
export const emailHandler = fn => async event => {
 setHeader(event,'Cache-Control','private, no-store'); setHeader(event,'Referrer-Policy','no-referrer'); setHeader(event,'X-Content-Type-Options','nosniff')
 try { return await fn(event) } catch(error) { if(error.statusCode && error.statusCode<500) throw error; emailFail('Email service is unavailable.',503) }
}
export const validateEmail = fn => { try { return fn() } catch(error) { if(error.statusCode) throw error; emailFail(error.message || 'Invalid email input.') } }
