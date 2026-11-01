import {getRouterParam} from 'h3'
import {requireAdminRequest} from '../../utils/adminRequest'
import {readEmailBody} from '../../utils/email/core'
import {paymentCheckoutRpc} from '../../utils/payments/checkout.js'
export default defineEventHandler(async event=>{
 setHeader(event,'Cache-Control','private, no-store')
 const {adminUser,supabaseAdmin}=await requireAdminRequest(event,{permission:'payments.verify'}),body=await readEmailBody(event,256)
 if(body.confirm!==true||Object.keys(body).length!==1)throw createError({statusCode:400,statusMessage:'Confirm recovery of this verified payment.'})
 return paymentCheckoutRpc(supabaseAdmin,'commerce_admin_recover_funded_checkout',{p_actor:adminUser.id,p_session_id:getRouterParam(event,'id')})
})
