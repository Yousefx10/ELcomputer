import { getQuery, getRouterParam } from 'h3'
import { claimHandler, requireClaimActor, claimRpc } from '../../../../../utils/afterSalesClaims.js'
import { claimUuid, claimQuery, claimError } from '../../../../../utils/afterSalesClaimValidation.js'
export default defineEventHandler(claimHandler(async event => {
  const actor = await requireClaimActor(event), query = getQuery(event)
  if (!query.type) claimError('input')
  return claimRpc(actor.db, 'after_sales_claim_staged_evidence', { p_customer: actor.id, p_item: claimUuid(getRouterParam(event, 'id')), p_type: claimQuery(query).p_type, p_target: query.claim ? claimUuid(query.claim) : null })
}))
