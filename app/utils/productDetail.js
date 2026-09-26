import { getConfiguredStoreImageUrl } from './storefront.js'

export const buildProductGallery = (product, images = [], broken = []) => {
  const seen = new Set()
  return [{ image_url: product?.image_url, alt_text: product?.title }, ...images].flatMap((image) => {
    const url = getConfiguredStoreImageUrl(image?.image_url)
    if (!url || seen.has(url) || broken.includes(url)) return []
    seen.add(url)
    return [{ url, alt: String(image?.alt_text || product?.title || 'Product image') }]
  })
}

export const selectProductGalleryImages = (images = [], requiresVariant = false, variantId = '') => {
  if (!requiresVariant) return images
  return variantId ? images.filter((image) => image.variant_id === variantId) : []
}

export const visibleProductSpecifications = (rows = []) => rows.filter((item) =>
  String(item.label || '').trim() && String(item.value || '').trim()
)

export const productSavings = (price, oldPrice) => {
  const current = Number(price)
  const previous = Number(oldPrice)
  return Number.isFinite(current) && Number.isFinite(previous) && previous > current && current >= 0
    ? { amount: previous - current, percent: Math.round((previous - current) / previous * 100) }
    : { amount: 0, percent: 0 }
}

export const pickRelatedProducts = (product, items = []) => {
  const score = (item) => Number(item.category_id === product.category_id) * 8
    + Number(item.brand_id === product.brand_id) * 4
    + Number(Boolean(item.is_top_seller)) * 2 + Number(Boolean(item.is_featured))
  return items.filter((item) => item.id && item.id !== product.id && item.is_published !== false
    && item.slug && item.title && Number.isFinite(Number(item.price)) && Number(item.price) >= 0)
    .sort((a, b) => score(b) - score(a) || Number(b.popularity_score || 0) - Number(a.popularity_score || 0))
    .slice(0, 4)
}
