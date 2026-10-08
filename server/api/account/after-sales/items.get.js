import { getQuery } from 'h3'
import { claimHandler, requireClaimActor, claimRpc } from '../../../utils/afterSalesClaims.js'
import { claimQuery, claimUuid } from '../../../utils/afterSalesClaimValidation.js'
export default defineEventHandler(claimHandler(async event => {
  const actor = await requireClaimActor(event), query = getQuery(event)
  return claimRpc(actor.db, 'after_sales_claim_items', { p_customer: actor.id, p_page: claimQuery(query).p_page, p_order: query.order ? claimUuid(query.order) : null })
}))
