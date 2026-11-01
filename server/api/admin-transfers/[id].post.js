import {getRouterParam} from 'h3'
import {requireAdminRequest} from '../../utils/adminRequest'
import {readEmailBody} from '../../utils/email/core'
import {reviewTransfer} from '../../utils/payments/transfers.js'
export default defineEventHandler(async event=>{setHeader(event,'Cache-Control','private, no-store');const body=await readEmailBody(event,16384);const {adminUser,supabaseAdmin}=await requireAdminRequest(event,{permission:body.action==='verify'?'payments.verify':'payments.review'});return reviewTransfer({db:supabaseAdmin,actor:adminUser.id,sessionId:getRouterParam(event,'id'),body})})
