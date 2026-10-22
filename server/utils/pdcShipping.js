import { createError } from 'h3'
import { decryptShippingSecret } from './shippingSecrets.js'

export const PDC_PROVIDER_ID = 'pdc'
export const PDC_PRODUCTION_BASE_URL = 'https://clientsapi.pdc-eg.com/api/ClientUsers/V6/'

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

const merchandiseMinor = value => {
  const match = String(value).match(/^(\d{1,12})(?:\.(\d{1,2}))?$/)
  if (!match) throw new ShippingPreparationError('The shipment value is invalid.')
  const minor = Number(BigInt(match[1]) * BigInt(100) + BigInt((match[2] || '').padEnd(2, '0')))
  if (!Number.isSafeInteger(minor)) throw new ShippingPreparationError('The shipment value is invalid.')
  return minor
}

const getPdcHeaders = (settings) => ({
  AccessToken: decryptShippingSecret(settings.access_token_encrypted),
  CompanyID: cleanText(settings.company_id),
  'Content-Type': 'application/json',
  Accept: 'application/json'
})

export const PDC_TEST_BASE_URL = 'https://clientsapi-test.pdc-eg.com/api/ClientUsers/V6/'
export const validatePdcBaseUrl = (baseUrl, mode = 'production') => {
  const expected = mode === 'test' ? PDC_TEST_BASE_URL : mode === 'production' ? PDC_PRODUCTION_BASE_URL : null
  if (!expected || baseUrl !== expected) throw createError({ statusCode: 400, statusMessage: 'Courier URL does not match its mode.' })
  return baseUrl
}
const getPdcEndpointUrl = (baseUrl, endpoint, mode = 'production') => new URL(endpoint, validatePdcBaseUrl(baseUrl, mode)).toString()

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

export const requestPdcJson = async ({ settings, endpoint, body, fetcher = fetch, bounded = false }) => {
  const response = await fetcher(getPdcEndpointUrl(settings.base_url, endpoint, settings.api_mode), {
    method: 'POST',
    headers: getPdcHeaders(settings),
    body: JSON.stringify(body),
    redirect: 'error',
    signal: AbortSignal.timeout(15000)
  })
  const responseBody = bounded ? JSON.parse((await readPdcBytes(response, 1048576)).toString('utf8')) : await readPdcJsonResponse(response)

  if (!response.ok) {
    throw new Error(
      cleanText(responseBody?.message || responseBody?.error)
      || `Courier request failed with status ${response.status}.`
    )
  }

  return responseBody
}

const readPdcBytes = async (response, maximum) => {
  if (Number(response.headers.get('content-length')) > maximum || !response.body) throw new Error('Courier response size is invalid.')
  const reader = response.body.getReader(), chunks = []; let size = 0
  try {
    for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > maximum) { await reader.cancel(); throw new Error('Courier response size is invalid.') }; chunks.push(Buffer.from(value)) }
  } finally { reader.releaseLock() }
  return Buffer.concat(chunks)
}
export const requestPdcLabel = async ({ settings, awb, fetcher = fetch, bounded = false }) => {
  const response = await fetcher(getPdcEndpointUrl(settings.base_url, PDC_ENDPOINTS.exportLabel, settings.api_mode), {
    method: 'POST',
    headers: getPdcHeaders(settings),
    body: JSON.stringify({
      templateID: Number(settings.label_template_id),
      awBs: [awb]
    }),
    redirect: 'error',
    signal: AbortSignal.timeout(20000)
  })

  if (!response.ok) {
    throw new Error(`Courier label request failed with status ${response.status}.`)
  }

  const contentType = cleanText(response.headers.get('content-type')).toLowerCase()
  const labelData = bounded ? await readPdcBytes(response, 5242880) : Buffer.from(await response.arrayBuffer())

  if (!contentType.includes('application/pdf') || !labelData.length || (bounded && labelData.subarray(0, 5).toString() !== '%PDF-')) {
    throw new Error('The courier did not return a PDF label.')
  }

  return labelData
}

export const findShipmentResult = (responseBody, orderReference) => {
  const successResponses = Array.isArray(responseBody?.successResponses)
    ? responseBody.successResponses
    : Array.isArray(responseBody?.SuccessResponses)
      ? responseBody.SuccessResponses
      : []
  const matchingResponse = successResponses.find((item) => {
    return cleanText(item?.ref || item?.Ref) === orderReference && item?.success !== false
  })
  const awb = cleanText(
    matchingResponse?.awb
    || matchingResponse?.AWB
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

export const getPdcSettings = async (supabaseAdmin, signal = AbortSignal.timeout(4000)) => {
  const { data, error } = await supabaseAdmin
    .from('shipping_provider_settings')
    .select('*')
    .eq('id', PDC_PROVIDER_ID)
    .maybeSingle().abortSignal(signal)

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Courier settings are unavailable.'
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

export const buildPdcShipment = async ({ settings, order, items, orderReference, destinationCityId, codAmountMinor }) => {
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

  const toCityId = Number(destinationCityId)
  if (!Number.isSafeInteger(toCityId) || toCityId < 1 || !Number.isSafeInteger(codAmountMinor) || codAmountMinor < 0) throw new ShippingPreparationError('Courier delivery snapshot is invalid.')
  const pieces = items.reduce((total, item) => total + Math.max(1, Number(item.quantity) || 1), 0)
  const contents = items
    .map((item) => `${cleanText(item.product_title) || 'Item'} x${Math.max(1, Number(item.quantity) || 1)}`)
    .join(', ')
    .slice(0, 500)
  // Declared goods value is separate from COD, delivery and payment fees.
  // The owner reviews this saved net merchandise value before controlled booking.
  const declaredMinor = merchandiseMinor(order.subtotal_amount) - merchandiseMinor(order.discount_amount ?? 0)
  if (declaredMinor < 0) throw new ShippingPreparationError('The shipment value is invalid.')

  return {
    fromCityID: Number(settings.origin_city_id),
    fromAddress: cleanText(settings.origin_address),
    fromPhone: cleanText(settings.origin_phone).replace(/\s+/g, ''),
    fromContactPerson: cleanText(settings.origin_contact_name) || 'Store',
    toCityID: toCityId,
    toConsigneeName: customerName,
    toAddress: address,
    toPhone: phone,
    toRef: orderReference,
    productID: Number(settings.product_id),
    weight: Number(settings.default_weight_kg),
    pieces,
    cod: codAmountMinor / 100,
    declaredValue: declaredMinor / 100,
    shipmentTypeID: Number(settings.shipment_type_id),
    contents,
    allowToOpenShipment: Boolean(settings.allow_open_shipment)
  }
}

// One authenticated shipping worker. Claim jobs remain separate from paid-order
// jobs and never depend on outbound auto-label enablement.
export const processPdcShippingQueue = async options => {
  const { processPdcOutboundQueue } = await import('./pdcOrderShipping.js')
  const outbound = await processPdcOutboundQueue(options)
  const { processPdcReverseQueue } = await import('./pdcReverseLogistics.js')
  const reverse = await processPdcReverseQueue(options)
  return { ...outbound, reverse_active: reverse.active, reverse_processed: reverse.processed }
}
