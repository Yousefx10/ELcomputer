import { handlePdcWebhook } from '../../utils/pdcWebhook.js'
import { getSupabaseAdminClient } from '../../utils/supabaseAdmin'

export default defineEventHandler(event => handlePdcWebhook(event, getSupabaseAdminClient()))
