import {requireCustomerRequest} from '../../../utils/customerRequest'
import {paymentCheckoutRpc} from '../../../utils/payments/checkout.js'
export default defineEventHandler(async event=>{
 setHeader(event,'Cache-Control','private, no-store');setHeader(event,'Referrer-Policy','no-referrer')
 const {authUser,supabaseAdmin}=await requireCustomerRequest(event)
 return {items:await paymentCheckoutRpc(supabaseAdmin,'commerce_list_payment_checkouts',{p_user_id:authUser.id})}
})
