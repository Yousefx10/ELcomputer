import { createError, readBody, setHeader } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { recordAdminActivity } from '../../utils/adminLogs'
import { assertExternalErpDomain } from '../../utils/erpOwnership'
import { createDaftraProduct } from '../../utils/daftraProductCreate'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// "Create in Daftra" for one website option with no Daftra match, then link it.
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'products.edit' })
  await assertExternalErpDomain(supabaseAdmin)
  const body = await readBody(event)
  if (!UUID.test(String(body?.variantId || ''))) throw createError({ statusCode: 400, statusMessage: 'Choose a product option.' })
  const result = await createDaftraProduct(supabaseAdmin, { adminId: adminUser.id, variantId: body.variantId })
  await recordAdminActivity({ supabaseAdmin, adminUser, actionKey: 'erp.daftra.product-create', description: 'Created a product in Daftra.',
    metadata: { variant_id: body.variantId, daftra_id: result.daftraId } })
  return result
})
