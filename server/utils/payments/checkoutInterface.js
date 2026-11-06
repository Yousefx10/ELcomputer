import {createError} from 'h3'
import {getPaymobConfig,selectPaymobMethod} from './paymob.js'
import {pixelEnabledFor,paymobExperience} from './methods.js'
import {runPaymentCheckoutRpc as paymentCheckoutRpc} from './checkoutRpc.js'

export async function paymentInterface({db,user,runtime,sessionId,action='open',token=null}){
 if(![true,'true'].includes(runtime.paymentFirstEnabled))throw createError({statusCode:503,statusMessage:'Payment checkout is unavailable.'})
 const context=await paymentCheckoutRpc(db,'commerce_checkout_payment_interface',{p_user_id:user.id,p_session_id:sessionId,p_action:'context'})
 if(!context.integrationId)return {checkout:context.checkout}
 const config=getPaymobConfig(runtime)
 const method=config.methods.find(item=>item.integrationId===Number(context.integrationId)&&['card','apple_pay'].includes(item.method))
 if(!method||context.mode!==config.mode)return {checkout:context.checkout}
 const selected=selectPaymobMethod(config,method.method),experience=paymobExperience(method,pixelEnabledFor(runtime,user.id),user.id)
 if(!experience)throw createError({statusCode:409,statusMessage:'This payment method is unavailable.'})
 const embedded=experience==='embedded'
 if(action==='submit'&&!embedded)throw createError({statusCode:409,statusMessage:'Reload checkout before paying.'})
 const input={p_user_id:user.id,p_session_id:sessionId,p_action:action,p_token:token,p_mode:config.mode,p_integration_id:selected.integrationId}
 const result=await paymentCheckoutRpc(db,'commerce_checkout_payment_interface',input)
 if(!result.allowed)return {allowed:false,checkout:result.checkout}
 if(action==='submit')return {allowed:true,checkout:result.checkout}
 if(action==='hosted')return {allowed:true,checkout:result.checkout}
 const payment={provider:'paymob',mode:config.mode,publicKey:config.publicKey,clientSecret:result.clientSecret,
  interfaceToken:result.token,expiresAt:result.checkout.expiresAt,experience,
  paymentMethods:[selected.pixelMethod],redirectFallback:method.method==='card'&&runtime.paymobRedirectFallbackEnabled!==false&&runtime.paymobRedirectFallbackEnabled!=='false'}
 if(!embedded){
  // Hosted checkout has no server pre-submit hook. Fence it before handing off.
  const handed=await paymentCheckoutRpc(db,'commerce_checkout_payment_interface',{...input,p_action:'hosted',p_token:result.token})
  if(!handed.allowed)return {allowed:false,checkout:handed.checkout}
  return {allowed:true,checkout:handed.checkout,payment:{...payment,interfaceToken:undefined}}
 }
 return {allowed:true,checkout:result.checkout,payment}
}

export async function affectedCheckout(db,user,error){
 if(error?.data?.code!=='payment_first:existing'||!error.data.checkoutId)throw error
 return {allowed:false,created:false,blocked:true,checkout:await paymentCheckoutRpc(db,'commerce_read_payment_checkout',{p_user_id:user.id,p_session_id:error.data.checkoutId})}
}
