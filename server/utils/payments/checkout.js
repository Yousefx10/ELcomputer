import {createError} from 'h3'
import {normalizeCheckoutCommand,throwCheckoutError} from '../checkoutCommand'
import {authorizeNormalCheckout} from '../normalPurchase.js'
import {getPaymobConfig,selectPaymobMethod,buildIntentionRequest,createPaymobIntention} from './paymob.js'
import {pixelEnabledFor} from './methods.js'

export const paymentFirstEnabled=runtime=>runtime.paymentFirstEnabled===true||runtime.paymentFirstEnabled==='true'
export const paymentCheckoutRpc=async(db,name,input)=>{
 const {data,error}=await db.rpc(name,input)
 if(error){
  if(error.code==='40001')throw createError({statusCode:409,statusMessage:'Payment details changed. Refresh first.'})
  if(String(error.message).includes('payment_first:existing'))throw createError({statusCode:409,statusMessage:'Payment is still being checked.',data:{code:'payment_first:existing'}})
  throwCheckoutError(error)
 }
 return data
}
export async function createPaymentCheckout({body,user,db,runtime,fetcher=fetch}){
 if(!paymentFirstEnabled(runtime))throw createError({statusCode:503,statusMessage:'Payment checkout is unavailable.'})
 const {cart_revision,cart_lines=[],paymob_method='card',...command}=body||{}
 if (!['card','apple_pay'].includes(paymob_method)) throw createError({statusCode:400,statusMessage:'This payment method is unavailable.'})
 if(!cart_revision||!Array.isArray(cart_lines)||!cart_lines.length)throw createError({statusCode:409,statusMessage:'Reload checkout before paying.',data:{code:'payment_first:refresh'}})
 if(!Array.isArray(cart_lines)||cart_lines.length>100||cart_lines.some(x=>!x||Object.keys(x).some(k=>!['cart_key','cart_line_id','quantity'].includes(k))||typeof x.cart_key!=='string'||x.cart_key.length>80||!/^[-0-9a-f]{36}$/i.test(x.cart_line_id||'')||!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>99))throw createError({statusCode:400,statusMessage:'Refresh your cart.'})
 if(cart_revision!==undefined&&(!/^[0-9a-f-]{36}$/i.test(cart_revision)||cart_revision.length!==36))throw createError({statusCode:400,statusMessage:'Refresh your cart.'})
 const {cartId,order,items}=normalizeCheckoutCommand(command,user)
 const quoteId=String(command.quote_id||'')
 if(!/^[0-9a-f-]{36}$/i.test(quoteId)||order.payment_method!=='card')throw createError({statusCode:409,statusMessage:'Review payment checkout.'})
 const context=authorizeNormalCheckout({runtime,user,cartId,order,items,commit:true,quoteId,signature:body.review_token})
 if(context.scope)throw createError({statusCode:403,statusMessage:'This checkout is unavailable.'})
 const embedded=pixelEnabledFor(runtime,user.id)
 if(paymob_method==='apple_pay'&&!embedded)throw createError({statusCode:409,statusMessage:'This payment method is unavailable.'})
 const config=selectPaymobMethod(getPaymobConfig(context.runtime),paymob_method)
 let prepared
 try{prepared=await paymentCheckoutRpc(db,'commerce_prepare_payment_checkout',{p_user_id:user.id,p_cart_id:context.cartId,p_quote_id:quoteId,p_order:order,p_items:items,p_cart_revision:cart_revision||null,p_cart_lines:cart_lines})}
 catch(error){
  if(error?.data?.code!=='payment_first:existing')throw error
  const sessions=await paymentCheckoutRpc(db,'commerce_list_payment_checkouts',{p_user_id:user.id})
  const existing=sessions.find(session=>!['paid','retired'].includes(session.state))
  if(!existing)throw error
  return {checkout:existing,created:false}
 }
 if(!prepared.created)return {checkout:prepared.checkout,created:false}
 const claimed=await paymentCheckoutRpc(db,'commerce_claim_checkout_payment',{p_user_id:user.id,p_session_id:prepared.checkout.id,p_mode:config.mode,p_integration_id:config.integrationId})
 if(!claimed.created)return {checkout:prepared.checkout,created:false}
 try{
  const snapshot=claimed.snapshot,attempt=claimed.attempt
  const payable={...snapshot.order,id:prepared.checkout.id,order_number:claimed.reference,total_amount:String(snapshot.review.totalAmount),currency:'EGP'}
  const payload=buildIntentionRequest(config,payable,attempt,order.locale)
  const redirect=new URL(payload.redirection_url);redirect.searchParams.delete('order_id');redirect.searchParams.set('checkout_id',prepared.checkout.id);payload.redirection_url=redirect.href
  const result=await createPaymobIntention(config,payload,fetcher)
  const committed=await paymentCheckoutRpc(db,'commerce_store_checkout_intention',{p_attempt_id:attempt.id,p_intention_id:result.intentionId,p_provider_order_id:result.providerOrderId,p_client_secret:result.clientSecret})
  const checkout=await paymentCheckoutRpc(db,'commerce_read_payment_checkout',{p_user_id:user.id,p_session_id:prepared.checkout.id})
  if(committed?.order_id||checkout.orderId)return {checkout,created:true}
  return {checkout,created:true,payment:{provider:'paymob',mode:config.mode,publicKey:config.publicKey,clientSecret:result.clientSecret,expiresAt:checkout.expiresAt,experience:embedded?'embedded':'redirect',paymentMethods:[config.pixelMethod],redirectFallback:paymob_method==='card'&&runtime.paymobRedirectFallbackEnabled!==false&&runtime.paymobRedirectFallbackEnabled!=='false'}}
 }catch{
  await paymentCheckoutRpc(db,'commerce_checkout_payment_uncertain',{p_attempt_id:claimed.attempt.id})
  return {checkout:await paymentCheckoutRpc(db,'commerce_read_payment_checkout',{p_user_id:user.id,p_session_id:prepared.checkout.id}),created:true}
 }
}
