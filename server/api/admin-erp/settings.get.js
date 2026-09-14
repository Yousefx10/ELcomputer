import { requireAdminRequest } from '../../utils/adminRequest'
import { getDaftraConfigSummary } from '../../utils/daftra'
import { getErpSettings } from '../../utils/daftraSync'

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, {
    permission: 'settings.view'
  })
  const settings = await getErpSettings(supabaseAdmin)
  const config = await getDaftraConfigSummary(supabaseAdmin)
  let jobCounts = { pending: 0, processing: 0, failed: 0 }

  if (!settings.migrationRequired) {
    const { data } = await supabaseAdmin
      .from('erp_sync_jobs')
      .select('status')
      .in('status', ['pending', 'processing', 'failed'])

    jobCounts = (data || []).reduce((counts, job) => {
      counts[job.status] = Number(counts[job.status] || 0) + 1
      return counts
    }, jobCounts)
  }

  return {
    settings: {
      mode: settings.erp_mode,
      connectionStatus: settings.daftra_connection_status,
      lastCheckedAt: settings.daftra_last_checked_at,
      connectedAt: settings.daftra_connected_at,
      connectionError: settings.daftra_connection_error,
      configured: config.configured,
      accountUrl: config.accountUrl,
      accountHost: config.accountHost,
      apiKeyConfigured: config.apiKeyConfigured,
      clientIdConfigured: config.clientIdConfigured,
      credentialsSource: config.source,
      encryptionReady: config.encryptionReady,
      migrationRequired: settings.migrationRequired || !config.storageReady,
      jobCounts
    }
  }
})
