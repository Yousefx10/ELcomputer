import { createError } from 'h3'
import { decryptShippingSecret } from './shippingSecrets'

export const PDC_PROVIDER_ID = 'pdc'
export const PDC_PRODUCTION_BASE_URL = 'https://clientsapi.pdc-eg.com/api/ClientUsers/V6/'
export const PDC_LABEL_BUCKET = 'shipping-labels'

const PDC_ENDPOINTS = {
  createShipment: 'SaveShipmentEx',
  exportLabel: 'ExportPDF'
}

class ShippingPreparationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ShippingPreparationError'
  }
}

const cleanText = (value) => String(value || '').trim()

const getPdcHeaders = (settings) => ({
  AccessToken: decryptShippingSecret(settings.access_token_encrypted),
  CompanyID: cleanText(settings.company_id),
  'Content-Type': 'application/json',
  Accept: 'application/json'
})

const getPdcEndpointUrl = (baseUrl, endpoint) => {
  if (baseUrl !== PDC_PRODUCTION_BASE_URL) {
    throw new ShippingPreparationError('The courier production URL is invalid.')
  }

  return new URL(endpoint, baseUrl).toString()
}

const readPdcJsonResponse = async (response) => {
  const responseText = await response.text()

  if (!responseText) {
    return {}
  }

  try {
    return JSON.parse(responseText)
  } catch {
    throw new Error('The courier returned an invalid response.')
  }
}

const requestPdcJson = async ({ settings, endpoint, body }) => {
  const response = await fetch(getPdcEndpointUrl(settings.base_url, endpoint), {
    method: 'POST',
    headers: getPdcHeaders(settings),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  })
  const responseBody = await readPdcJsonResponse(response)

  if (!response.ok) {
    throw new Error(
      cleanText(responseBody?.message || responseBody?.error)
      || `Courier request failed with status ${response.status}.`
    )
  }

  return responseBody
}

const requestPdcLabel = async ({ settings, awb }) => {
  const response = await fetch(getPdcEndpointUrl(settings.base_url, PDC_ENDPOINTS.exportLabel), {
    method: 'POST',
    headers: getPdcHeaders(settings),
    body: JSON.stringify({
      templateID: Number(settings.label_template_id),
      awBs: [awb]
    }),
    signal: AbortSignal.timeout(20000)
  })

  if (!response.ok) {
    throw new Error(`Courier label request failed with status ${response.status}.`)
  }

  const contentType = cleanText(response.headers.get('content-type')).toLowerCase()
  const labelData = Buffer.from(await response.arrayBuffer())

  if (!contentType.includes('application/pdf') || !labelData.length) {
    throw new Error('The courier did not return a PDF label.')
  }

  return labelData
}

const findShipmentResult = (responseBody, orderReference) => {
  const successResponses = Array.isArray(responseBody?.successResponses)
    ? responseBody.successResponses
    : Array.isArray(responseBody?.SuccessResponses)
      ? responseBody.SuccessResponses
      : []
  const matchingResponse = successResponses.find((item) => {
    return cleanText(item?.ref || item?.Ref) === orderReference
  }) || successResponses[0]
  const awb = cleanText(
    matchingResponse?.awb
    || matchingResponse?.AWB
    || responseBody?.awb
    || responseBody?.AWB
  )

  if (awb) {
    return {
      awb,
      response: matchingResponse || responseBody
    }
  }

  const errors = [
    ...(Array.isArray(responseBody?.errorResponses) ? responseBody.errorResponses : []),
    ...(Array.isArray(responseBody?.errors) ? responseBody.errors : [])
  ]
  const errorMessage = cleanText(
    errors[0]?.message
    || errors[0]?.error
    || responseBody?.generalResponse?.message
    || responseBody?.message
  )

  throw new Error(errorMessage || 'The courier did not create the shipment.')
}

export const getPdcSettings = async (supabaseAdmin) => {
  const { data, error } = await supabaseAdmin
    .from('shipping_provider_settings')
    .select('*')
    .eq('id', PDC_PROVIDER_ID)
    .maybeSingle()

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message
    })
  }

  if (!data) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Run the shipping preparation migration first.'
    })
  }

  return data
}

const findMappedCity = async ({ supabaseAdmin, order }) => {
  const governorate = cleanText(order.governorate)
  const city = cleanText(order.city)
  let { data, error } = await supabaseAdmin
    .from('shipping_city_mappings')
    .select('provider_city_id')
    .eq('provider', PDC_PROVIDER_ID)
    .ilike('city', city)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    const arabicResult = await supabaseAdmin
      .from('shipping_city_mappings')
      .select('provider_city_id')
      .eq('provider', PDC_PROVIDER_ID)
      .ilike('city_arabic', city)
      .limit(1)
      .maybeSingle()

    if (arabicResult.error) {
      throw arabicResult.error
    }

    data = arabicResult.data
  }

  if (!data?.provider_city_id) {
    throw new ShippingPreparationError(`No courier city mapping exists for ${city}, ${governorate}.`)
  }

  return Number(data.provider_city_id)
}

const buildPdcShipment = async ({ supabaseAdmin, settings, order, items, orderReference }) => {
  const customerName = [order.first_name, order.last_name]
    .map(cleanText)
    .filter(Boolean)
    .join(' ')
  const phone = cleanText(order.phone).replace(/\s+/g, '')
  const address = cleanText(order.street_address)

  if (!customerName || !address || !cleanText(order.city) || !cleanText(order.governorate)) {
    throw new ShippingPreparationError('The delivery address is incomplete.')
  }

  if (!/^01\d{9}$/.test(phone)) {
    throw new ShippingPreparationError('The customer phone must contain 11 digits.')
  }

  if (
    !Number(settings.origin_city_id)
    || !cleanText(settings.origin_address)
    || !/^01\d{9}$/.test(cleanText(settings.origin_phone).replace(/\s+/g, ''))
  ) {
    throw new ShippingPreparationError('Complete the courier pickup address first.')
  }

  if (!items.length) {
    throw new ShippingPreparationError('The order has no items.')
  }

  const toCityId = await findMappedCity({ supabaseAdmin, order })
  const pieces = items.reduce((total, item) => total + Math.max(1, Number(item.quantity) || 1), 0)
  const contents = items
    .map((item) => `${cleanText(item.product_title) || 'Item'} x${Math.max(1, Number(item.quantity) || 1)}`)
    .join(', ')
    .slice(0, 500)

  return {
    fromCityID: Number(settings.origin_city_id),
    fromAddress: cleanText(settings.origin_address),
    fromPhone: cleanText(settings.origin_phone).replace(/\s+/g, ''),
    fromContactName: cleanText(settings.origin_contact_name) || 'Store',
    toCityID: toCityId,
    toConsigneeName: customerName,
    toAddress: address,
    toPhone: phone,
    toRef: orderReference,
    productID: Number(settings.product_id),
    weight: Number(settings.default_weight_kg),
    pieces,
    cod: 0,
    shipmentTypeID: Number(settings.shipment_type_id),
    specialInstuctions: contents,
    allowToOpenPackage: Boolean(settings.allow_open_shipment)
  }
}

const setJobFailure = async ({ supabaseAdmin, job, error }) => {
  const isPreparationFailure = error instanceof ShippingPreparationError
  const attemptCount = Number(job.attempt_count || 0) + (isPreparationFailure ? 0 : 1)
  const retryMinutes = Math.min(60, Math.max(5, 5 * (2 ** Math.max(0, attemptCount - 1))))
  const nextAttemptAt = new Date(Date.now() + retryMinutes * 60 * 1000).toISOString()

  await supabaseAdmin
    .from('shipping_order_jobs')
    .update({
      state: isPreparationFailure ? 'blocked' : 'failed',
      attempt_count: attemptCount,
      last_error: cleanText(error?.message).slice(0, 500) || 'Shipping failed.',
      next_attempt_at: isPreparationFailure ? null : nextAttemptAt,
      updated_at: new Date().toISOString()
    })
    .eq('id', job.id)
}

const processPdcJob = async ({ supabaseAdmin, settings, job }) => {
  const { data: claimedJob, error: claimError } = await supabaseAdmin
    .from('shipping_order_jobs')
    .update({
      state: 'submitting',
      updated_at: new Date().toISOString()
    })
    .eq('id', job.id)
    .eq('state', job.state)
    .select('*')
    .maybeSingle()

  if (claimError) {
    throw claimError
  }

  if (!claimedJob) {
    return { skipped: true }
  }

  try {
    const [orderResult, orderItemsResult] = await Promise.all([
      supabaseAdmin
        .from('customer_orders')
        .select('*')
        .eq('id', claimedJob.order_id)
        .maybeSingle(),
      supabaseAdmin
        .from('customer_order_items')
        .select('product_title, quantity')
        .eq('order_id', claimedJob.order_id)
        .order('created_at')
    ])

    if (orderResult.error) {
      throw orderResult.error
    }

    if (orderItemsResult.error) {
      throw orderItemsResult.error
    }

    if (!orderResult.data || orderResult.data.payment_status !== 'paid') {
      throw new ShippingPreparationError('The order is not marked as paid.')
    }

    if (!['not_required', 'approved'].includes(orderResult.data.shipping_review_status)) {
      throw new ShippingPreparationError('The order still needs review.')
    }

    const orderReference = cleanText(claimedJob.to_ref)
    let awb = cleanText(claimedJob.awb)

    if (!awb) {
      const shipment = await buildPdcShipment({
        supabaseAdmin,
        settings,
        order: orderResult.data,
        items: orderItemsResult.data || [],
        orderReference
      })
      const requestPayload = {
        allMustValid: Boolean(settings.all_must_valid),
        shipments: [shipment],
        hasAWBs: false,
        extraParams: {}
      }

      await supabaseAdmin
        .from('shipping_order_jobs')
        .update({
          request_payload: requestPayload,
          last_error: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', claimedJob.id)

      const shipmentResponse = await requestPdcJson({
        settings,
        endpoint: PDC_ENDPOINTS.createShipment,
        body: requestPayload
      })
      const result = findShipmentResult(shipmentResponse, orderReference)
      awb = result.awb

      await supabaseAdmin
        .from('shipping_order_jobs')
        .update({
          state: 'label_pending',
          awb,
          response_payload: shipmentResponse,
          updated_at: new Date().toISOString()
        })
        .eq('id', claimedJob.id)
    }

    const labelData = await requestPdcLabel({ settings, awb })
    const labelStoragePath = `${claimedJob.order_id}/${awb}.pdf`
    const { error: uploadError } = await supabaseAdmin.storage
      .from(PDC_LABEL_BUCKET)
      .upload(labelStoragePath, labelData, {
        contentType: 'application/pdf',
        upsert: true
      })

    if (uploadError) {
      throw uploadError
    }

    const { error: readyError } = await supabaseAdmin
      .from('shipping_order_jobs')
      .update({
        state: 'ready',
        label_storage_path: labelStoragePath,
        last_error: null,
        next_attempt_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', claimedJob.id)

    if (readyError) {
      throw readyError
    }

    return {
      id: claimedJob.id,
      state: 'ready',
      awb
    }
  } catch (error) {
    await setJobFailure({ supabaseAdmin, job: claimedJob, error })

    return {
      id: claimedJob.id,
      state: error instanceof ShippingPreparationError ? 'blocked' : 'failed',
      error: cleanText(error?.message) || 'Shipping failed.'
    }
  }
}

export const processPdcShippingQueue = async ({ supabaseAdmin, limit = 10 }) => {
  const runtimeConfig = useRuntimeConfig()

  if (runtimeConfig.shippingLiveRequestsEnabled !== true) {
    return {
      active: false,
      processed: []
    }
  }

  const settings = await getPdcSettings(supabaseAdmin)

  if (!settings.is_enabled || !settings.auto_create_labels) {
    return {
      active: false,
      processed: []
    }
  }

  if (!settings.access_token_encrypted) {
    throw createError({
      statusCode: 503,
      statusMessage: 'The courier access token is missing.'
    })
  }

  const now = new Date().toISOString()
  const { data: jobs, error } = await supabaseAdmin
    .from('shipping_order_jobs')
    .select('*')
    .in('state', ['queued', 'failed', 'label_pending'])
    .lt('attempt_count', 5)
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
    .order('created_at')
    .limit(Math.min(25, Math.max(1, Number(limit) || 10)))

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message
    })
  }

  const processed = []

  for (const job of jobs || []) {
    processed.push(await processPdcJob({ supabaseAdmin, settings, job }))
  }

  return {
    active: true,
    processed
  }
}
