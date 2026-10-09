import { claimHandler,requireClaimActor } from '../../../utils/afterSalesClaims.js'
import { getClaimCommunicationSettings } from '../../../utils/afterSalesCommunications.js'
export default defineEventHandler(claimHandler(async event=>{
 const actor=await requireClaimActor(event,true,'claims.communications.view')
 return getClaimCommunicationSettings(actor.db)
}))
