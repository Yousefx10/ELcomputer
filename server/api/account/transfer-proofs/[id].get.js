import {getRouterParam,getQuery,setHeader} from 'h3'
import {requireCustomerRequest} from '../../../utils/customerRequest'
import {transferProofBytes} from '../../../utils/payments/transfers.js'
export default defineEventHandler(async event=>{
 setHeader(event,'Cache-Control','private, no-store')
 const {authUser,supabaseAdmin}=await requireCustomerRequest(event)
 return transferProofBytes(event,{actor:authUser.id,db:supabaseAdmin,proofId:getRouterParam(event,'id'),download:getQuery(event).download==='1'})
})
