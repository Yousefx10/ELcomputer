import {createError} from 'h3'
import {requireCustomerRequest} from '../../../../utils/customerRequest'
import {paymentCheckoutRpc} from '../../../../utils/payments/checkout.js'
export default defineEventHandler(async event=>{
 setHeader(event,'Cache-Control','private, no-store');setHeader(event,'Referrer-Policy','no-referrer')
 const {authUser,supabaseAdmin}=await requireCustomerRequest(event),id=getRouterParam(event,'id')
 if(!/^[0-9a-f-]{36}$/i.test(id||''))throw createError({statusCode:404,statusMessage:'Checkout not found.'})
 return {checkout:await paymentCheckoutRpc(supabaseAdmin,'commerce_retire_checkout_presentation',{p_user_id:authUser.id,p_session_id:id})}
})
