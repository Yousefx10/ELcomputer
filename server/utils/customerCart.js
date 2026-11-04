import {createError, readBody, setHeader} from 'h3'
import {requireCustomerRequest} from './customerRequest'

export async function customerCart(event, mutate = false) {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const {authUser, supabaseAdmin} = await requireCustomerRequest(event)
  const body = mutate ? await readBody(event) : null
  if (mutate && body && Object.keys(body).length === 1 && /^[0-9a-f-]{36}$/i.test(body.purchase_session_id || '')) {
    const {data,error} = await supabaseAdmin.rpc('commerce_complete_customer_cart', {p_user_id:authUser.id,p_session_id:body.purchase_session_id})
    if (error) throw createError({statusCode:409,statusMessage:'Your saved cart could not be updated.'})
    return data
  }
  if (mutate && (!body || JSON.stringify(body).length > 32768
    || Object.keys(body).some(key => !['command_id','expected_version','body'].includes(key))
    || !/^[0-9a-f-]{36}$/i.test(body.command_id || '') || !Number.isSafeInteger(body.expected_version))) {
    throw createError({statusCode:400,statusMessage:'Refresh your cart.'})
  }
  const {data, error} = await supabaseAdmin.rpc('commerce_customer_cart', {
    p_user_id: authUser.id, p_command_id: body?.command_id || null,
    p_expected_version: body?.expected_version ?? null, p_body: body?.body || null
  })
  if (error) {
    const messages = {'cart:unavailable':'Some items are unavailable. Review your cart.',
      'cart:mixed':'Place preorders and ready-to-ship products in separate orders.',
      'cart:limit':'Your cart has too many items.'}
    const code = Object.keys(messages).find(key => error.message?.includes(key))
    throw createError({statusCode:code ? 409 : 503,statusMessage:code ? messages[code] : 'Your saved cart is unavailable.'})
  }
  return data
}
