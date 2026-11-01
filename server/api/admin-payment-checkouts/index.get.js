import {requireAdminRequest} from '../../utils/adminRequest'
import {paymentCheckoutRpc} from '../../utils/payments/checkout.js'
export default defineEventHandler(async event=>{
 setHeader(event,'Cache-Control','private, no-store')
 const {adminUser,supabaseAdmin}=await requireAdminRequest(event,{permission:'payments.view'})
 return paymentCheckoutRpc(supabaseAdmin,'commerce_payment_checkout_admin',{p_actor:adminUser.id})
})
