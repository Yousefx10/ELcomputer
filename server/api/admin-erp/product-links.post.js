import { createError, readBody, setHeader } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { recordAdminActivity } from '../../utils/adminLogs'
import { assertExternalErpDomain } from '../../utils/erpOwnership'
import { readDaftraCatalog } from '../../utils/daftraCatalog'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Save owner-confirmed links (null unlinks). Bills waiting for a link retry right away.
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'products.edit' })
  await assertExternalErpDomain(supabaseAdmin)
  const body = await readBody(event)
  const links = Array.isArray(body?.links) ? body.links : []
  if (!links.length || links.length > 500 || links.some(link => !link || typeof link !== 'object' || !UUID.test(String(link.variantId || ''))
    || (link.daftraId !== null && !/^[1-9][0-9]{0,18}$/.test(String(link.daftraId || ''))))) {
    throw createError({ statusCode: 400, statusMessage: 'Choose a valid Daftra product.' })
  }
  const catalog = links.some(link => link.daftraId !== null) ? await readDaftraCatalog() : { products: [] }
  const byId = new Map(catalog.products.map(product => [product.id, product]))
  const payload = links.map(link => {
    const daftraId = link.daftraId === null ? null : String(link.daftraId)
    if (daftraId && !byId.has(daftraId)) throw createError({ statusCode: 409, statusMessage: 'This Daftra product was not found. Refresh the list.' })
    return { variant_id: link.variantId, daftra_id: daftraId, daftra_code: daftraId ? byId.get(daftraId).code : null,
      source: ['code', 'name'].includes(link.source) ? link.source : 'owner' }
  })
  const { data, error } = await supabaseAdmin.rpc('erp_save_product_links', { p_admin_id: adminUser.id, p_links: payload })
  if (error) throw createError({ statusCode: error.code === '42501' ? 403 : 409, statusMessage: error.code === '42501' ? 'Product editing permission is required.' : 'Product links could not be saved. Reload and try again.' })
  await recordAdminActivity({ supabaseAdmin, adminUser, actionKey: 'erp.daftra.product-links', description: 'Updated Daftra product links.',
    metadata: { saved: data?.saved || 0, removed: data?.removed || 0, requeued: data?.requeued || 0 } })
  return data
})
