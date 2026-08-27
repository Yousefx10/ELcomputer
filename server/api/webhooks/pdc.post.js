import { createHash } from 'node:crypto'
import { createError, getHeader } from 'h3'
import { getPdcSettings } from '../../utils/pdcShipping'
import { decryptShippingSecret, shippingSecretsMatch } from '../../utils/shippingSecrets'
import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'

const cleanText = (value) => String(value || '').trim()

const parseStatusDate = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export default defineEventHandler(async (event) => {
  const supabaseAdmin = getSupabaseAdminClient()
  const settings = await getPdcSettings(supabaseAdmin)

  if (!settings.webhook_secret_encrypted) {
    throw createError({
      statusCode: 503,
      statusMessage: 'The courier webhook is not configured.'
    })
  }

  const requestSecret = cleanText(getHeader(event, 'x-webhook-secret'))
  const savedSecret = decryptShippingSecret(settings.webhook_secret_encrypted)

  if (!requestSecret || !shippingSecretsMatch(savedSecret, requestSecret)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid webhook secret.'
    })
  }

  const body = await readBody(event)
  const awb = cleanText(body?.AWB ?? body?.awb)
  const orderReference = cleanText(body?.REF ?? body?.ref)
  const providerStatusId = Number(body?.StatusID ?? body?.statusID ?? body?.status_id)
  const providerStatusName = cleanText(body?.CustomerStatusName ?? body?.statusName)
  const rawStatusDate = cleanText(body?.StatusDate ?? body?.statusDate)
  const statusDate = parseStatusDate(rawStatusDate)
  const reasonName = cleanText(body?.ReasonName ?? body?.reasonName)

  if (!awb || !orderReference || !Number.isInteger(providerStatusId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Webhook data is incomplete.'
    })
  }

  const eventKey = createHash('sha256')
    .update([awb, providerStatusId, rawStatusDate].join('|'))
    .digest('hex')
  const { data: eventRecord, error: insertError } = await supabaseAdmin
    .from('shipping_webhook_events')
    .insert({
      provider: 'pdc',
      event_key: eventKey,
      awb,
      order_ref: orderReference,
      provider_status_id: providerStatusId,
      provider_status_name: providerStatusName || null,
      status_date: statusDate,
      reason_name: reasonName || null,
      payload: body
    })
    .select('id')
    .single()

  if (insertError?.code === '23505') {
    return {
      received: true,
      duplicate: true
    }
  }

  if (insertError) {
    throw createError({
      statusCode: 500,
      statusMessage: insertError.message
    })
  }

  try {
    let { data: shippingJob, error: jobError } = await supabaseAdmin
      .from('shipping_order_jobs')
      .select('id, order_id, provider_status_at')
      .eq('awb', awb)
      .maybeSingle()

    if (jobError) {
      throw jobError
    }

    if (!shippingJob) {
      const jobByReferenceResult = await supabaseAdmin
        .from('shipping_order_jobs')
        .select('id, order_id, provider_status_at')
        .eq('to_ref', orderReference)
        .maybeSingle()

      if (jobByReferenceResult.error) {
        throw jobByReferenceResult.error
      }

      shippingJob = jobByReferenceResult.data
    }

    if (shippingJob) {
      const savedStatusTime = shippingJob.provider_status_at
        ? new Date(shippingJob.provider_status_at).getTime()
        : 0
      const incomingStatusTime = statusDate ? new Date(statusDate).getTime() : Date.now()
      const isStaleEvent = savedStatusTime > incomingStatusTime

      if (isStaleEvent) {
        await supabaseAdmin
          .from('shipping_webhook_events')
          .update({
            processed_at: new Date().toISOString(),
            processing_error: null
          })
          .eq('id', eventRecord.id)

        return {
          received: true,
          stale: true
        }
      }

      const { error: jobUpdateError } = await supabaseAdmin
        .from('shipping_order_jobs')
        .update({
          provider_status_id: providerStatusId,
          provider_status_name: providerStatusName || null,
          provider_status_at: statusDate || new Date().toISOString(),
          provider_reason_name: reasonName || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', shippingJob.id)

      if (jobUpdateError) {
        throw jobUpdateError
      }

      const { data: statusMapping, error: mappingError } = await supabaseAdmin
        .from('shipping_status_mappings')
        .select('order_status')
        .eq('provider', 'pdc')
        .eq('provider_status_id', providerStatusId)
        .maybeSingle()

      if (mappingError) {
        throw mappingError
      }

      if (statusMapping?.order_status) {
        const { data: order, error: orderError } = await supabaseAdmin
          .from('customer_orders')
          .select('status')
          .eq('id', shippingJob.order_id)
          .maybeSingle()

        if (orderError) {
          throw orderError
        }

        const protectedStatuses = ['completed', 'refunded', 'cancelled']
        const canUpdateOrder = order && (
          !protectedStatuses.includes(order.status)
          || (order.status !== 'refunded' && statusMapping.order_status === 'delivered')
        )

        if (canUpdateOrder && order.status !== statusMapping.order_status) {
          const { error: orderUpdateError } = await supabaseAdmin
            .from('customer_orders')
            .update({
              status: statusMapping.order_status,
              updated_at: new Date().toISOString()
            })
            .eq('id', shippingJob.order_id)

          if (orderUpdateError) {
            throw orderUpdateError
          }
        }
      }
    }

    await supabaseAdmin
      .from('shipping_webhook_events')
      .update({
        processed_at: new Date().toISOString(),
        processing_error: null
      })
      .eq('id', eventRecord.id)

    return {
      received: true
    }
  } catch (error) {
    await supabaseAdmin
      .from('shipping_webhook_events')
      .update({
        processing_error: cleanText(error?.message).slice(0, 500) || 'Webhook processing failed.'
      })
      .eq('id', eventRecord.id)

    throw createError({
      statusCode: 500,
      statusMessage: 'Webhook processing failed.'
    })
  }
})
