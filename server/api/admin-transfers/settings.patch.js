import {createError} from 'h3'
import {requireAdminRequest} from '../../utils/adminRequest'
import {readEmailBody} from '../../utils/email/core'
import {paymentCheckoutRpc} from '../../utils/payments/checkout.js'
export default defineEventHandler(async event=>{
 setHeader(event,'Cache-Control','private, no-store');const {adminUser,supabaseAdmin}=await requireAdminRequest(event,{permission:'payments.configure'}),body=await readEmailBody(event,16384)
 if(!Number.isInteger(body.revision)||!body.config||Object.keys(body).some(k=>!['revision','config'].includes(k)))throw createError({statusCode:400,statusMessage:'Invalid transfer settings.'})
 return paymentCheckoutRpc(supabaseAdmin,'commerce_transfer_configure',{p_actor:adminUser.id,p_revision:body.revision,p_config:body.config})
})
