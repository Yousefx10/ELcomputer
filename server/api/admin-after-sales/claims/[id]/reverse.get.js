import { getRouterParam } from 'h3'
import { claimHandler, claimRpc, requireClaimActor } from '../../../../utils/afterSalesClaims.js'
import { claimUuid } from '../../../../utils/afterSalesClaimValidation.js'
import { getPdcSettings } from '../../../../utils/pdcShipping.js'
import { pdcReverseReady } from '../../../../utils/pdcReverseLogistics.js'
export default defineEventHandler(claimHandler(async event => {
  const actor = await requireClaimActor(event, true)
  const data = await claimRpc(actor.db, 'shipping_claim_view', { p_actor: actor.id, p_claim: claimUuid(getRouterParam(event, 'id')), p_staff: true })
  return { ...data, provider_ready: pdcReverseReady(await getPdcSettings(actor.db)) }
}))
