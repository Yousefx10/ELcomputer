import { getRouterParam } from 'h3'
import { claimHandler, claimRpc, requireClaimActor } from '../../../../../utils/afterSalesClaims.js'
import { claimUuid } from '../../../../../utils/afterSalesClaimValidation.js'
export default defineEventHandler(claimHandler(async event => {
  const actor = await requireClaimActor(event)
  return claimRpc(actor.db, 'shipping_claim_view', { p_actor: actor.id, p_claim: claimUuid(getRouterParam(event, 'id')), p_staff: false })
}))
