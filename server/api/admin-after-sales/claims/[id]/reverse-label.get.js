import { getRouterParam, getQuery, send, setHeader } from 'h3'
import { claimHandler, claimRpc, requireClaimActor } from '../../../../utils/afterSalesClaims.js'
import { claimUuid, claimError } from '../../../../utils/afterSalesClaimValidation.js'
import { PDC_LABEL_BUCKET } from '../../../../utils/pdcShipping.js'
export default defineEventHandler(claimHandler(async event => {
  const actor = await requireClaimActor(event, true, 'claims.logistics.view')
  const file = await claimRpc(actor.db, 'shipping_claim_read_label', { p_admin: actor.id, p_claim: claimUuid(getRouterParam(event, 'id')), p_job: claimUuid(getQuery(event).job_id) })
  const { data, error } = await actor.db.storage.from(PDC_LABEL_BUCKET).download(file.path)
  if (error || !data || data.size > 5242880) claimError('notFound', 404)
  const bytes = Buffer.from(await data.arrayBuffer())
  if (bytes.length > 5242880 || bytes.subarray(0, 5).toString() !== '%PDF-') claimError('notFound', 404)
  setHeader(event, 'Content-Type', 'application/pdf'); setHeader(event, 'X-Content-Type-Options', 'nosniff'); setHeader(event, 'Content-Security-Policy', "sandbox; default-src 'none'")
  setHeader(event, 'Content-Disposition', `attachment; filename="PDC-${file.awb}.pdf"`)
  return send(event, bytes)
}))
