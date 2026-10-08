import { getRouterParam } from 'h3'
import { claimHandler, requireClaimActor, claimRpc, readClaimBody } from '../../../../utils/afterSalesClaims.js'
import { claimUuid, validateClaimForm } from '../../../../utils/afterSalesClaimValidation.js'
export default defineEventHandler(claimHandler(async event => {
  const actor = await requireClaimActor(event), input = validateClaimForm(await readClaimBody(event), true)
  return claimRpc(actor.db, 'after_sales_claim_preview', { p_customer: actor.id, p_item: claimUuid(getRouterParam(event, 'id')), p_type: input.claim_type, p_input: input })
}))
