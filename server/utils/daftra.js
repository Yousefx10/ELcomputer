import { createError } from 'h3'
import {
  decryptCredentialSecret,
  isCredentialEncryptionReady
} from './credentialSecrets.js'
import { getSupabaseAdminClient } from './supabaseAdmin.js'

const DAFTRA_TIMEOUT_MS = 15000
const DAFTRA_CONFIG_CACHE_MS = 30000
const ALLOWED_DAFTRA_HOST = /(^|\.)dafta?ra\.com$/i
const MISSING_SETTINGS_CODES = new Set(['42P01', 'PGRST205'])

let cachedDaftraConfig = null
let cachedDaftraConfigExpiresAt = 0
let pendingDaftraConfig = null

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

const getEnvironmentDaftraConfig = () => {
  const runtimeConfig = useRuntimeConfig()
  const accountUrl = normalizeDaftraAccountUrl(runtimeConfig.daftraAccountUrl)
  const apiKey = cleanText(runtimeConfig.daftraApiKey)

  return {
    accountUrl,
    apiKey,
    clientId: cleanText(runtimeConfig.daftraClientId),
    configured: Boolean(accountUrl && apiKey),
    source: accountUrl || apiKey ? 'environment' : ''
  }
}

const getStoredDaftraSettings = async (supabaseAdmin = getSupabaseAdminClient()) => {
  const { data, error } = await supabaseAdmin
    .from('erp_provider_settings')
    .select('account_url, api_key_encrypted, client_id_encrypted, updated_at')
    .eq('id', 'daftra')
    .maybeSingle()

  if (error) {
    if (MISSING_SETTINGS_CODES.has(error.code)) {
      return { data: null, storageReady: false }
    }

    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return { data: data || null, storageReady: true }
}

const loadDaftraConfig = async () => {
  const storedSettings = await getStoredDaftraSettings()

  if (!storedSettings.data) {
    return {
      ...getEnvironmentDaftraConfig(),
      storageReady: storedSettings.storageReady
    }
  }

  const accountUrl = normalizeDaftraAccountUrl(storedSettings.data.account_url)
  const apiKey = decryptCredentialSecret(storedSettings.data.api_key_encrypted, 'Daftra')
  const clientId = storedSettings.data.client_id_encrypted
    ? decryptCredentialSecret(storedSettings.data.client_id_encrypted, 'Daftra')
    : ''

  return {
    accountUrl,
    apiKey,
    clientId,
    configured: Boolean(accountUrl && apiKey),
    source: 'database',
    storageReady: true
  }
}

export const clearDaftraConfigCache = () => {
  cachedDaftraConfig = null
  cachedDaftraConfigExpiresAt = 0
  pendingDaftraConfig = null
}

export const getDaftraConfig = async () => {
  if (cachedDaftraConfig && cachedDaftraConfigExpiresAt > Date.now()) {
    return cachedDaftraConfig
  }

  if (!pendingDaftraConfig) {
    pendingDaftraConfig = loadDaftraConfig()
      .then((config) => {
        cachedDaftraConfig = config
        cachedDaftraConfigExpiresAt = Date.now() + DAFTRA_CONFIG_CACHE_MS
        return config
      })
      .finally(() => {
        pendingDaftraConfig = null
      })
  }

  return pendingDaftraConfig
}

export const getDaftraConfigSummary = async (supabaseAdmin) => {
  const storedSettings = await getStoredDaftraSettings(supabaseAdmin)
  const encryptionReady = isCredentialEncryptionReady()

  if (storedSettings.data) {
    const accountUrl = normalizeDaftraAccountUrl(storedSettings.data.account_url)
    const apiKeyConfigured = Boolean(storedSettings.data.api_key_encrypted)

    return {
      accountUrl,
      accountHost: accountUrl ? new URL(accountUrl).hostname : '',
      apiKeyConfigured,
      clientIdConfigured: Boolean(storedSettings.data.client_id_encrypted),
      configured: Boolean(accountUrl && apiKeyConfigured && encryptionReady),
      encryptionReady,
      source: 'database',
      storageReady: true,
      updatedAt: storedSettings.data.updated_at || null
    }
  }

  const environmentConfig = getEnvironmentDaftraConfig()

  return {
    accountUrl: environmentConfig.accountUrl,
    accountHost: environmentConfig.accountUrl ? new URL(environmentConfig.accountUrl).hostname : '',
    apiKeyConfigured: Boolean(environmentConfig.apiKey),
    clientIdConfigured: Boolean(environmentConfig.clientId),
    configured: environmentConfig.configured,
    encryptionReady,
    source: environmentConfig.source,
    storageReady: storedSettings.storageReady,
    updatedAt: null
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
  const config = options.config || await getDaftraConfig()

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
  const config = await getDaftraConfig()
  const response = await daftraRequest('/clients.json', {
    query: { limit: 1, page: 1 },
    config
  })

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
