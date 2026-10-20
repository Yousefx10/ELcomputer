import { createError } from 'h3'
import { getPdcSettings, buildPdcShipment, requestPdcJson, requestPdcLabel } from './pdcShipping.js'
import { requirePdcReadAccess, requestPdcLookup, pdcResponseRows } from './pdcLookups.js'
import { verifyReverseResult } from './pdcReverseLogistics.js'
import { getShippingDocumentsRoot, saveShippingDocument } from './privateShippingDocuments.js'
import { decryptShippingSecret, shippingSecretsMatch } from './shippingSecrets.js'

const fields = ['base_url','api_mode','company_id','access_token_encrypted','webhook_secret_encrypted','product_id','origin_city_id','origin_address','origin_phone','origin_contact_name','default_weight_kg','shipment_type_id','label_template_id','allow_open_shipment','all_must_valid','cod_enabled']
const configuration = settings => Object.fromEntries(fields.map(key => [key, key === 'default_weight_kg' ? Number(settings[key]) : settings[key]]))
const rpc = async (db, name, args) => {
  const request = db.rpc(name, args)
  const { data, error } = await (typeof request.abortSignal === 'function' ? request.abortSignal(AbortSignal.timeout(8000)) : request)
  if (error) throw createError({ statusCode: error.code === '42501' ? 403 : error.code === 'P0001' ? 409 : 503, statusMessage: 'Courier action could not complete. Check the saved booking before retrying.' })
  return data
}
const requireReady = async (settings, runtime) => {
  requirePdcReadAccess(settings, runtime)
  if (!settings.webhook_secret_encrypted) throw createError({ statusCode: 503, statusMessage: 'Courier callback configuration is incomplete.' })
  const token = decryptShippingSecret(settings.access_token_encrypted), secret = decryptShippingSecret(settings.webhook_secret_encrypted)
  if (!token || secret.length < 32 || shippingSecretsMatch(token, secret)) throw createError({ statusCode: 503, statusMessage: 'Courier credentials are incomplete.' })
  await getShippingDocumentsRoot({ create: true })
}
export const processPdcOrderJob = async ({ supabaseAdmin: db, settings, jobId, fetcher = fetch, runtime = useRuntimeConfig(), authorize = () => {} }) => {
  await authorize();await requireReady(settings, runtime)
  const job = await rpc(db, 'shipping_order_take', { p_job: jobId, p_ready: true, p_configuration: configuration(settings) })
  if (!job) return { id: jobId, skipped: true }
  const finish = (state, extra = {}) => rpc(db, 'shipping_order_finish', { p_job: job.id, p_token: job.token, p_state: state, ...extra })
  if (job.task === 'book') {
    try {
      await authorize()
      const { data: items, error } = await db.from('customer_order_items').select('product_title,quantity').eq('order_id', job.order.id).order('created_at')
      if (error) throw error
      const shipment = await buildPdcShipment({ settings, order: job.order, items: items || [], orderReference: job.to_ref,
        destinationCityId: job.city_id, codAmountMinor: Number(job.cod_amount_minor) })
      const result = verifyReverseResult(await requestPdcJson({ settings, endpoint: 'SaveShipmentEx', body: {
        allMustValid: Boolean(settings.all_must_valid), shipments: [shipment], hasAWBs: false, extraParams: {}
      }, fetcher, bounded: true }), job.to_ref)
      if (result.state !== 'created') throw new Error('Booking outcome requires review')
      await finish('created', { p_awb: result.awb })
      // The next claim performs only ExportPDF. Do not reuse the booking token.
      return processPdcOrderJob({ supabaseAdmin: db, settings, jobId, fetcher, runtime, authorize })
    } catch {
      try { await finish('uncertain') } catch { /* Durable dispatch barrier still prevents another POST. */ }
      return { id: jobId, state: 'uncertain' }
    }
  }
  try {
    await authorize()
    const bytes = await requestPdcLabel({ settings, awb: job.awb, fetcher, bounded: true })
    const { data: row, error } = await db.from('shipping_order_jobs').select('order_id').eq('id', jobId).single()
    if (error || !row) throw new Error('Missing label binding')
    const evidence = await saveShippingDocument(`vps-v1/orders/${row.order_id}/${job.id}.pdf`, bytes)
    await finish('label_ready', { p_sha256: evidence.sha256, p_size: evidence.size_bytes })
    return { id: jobId, state: 'ready', awb: job.awb }
  } catch {
    try { await finish('label_failed') } catch { /* An expired label lease can safely retry PDF retrieval only. */ }
    return { id: jobId, state: 'label_pending' }
  }
}
export const processPdcOutboundQueue = async ({ supabaseAdmin: db, limit = 10, fetcher = fetch, runtime = useRuntimeConfig(), authorize = () => {} }) => {
  await authorize()
  if (runtime.shippingLiveRequestsEnabled !== true) return { active: false, processed: [] }
  const settings = await getPdcSettings(db)
  if (!settings.is_enabled || !settings.auto_create_labels) return { active: false, processed: [] }
  await requireReady(settings, runtime)
  await rpc(db, 'queue_eligible_paid_orders_for_shipping', {})
  const { data, error } = await db.from('shipping_order_jobs').select('id').in('state', ['queued','submitting','label_pending'])
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${new Date().toISOString()}`).order('created_at').limit(Math.min(25, Math.max(1, Number(limit) || 10)))
  if (error) throw createError({ statusCode: 503, statusMessage: 'Courier queue is unavailable.' })
  const processed = []
  for (const job of data || []) processed.push(await processPdcOrderJob({ supabaseAdmin: db, settings, jobId: job.id, fetcher, runtime, authorize }))
  return { active: true, processed }
}
export const operatePdcOrder = async ({ db, adminId, orderId, action, runtime = useRuntimeConfig(), fetcher = fetch, authorize = () => {} }) => {
  await authorize()
  const settings = await getPdcSettings(db)
  await requireReady(settings, runtime)
  if (action === 'label') {
    const { data: job, error } = await db.from('shipping_order_jobs').select('id,awb').eq('order_id', orderId).maybeSingle()
    if (error || !job?.awb) throw createError({ statusCode: 404, statusMessage: 'An existing shipment is required.' })
    return processPdcOrderJob({ supabaseAdmin: db, settings, jobId: job.id, fetcher, runtime, authorize })
  }
  if (action === 'recover') {
    const { data: job, error } = await db.from('shipping_order_jobs').select('to_ref,state,provider_identity').eq('order_id', orderId).maybeSingle()
    if (error || !job || !['uncertain','submitting'].includes(job.state) || ['base_url','api_mode','company_id'].some(k => job.provider_identity?.[k] !== settings[k])) throw createError({ statusCode: 409, statusMessage: 'Courier booking cannot be reconciled.' })
    const response = await requestPdcLookup(settings, 'GetShipmentsStatus', { awBs: '', reFs: job.to_ref }, fetcher)
    const matches = pdcResponseRows(response).filter(row => row.Ref === job.to_ref && typeof row.AWB === 'string' && /^[A-Za-z0-9][A-Za-z0-9-]{0,99}$/.test(row.AWB))
    if (matches.length !== 1) throw createError({ statusCode: 409, statusMessage: 'No unique booking found. Do not rebook.' })
    await authorize()
    await rpc(db, 'shipping_order_recover', { p_admin: adminId, p_order: orderId, p_ref: job.to_ref, p_awb: matches[0].AWB, p_configuration: configuration(settings) })
  }
  const job = await rpc(db, 'shipping_order_prepare', { p_admin: adminId, p_order: orderId })
  return processPdcOrderJob({ supabaseAdmin: db, settings, jobId: job.id, fetcher, runtime, authorize })
}
