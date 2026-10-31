import { validPublicSlug } from '../../app/utils/seo.js'

// WordPress's product query variable names a slug, never a mailbox or numeric ID.
export function legacyProductQueryIntent(rawUrl, method = 'GET') {
  if (!['GET', 'HEAD'].includes(method) || typeof rawUrl !== 'string' || !rawUrl.startsWith('/') || rawUrl.startsWith('//') || rawUrl.includes('\\')) return null
  const url = new URL(rawUrl, 'http://legacy.invalid')
  if (!['/', '/index.php', '/ar', '/ar/', '/ar/index.php'].includes(url.pathname) || !url.searchParams.has('product')) return null
  const slugs = url.searchParams.getAll('product')
  const types = url.searchParams.getAll('post_type')
  const valid = slugs.length === 1 && validPublicSlug(slugs[0]) && !url.searchParams.has('p') && !url.searchParams.has('page_id')
    && (types.length === 0 || types.length === 1 && types[0] === 'product')
  return { slug: valid ? slugs[0] : null, locale: url.pathname.startsWith('/ar') ? 'ar' : 'en' }
}

export async function resolveLegacyProductQuery(intent, findPublishedProduct) {
  if (!intent?.slug) return { status: 404 }
  const product = await findPublishedProduct(intent.slug)
  if (!product || product.is_published !== true || product.slug !== intent.slug || !validPublicSlug(product.slug)) return { status: 404 }
  return { status: 301, location: `${intent.locale === 'ar' ? '/ar' : ''}/products/${product.slug}` }
}
