import { createError } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { getDaftraConfigSummary } from '../../utils/daftra'
import { getErpSettings } from '../../utils/erpOwnership'
import { resolveErpState } from '../../../app/utils/erpState'

export default defineEventHandler(async event => {
  const {supabaseAdmin}=await requireAdminRequest(event,{permission:'settings.view'})
  const [settings,config]=await Promise.all([getErpSettings(supabaseAdmin),getDaftraConfigSummary(supabaseAdmin)])
  const statuses=['pending','processing','failed']
  const counts=await Promise.all(statuses.map(status=>supabaseAdmin.from('erp_sync_jobs').select('id',{count:'exact',head:true}).eq('provider','daftra').eq('status',status)))
  if(counts.some(result=>result.error)) throw createError({statusCode:503,statusMessage:'Could not load ERP job status.'})
  const state=resolveErpState(settings,config)
  return {settings:{...state,stateVersion:settings.erp_state_version,
    lastCheckedAt:settings.daftra_last_checked_at,connectedAt:settings.daftra_connected_at,connectionError:settings.daftra_connection_error,
    configured:config.configured,accountUrl:config.accountUrl,accountHost:config.accountHost,
    apiKeyConfigured:config.apiKeyConfigured,clientIdConfigured:config.clientIdConfigured,credentialsSource:config.source,
    encryptionReady:config.encryptionReady,migrationRequired:!config.storageReady,
    jobCounts:Object.fromEntries(statuses.map((status,i)=>[status,counts[i].count||0]))}}
})
