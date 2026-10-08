import { getRouterParam } from 'h3'
import { claimHandler, claimRpc, requireClaimActor, readClaimBody } from '../../../../utils/afterSalesClaims.js'
import { claimUuid } from '../../../../utils/afterSalesClaimValidation.js'
import { validateReverseBooking } from '../../../../utils/pdcReverseValidation.js'
import { getPdcSettings } from '../../../../utils/pdcShipping.js'
import { pdcReverseReady } from '../../../../utils/pdcReverseLogistics.js'
export default defineEventHandler(claimHandler(async event => {
  const actor = await requireClaimActor(event, true, 'claims.logistics.create'), body = validateReverseBooking(await readClaimBody(event))
  return claimRpc(actor.db, 'shipping_claim_schedule', { p_admin: actor.id, p_claim: claimUuid(getRouterParam(event, 'id')), p_revision: body.revision, p_key: body.key, p_input: body.input, p_ready: pdcReverseReady(await getPdcSettings(actor.db)) })
}))
