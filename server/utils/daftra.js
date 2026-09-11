import { createError } from 'h3'

const DAFTRA_TIMEOUT_MS = 15000
const ALLOWED_DAFTRA_HOST = /(^|\.)daftara?\.com$/i

const cleanText = (value) => String(value || '').trim()

export const normalizeDaftraAccountUrl = (value) => {
  const suppliedValue = cleanText(value)

  if (!suppliedValue) {
    return ''
  }

  const candidate = /^https?:\/\//i.test(suppliedValue)
    ? suppliedValue
    : `https://${suppliedValue}`

  let url

  try {
    url = new URL(candidate)
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'The Daftra account URL is invalid.'
    })
  }

  if (url.protocol !== 'https:' || !ALLOWED_DAFTRA_HOST.test(url.hostname)) {
    throw createError({
      statusCode: 500,
      statusMessage: 'The Daftra account URL must use an official HTTPS domain.'
    })
  }

  return `${url.protocol}//${url.hostname}`
}

export const getDaftraConfig = () => {
  const runtimeConfig = useRuntimeConfig()
  const accountUrl = normalizeDaftraAccountUrl(runtimeConfig.daftraAccountUrl)
  const apiKey = cleanText(runtimeConfig.daftraApiKey)

  return {
    accountUrl,
    apiKey,
    clientId: cleanText(runtimeConfig.daftraClientId),
    configured: Boolean(accountUrl && apiKey)
  }
}

const getDaftraErrorMessage = (error) => {
  const data = error?.data || error?.response?._data || {}

  return cleanText(
    data.message
    || data.error
    || data.statusMessage
    || error?.statusMessage
    || error?.message
  ) || 'Daftra could not complete the request.'
}

export const daftraRequest = async (path, options = {}) => {
  const config = getDaftraConfig()

  if (!config.configured) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Daftra credentials are not configured.'
    })
  }

  const normalizedPath = `/${cleanText(path).replace(/^\/+/, '')}`

  try {
    return await $fetch(`${config.accountUrl}/api2${normalizedPath}`, {
      method: options.method || 'GET',
      query: options.query,
      body: options.body,
      timeout: options.timeout || DAFTRA_TIMEOUT_MS,
      headers: {
        accept: 'application/json',
        apikey: config.apiKey,
        ...(options.body ? { 'content-type': 'application/json' } : {})
      }
    })
  } catch (error) {
    const statusCode = Number(error?.statusCode || error?.response?.status || 502)

    throw createError({
      statusCode: statusCode >= 400 && statusCode < 500 ? statusCode : 502,
      statusMessage: getDaftraErrorMessage(error)
    })
  }
}

export const getDaftraConnectionSummary = async () => {
  const response = await daftraRequest('/clients.json', {
    query: { limit: 1, page: 1 }
  })
  const config = getDaftraConfig()

  return {
    connected: response?.result === 'successful' || Number(response?.code) === 200,
    accountHost: config.accountUrl ? new URL(config.accountUrl).hostname : '',
    clientCount: Number(response?.pagination?.total_results || 0)
  }
}

export const getDaftraList = async (resource, query = {}) => {
  const allowedResources = new Set([
    'clients',
    'expenses',
    'invoice_payments',
    'invoices',
    'products',
    'purchase_invoices',
    'stock_transactions',
    'stores',
    'suppliers',
    'treasuries'
  ])

  if (!allowedResources.has(resource)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'This Daftra resource is not supported.'
    })
  }

  return daftraRequest(`/${resource}.json`, { query })
}

export const getDaftraOverview = async () => {
  const resources = ['clients', 'products', 'invoices', 'stores']
  const settledResults = await Promise.allSettled(
    resources.map((resource) => getDaftraList(resource, { limit: 1, page: 1 }))
  )

  return Object.fromEntries(resources.map((resource, index) => {
    const result = settledResults[index]

    if (result.status === 'fulfilled') {
      return [resource, {
        total: Number(result.value?.pagination?.total_results || result.value?.data?.length || 0),
        available: true
      }]
    }

    return [resource, {
      total: null,
      available: false,
      error: getDaftraErrorMessage(result.reason)
    }]
  }))
}

export const unwrapDaftraRecord = (entry, wrapperName) => {
  if (!entry || typeof entry !== 'object') {
    return {}
  }

  return entry[wrapperName]
    || entry[Object.keys(entry)[0]]
    || entry
}
