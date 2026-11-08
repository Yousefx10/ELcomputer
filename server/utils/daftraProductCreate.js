import { createError } from 'h3'
import { daftraRequest } from './daftra.js'
import { createRemoteRecord } from './daftraSync.js'
import { readDaftraCatalog, clearDaftraCatalogCache } from './daftraCatalog.js'
import { nameTokens, optionLabel } from './daftraLinks.js'

// Owner decision 7 Nov 2026 (DAFTRA-CREATE-01): a Daftra product is created only when staff press
// "Create in Daftra" for a website option with no Daftra match. Saving a website product never
// creates one, so Daftra's existing products are not duplicated and their stock is not split.
const conflict = message => createError({ statusCode: 409, statusMessage: message })
const sameName = (a, b) => nameTokens(a).join(' ') === nameTokens(b).join(' ')

// Same settings as the store's existing Daftra products: stock tracked, active, Daftra's own code.
export const daftraProductBody = (product, variant) => ({
  Product: {
    name: optionLabel(product, variant).trim().slice(0, 200),
    unit_price: Math.max(0, Number(Number(variant?.price) > 0 ? variant.price : product?.price) || 0),
    track_stock: 1, type: 1, status: 0
  }
})

export async function createDaftraProduct(db, { adminId, variantId }, { request = daftraRequest, catalog = readDaftraCatalog } = {}) {
  const check = result => { if (result.error) throw createError({ statusCode: 503, statusMessage: 'The product could not be read. Try again.' }); return result.data }
  const variant = check(await db.from('product_variants').select('id,product_id,name,price,is_active').eq('id', variantId).maybeSingle())
  if (!variant?.is_active) throw conflict('This product option is not active.')
  const product = check(await db.from('products').select('id,title,price').eq('id', variant.product_id).maybeSingle())
  if (!product || !String(product.title || '').trim()) throw conflict('This product needs a title first.')
  const links = check(await db.from('erp_entity_links').select('id').eq('provider', 'daftra').eq('external_entity_type', 'product')
    .or(`and(local_entity_type.eq.product_variant,local_id.eq.${variant.id}),and(local_entity_type.eq.product,local_id.eq.${product.id})`))
  if (links?.length) throw conflict('This option is already linked to Daftra.')

  const intent = check(await db.from('erp_remote_writes').select('state,external_id').eq('operation', 'product.create').eq('local_id', variant.id).maybeSingle())
  let created = intent?.state === 'confirmed' && intent.external_id ? { id: intent.external_id } : null
  if (intent && !created) throw conflict('Daftra may already have this product. Refresh the list and link it.')
  const body = daftraProductBody(product, variant)
  if (!created) {
    // Never create a second product with the same name.
    const { products } = await catalog({ force: true, request })
    if (products.some(item => sameName(item.name, body.Product.name))) throw conflict('Daftra already has a product with this name. Link it instead.')
    created = await createRemoteRecord(db, 'product.create', variant.id, '/products.json', body, request, { refused: 'Daftra refused this product. Check its name and price.' })
  }
  const daftraId = String(created.id)
  const { data, error } = await db.rpc('erp_save_product_links', { p_admin_id: adminId, p_links: [{ variant_id: variant.id, daftra_id: daftraId, daftra_code: null, source: 'owner' }] })
  if (error) throw createError({ statusCode: error.code === '42501' ? 403 : 409, statusMessage: error.code === '42501' ? 'Product editing permission is required.' : 'Created in Daftra. Refresh the list and link it.' })
  clearDaftraCatalogCache()
  return { daftraId, name: body.Product.name, requeued: data?.requeued || 0 }
}
