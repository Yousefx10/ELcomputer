import { createError, readBody } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { recordAdminActivity } from '../../utils/adminLogs'
import {
  clearDaftraConfigCache,
  getDaftraConfigSummary,
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
      : 'Daftra credential storage is unavailable.'
    throw createError({ statusCode: 500, statusMessage: message })
  }

  if (!suppliedApiKey && !currentSettings?.api_key_encrypted) {
    throw createError({ statusCode: 400, statusMessage: 'Daftra API key is required.' })
  }

  const currentConfig=await getDaftraConfigSummary(supabaseAdmin)
  if (currentConfig.source==='environment' && currentConfig.accountUrl!==accountUrl) {
    const counts=await Promise.all(['erp_entity_links','erp_remote_writes'].map(table=>
      supabaseAdmin.from(table).select('*',{count:'exact',head:true})))
    if(counts.some(result=>result.error)) throw createError({statusCode:503,statusMessage:'Could not review the ERP account mappings.'})
    if(counts.some(result=>result.count>0)) throw createError({statusCode:409,statusMessage:'Account changes require manual mapping reconciliation.'})
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

  const { error } = await supabaseAdmin.rpc('erp_save_daftra_credentials', {
    p_admin_id: adminUser.id, p_url: updatePayload.account_url,
    p_key: updatePayload.api_key_encrypted, p_client: updatePayload.client_id_encrypted
  })
  if (error) throw createError({ statusCode: 409, statusMessage: 'Could not save credentials. Finish active jobs and review account mappings.' })

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
    accountUrl: updatePayload.account_url,
    accountHost: new URL(updatePayload.account_url).hostname,
    apiKeyConfigured: Boolean(updatePayload.api_key_encrypted),
    clientIdConfigured: Boolean(updatePayload.client_id_encrypted),
    updatedAt: updatePayload.updated_at
  }
})
