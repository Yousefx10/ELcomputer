import {createError} from 'h3'
import {requireAdminRequest} from '../../utils/adminRequest'
import {readEmailBody} from '../../utils/email/core'
import {paymentCheckoutRpc} from '../../utils/payments/checkout.js'
export default defineEventHandler(async event=>{
 setHeader(event,'Cache-Control','private, no-store');setHeader(event,'Referrer-Policy','no-referrer')
 const {adminUser,supabaseAdmin}=await requireAdminRequest(event,{permission:'payments.configure'}),body=await readEmailBody(event,2048)
 if(Object.keys(body).some(k=>!['revision','enabled'].includes(k))||!Number.isInteger(body.revision)||body.revision<0||typeof body.enabled!=='boolean')throw createError({statusCode:400,statusMessage:'Check the retry setting.'})
 return paymentCheckoutRpc(supabaseAdmin,'commerce_configure_payment_retry',{p_actor:adminUser.id,p_revision:body.revision,p_enabled:body.enabled})
})
