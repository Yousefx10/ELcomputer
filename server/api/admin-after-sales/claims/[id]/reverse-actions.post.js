import { getRouterParam } from 'h3'
import { claimHandler, requireClaimActor, readClaimBody } from '../../../../utils/afterSalesClaims.js'
import { claimUuid } from '../../../../utils/afterSalesClaimValidation.js'
import { validateReverseOperation } from '../../../../utils/pdcReverseValidation.js'
import { operatePdcReverse } from '../../../../utils/pdcReverseLogistics.js'
export default defineEventHandler(claimHandler(async event => {
  const operation = validateReverseOperation(await readClaimBody(event))
  const actor = await requireClaimActor(event, true, operation.action === 'label' ? 'claims.logistics.create' : 'claims.logistics.retry')
  return operatePdcReverse(actor, claimUuid(getRouterParam(event, 'id')), operation)
}))
