import { readBody } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest.js'
import { mutateQuickSetup } from '../../utils/quickSetupProgress.js'
import { setupPrivacyHeaders, setupSafeError } from '../../utils/quickSetupHttp.js'
export default defineEventHandler(async event => {
  setupPrivacyHeaders(event)
  try {
    const { supabaseAdmin, authUser } = await requireAdminRequest(event, { role: 'owner' })
    return await mutateQuickSetup(supabaseAdmin, useRuntimeConfig(), authUser.id, await readBody(event))
  } catch (error) { return setupSafeError(event, error) }
})
