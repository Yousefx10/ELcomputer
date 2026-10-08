import { getRouterParam } from 'h3'
import { claimHandler, requireClaimActor, requireClaimActionPermission, claimRpc, readClaimBody } from '../../../../utils/afterSalesClaims.js'
import { claimUuid, validateClaimAction } from '../../../../utils/afterSalesClaimValidation.js'
export default defineEventHandler(claimHandler(async event => {
  const actor = await requireClaimActor(event, true), action = validateClaimAction(await readClaimBody(event), true)
  requireClaimActionPermission(actor, action.action)
  return claimRpc(actor.db, 'after_sales_claim_staff_action', { p_admin: actor.id, p_claim: claimUuid(getRouterParam(event, 'id')), p_revision: action.revision, p_action: action.action, p_input: action.input })
}))
