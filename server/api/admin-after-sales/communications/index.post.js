import { claimHandler,requireClaimActor,readClaimBody } from '../../../utils/afterSalesClaims.js'
import { validateClaimCommunicationSetting,claimCommunicationRpc } from '../../../utils/afterSalesCommunications.js'
export default defineEventHandler(claimHandler(async event=>{
 const actor=await requireClaimActor(event,true,'claims.communications.manage')
 const input=await validateClaimCommunicationSetting(actor.db,await readClaimBody(event))
 return {setting:await claimCommunicationRpc(actor.db,'after_sales_communication_configure',{p_actor:actor.id,p_input:input})}
}))
