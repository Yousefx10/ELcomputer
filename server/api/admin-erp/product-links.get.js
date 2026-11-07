import { createError, getQuery, setHeader } from 'h3'
import { requireAdminRequest } from '../../utils/adminRequest'
import { assertExternalErpDomain } from '../../utils/erpOwnership'
import { readDaftraCatalog } from '../../utils/daftraCatalog'
import { suggestDaftraLinks } from '../../utils/daftraLinks'

const readRows = async (supabaseAdmin, table, fields, scope = query => query) => {
  const rows = []
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await scope(supabaseAdmin.from(table).select(fields)).order('id').range(from, from + 999)
    if (error) throw createError({ statusCode: 503, statusMessage: 'Product links are unavailable.' })
    rows.push(...(data || []))
    if ((data || []).length < 1000) return rows
  }
  throw createError({ statusCode: 503, statusMessage: 'Product links are unavailable.' })
}

// Every active website option with its Daftra link or a suggestion the owner confirms.
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const { supabaseAdmin } = await requireAdminRequest(event, { permission: 'products.edit' })
  await assertExternalErpDomain(supabaseAdmin)
  const [catalog, products, variants, links] = await Promise.all([
    readDaftraCatalog({ force: getQuery(event).refresh === '1' }),
    readRows(supabaseAdmin, 'products', 'id,title,sku,is_published,image_url'),
    readRows(supabaseAdmin, 'product_variants', 'id,product_id,name,code,sku,is_active', query => query.eq('is_active', true)),
    readRows(supabaseAdmin, 'erp_entity_links', 'id,local_entity_type,local_id,external_id,metadata', query => query.eq('provider', 'daftra').eq('external_entity_type', 'product'))
  ])
  const productById = new Map(products.map(product => [product.id, product]))
  const optionCount = new Map()
  for (const variant of variants) optionCount.set(variant.product_id, (optionCount.get(variant.product_id) || 0) + 1)
  const linkOf = new Map(links.map(link => [`${link.local_entity_type}:${link.local_id}`, link]))
  const rows = variants.filter(variant => productById.has(variant.product_id)).map(variant => {
    const product = productById.get(variant.product_id)
    const link = linkOf.get(`product_variant:${variant.id}`) || linkOf.get(`product:${product.id}`) || null
    return { variant, product, optionCount: optionCount.get(product.id), link }
  })
  const unlinked = rows.filter(row => !row.link)
  const suggestions = new Map(suggestDaftraLinks(unlinked, catalog.products).map((suggestion, index) => [unlinked[index].variant.id, suggestion]))
  return {
    fetchedAt: catalog.fetchedAt,
    daftra: catalog.products.map(({ id, name, code, active }) => ({ id, name, code, active })),
    rows: rows.map(({ variant, product, link }) => ({
      variantId: variant.id, productId: product.id, title: product.title || '', option: variant.name || '', image: product.image_url || '',
      published: product.is_published === true,
      link: link ? { daftraId: String(link.external_id), source: link.metadata?.source || 'owner' } : null,
      suggestion: link ? null : suggestions.get(variant.id) || null
    })).sort((a, b) => a.title.localeCompare(b.title) || a.option.localeCompare(b.option))
  }
})
