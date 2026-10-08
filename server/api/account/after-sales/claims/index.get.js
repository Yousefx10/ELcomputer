import { getQuery } from 'h3'
import { claimHandler, requireClaimActor, claimRpc } from '../../../../utils/afterSalesClaims.js'
import { claimQuery } from '../../../../utils/afterSalesClaimValidation.js'
export default defineEventHandler(claimHandler(async event => {
  const actor = await requireClaimActor(event)
  return claimRpc(actor.db, 'after_sales_claim_list', { p_actor: actor.id, p_staff: false, ...claimQuery(getQuery(event)) })
}))
