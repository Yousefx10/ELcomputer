import { claimHandler, requireClaimActor, claimRpc, readClaimBody } from '../../../../utils/afterSalesClaims.js'
import { validateClaimForm } from '../../../../utils/afterSalesClaimValidation.js'
export default defineEventHandler(claimHandler(async event => {
  const actor = await requireClaimActor(event), input = validateClaimForm(await readClaimBody(event))
  return claimRpc(actor.db, 'after_sales_claim_create', { p_customer: actor.id, p_input: input })
}))
