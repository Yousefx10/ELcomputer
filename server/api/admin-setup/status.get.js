import { setHeader, setResponseStatus } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest.js'
import { readQuickSetupStatus } from '../../utils/quickSetup.js'

export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  try {
    const { supabaseAdmin } = await requireAdminRequest(event, { role: 'owner' })
    return await readQuickSetupStatus(supabaseAdmin, useRuntimeConfig())
  } catch (error) {
    const status = [401, 403].includes(error?.statusCode) ? error.statusCode : 503
    // Never let generic error rendering echo a request URL or database message.
    setResponseStatus(event, status)
    return { error: true, statusCode: status, statusMessage: status === 503 ? 'Setup status is unavailable.' : 'Owner access is required.' }
  }
})
