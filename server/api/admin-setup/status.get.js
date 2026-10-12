import { requireAdminRequest } from '../../utils/adminRequest.js'
import { readQuickSetupProgress } from '../../utils/quickSetupProgress.js'
import { setupPrivacyHeaders, setupSafeError } from '../../utils/quickSetupHttp.js'

export default defineEventHandler(async event => {
  setupPrivacyHeaders(event)
  try {
    const { supabaseAdmin } = await requireAdminRequest(event, { role: 'owner' })
    return await readQuickSetupProgress(supabaseAdmin, useRuntimeConfig())
  } catch (error) {
    return setupSafeError(event, error)
  }
})
