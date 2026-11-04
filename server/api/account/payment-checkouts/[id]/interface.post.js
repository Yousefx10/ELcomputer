import {createError,getRouterParam,readBody,setHeader} from 'h3'
import {requireCustomerRequest} from '../../../../utils/customerRequest'
import {paymentInterface,affectedCheckout} from '../../../../utils/payments/checkoutInterface.js'

export default defineEventHandler(async event=>{
 setHeader(event,'Cache-Control','private, no-store');setHeader(event,'Referrer-Policy','no-referrer')
 const {authUser,supabaseAdmin}=await requireCustomerRequest(event),id=getRouterParam(event,'id'),body=await readBody(event)
 if(!/^[0-9a-f-]{36}$/i.test(id||''))throw createError({statusCode:404,statusMessage:'Checkout not found.'})
 if(!body||body.version!==2||Object.keys(body).some(k=>!['action','token','version'].includes(k))
  ||!['open','submit','hosted'].includes(body.action)
  ||body.action!=='open'&&!/^[0-9a-f-]{36}$/i.test(body.token||''))throw createError({statusCode:400,statusMessage:'Reload checkout before paying.'})
 try{return await paymentInterface({db:supabaseAdmin,user:authUser,runtime:useRuntimeConfig(event),sessionId:id,action:body.action,token:body.token||null})}
 catch(error){return affectedCheckout(supabaseAdmin,authUser,error)}
})
