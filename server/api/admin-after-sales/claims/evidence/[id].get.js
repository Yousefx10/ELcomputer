import { getRouterParam } from 'h3'
import { claimHandler, requireClaimActor, downloadClaimEvidence } from '../../../../utils/afterSalesClaims.js'
export default defineEventHandler(claimHandler(async event => downloadClaimEvidence(event, await requireClaimActor(event, true, 'claims.evidence'), getRouterParam(event, 'id'))))
