import { createError, readBody } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { recordAdminActivity } from '../../utils/adminLogs'
import {
  clearDaftraConfigCache,
  normalizeDaftraAccountUrl
} from '../../utils/daftra'
import {
  encryptCredentialSecret,
  isCredentialEncryptionReady
} from '../../utils/credentialSecrets'

const cleanText = (value) => String(value || '').trim()
const MISSING_SETTINGS_CODES = new Set(['42P01', 'PGRST204', 'PGRST205'])

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'settings.edit'
  })
  const body = await readBody(event)
  const suppliedApiKey = cleanText(body?.apiKey)
  const suppliedClientId = cleanText(body?.clientId)
  let accountUrl

  try {
    accountUrl = normalizeDaftraAccountUrl(body?.accountUrl)
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error?.statusMessage || 'Enter a valid Daftra account URL.'
    })
  }

  if (!accountUrl) {
    throw createError({ statusCode: 400, statusMessage: 'Daftra account URL is required.' })
  }

  if (!isCredentialEncryptionReady()) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Credential encryption is not configured on this server.'
    })
  }

  const { data: currentSettings, error: currentError } = await supabaseAdmin
    .from('erp_provider_settings')
    .select('api_key_encrypted, client_id_encrypted')
    .eq('id', 'daftra')
    .maybeSingle()

  if (currentError) {
    const message = MISSING_SETTINGS_CODES.has(currentError.code)
      ? 'Run the latest database migration first.'
      : currentError.message
    throw createError({ statusCode: 500, statusMessage: message })
  }

  if (!suppliedApiKey && !currentSettings?.api_key_encrypted) {
    throw createError({ statusCode: 400, statusMessage: 'Daftra API key is required.' })
  }

  const updatePayload = {
    id: 'daftra',
    account_url: accountUrl,
    api_key_encrypted: suppliedApiKey
      ? encryptCredentialSecret(suppliedApiKey, 'Daftra')
      : currentSettings.api_key_encrypted,
    client_id_encrypted: suppliedClientId
      ? encryptCredentialSecret(suppliedClientId, 'Daftra')
      : currentSettings?.client_id_encrypted || null,
    updated_by: adminUser.id,
    updated_at: new Date().toISOString()
  }

  const { error: connectionStatusError } = await supabaseAdmin
    .from('site_settings')
    .update({
      daftra_connection_status: 'disconnected',
      daftra_connection_error: null,
      updated_at: new Date().toISOString()
    })
    .eq('key', 'default')

  if (connectionStatusError) {
    throw createError({ statusCode: 500, statusMessage: connectionStatusError.message })
  }

  const { data, error } = await supabaseAdmin
    .from('erp_provider_settings')
    .upsert(updatePayload, { onConflict: 'id' })
    .select('account_url, api_key_encrypted, client_id_encrypted, updated_at')
    .single()

  if (error) {
    const message = MISSING_SETTINGS_CODES.has(error.code)
      ? 'Run the latest database migration first.'
      : error.message
    throw createError({ statusCode: 500, statusMessage: message })
  }

  clearDaftraConfigCache()

  await recordAdminActivity({
    supabaseAdmin,
    adminUser,
    actionKey: 'settings.erp.credentials-update',
    description: 'Updated the Daftra connection credentials.',
    metadata: {
      accountHost: new URL(accountUrl).hostname,
      apiKeyChanged: Boolean(suppliedApiKey),
      clientIdChanged: Boolean(suppliedClientId)
    }
  })

  return {
    saved: true,
    accountUrl: data.account_url,
    accountHost: new URL(data.account_url).hostname,
    apiKeyConfigured: Boolean(data.api_key_encrypted),
    clientIdConfigured: Boolean(data.client_id_encrypted),
    updatedAt: data.updated_at
  }
})
