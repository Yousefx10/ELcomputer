import { getRouterParam } from 'h3'
import { claimHandler, requireClaimActor, uploadClaimEvidence } from '../../../../../utils/afterSalesClaims.js'
export default defineEventHandler(claimHandler(async event => uploadClaimEvidence(event, await requireClaimActor(event), getRouterParam(event, 'id'))))
