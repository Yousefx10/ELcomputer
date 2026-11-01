import {getRouterParam,setHeader} from 'h3'
import {requireCustomerRequest} from '../../../../utils/customerRequest'
import {submitTransferProof} from '../../../../utils/payments/transfers.js'
export default defineEventHandler(async event=>{
 setHeader(event,'Cache-Control','private, no-store')
 const {authUser,supabaseAdmin}=await requireCustomerRequest(event)
 return submitTransferProof(event,{user:authUser,db:supabaseAdmin,sessionId:getRouterParam(event,'id')})
})
