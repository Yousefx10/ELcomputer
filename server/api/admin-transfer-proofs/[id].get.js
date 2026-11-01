import {getRouterParam,getQuery} from 'h3'
import {requireAdminRequest} from '../../utils/adminRequest'
import {transferProofBytes} from '../../utils/payments/transfers.js'
export default defineEventHandler(async event=>{setHeader(event,'Cache-Control','private, no-store');const {adminUser,supabaseAdmin}=await requireAdminRequest(event,{permission:'payments.review'});return transferProofBytes(event,{actor:adminUser.id,db:supabaseAdmin,proofId:getRouterParam(event,'id'),admin:true,download:getQuery(event).download==='1'})})
