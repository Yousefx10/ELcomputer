import { getRouterParam } from 'h3'
import { claimHandler, requireClaimActor, removeClaimEvidence } from '../../../../utils/afterSalesClaims.js'
export default defineEventHandler(claimHandler(async event => removeClaimEvidence(await requireClaimActor(event), getRouterParam(event, 'id'))))
