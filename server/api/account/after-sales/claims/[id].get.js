import { getQuery, getRouterParam } from 'h3'
import { claimHandler, requireClaimActor, claimRpc } from '../../../../utils/afterSalesClaims.js'
import { claimUuid } from '../../../../utils/afterSalesClaimValidation.js'
export default defineEventHandler(claimHandler(async event => {
  const actor = await requireClaimActor(event), query = getQuery(event)
  return claimRpc(actor.db, 'after_sales_claim_detail', { p_actor: actor.id, p_claim: claimUuid(getRouterParam(event, 'id')), p_staff: false, p_before: query.before ? claimUuid(query.before) : null })
}))
