import { getConfiguredStoreImageUrl } from './storefront.js'

export const heroLayoutMode = value => ['carousel', 'banner', 'both'].includes(value) ? value : 'both'
const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const percent = value => Number.isFinite(Number(value)) && value !== '' ? Math.min(100, Math.max(0, Number(value))) : 50
export function normalizeHeroPresentation(value = {}) {
  const row = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  return {
    mobile_image_url: text(row.mobile_image_url, 2048),
    title_en: text(row.title_en, 120), title_ar: text(row.title_ar, 120),
    body_en: text(row.body_en, 240), body_ar: text(row.body_ar, 240),
    cta_en: text(row.cta_en, 60), cta_ar: text(row.cta_ar, 60),
    fit: row.fit === 'cover' ? 'cover' : 'contain',
    mobile_fit: row.mobile_fit === 'cover' ? 'cover' : 'contain',
    focal_x: percent(row.focal_x), focal_y: percent(row.focal_y),
    mobile_focal_x: percent(row.mobile_focal_x), mobile_focal_y: percent(row.mobile_focal_y)
  }
}
export function configuredHeroBanners(content) {
  return (content?.heroBanners || []).filter(row => row.is_enabled !== false && row.id !== 'default-hero-banner' && getConfiguredStoreImageUrl(row.image_url))
}
export function selectedHeroBanners(content) {
  const rows = configuredHeroBanners(content)
  if (heroLayoutMode(content?.settings?.hero_layout_mode) !== 'banner') return rows
  const selected = rows.find(row => row.id === content?.settings?.hero_static_banner_id)
  return selected ? [selected] : rows.slice(0, 1)
}
