import { getRouterParam,getQuery } from 'h3'
import { claimHandler,requireClaimActor,claimRpc } from '../../../../utils/afterSalesClaims.js'
import { claimUuid,claimError } from '../../../../utils/afterSalesClaimValidation.js'
export default defineEventHandler(claimHandler(async event=>{
 const actor=await requireClaimActor(event,true,'claims.communications.view'),page=Number(getQuery(event).page||1)
 if(!Number.isInteger(page)||page<1||page>10000)claimError('input')
 return claimRpc(actor.db,'after_sales_communication_history',{p_actor:actor.id,p_claim:claimUuid(getRouterParam(event,'id')),p_page:page})
}))
