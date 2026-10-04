import { createError } from 'h3'
import { normalizeBrandPage, brandSlug, brandUrl, brandVideo, BRAND_ROW_LIMIT } from '../../app/utils/brandPage.js'
import { validPublicSlug } from '../../app/utils/seo.js'
import { normalizeSeoFields } from './seoFields.js'

export const brandPublicSelect = 'id,name,slug,logo_url,seo_title,seo_description,seo_image_url,brand_page'
export function normalizeBrandPayload(body = {}, existingSlug = '') {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const slug = brandSlug(name, existingSlug)
  const fail = message => { throw createError({ statusCode: 400, statusMessage: message }) }
  if (!name || name.length > 200) fail('Brand name must be 1–200 characters.')
  if (!validPublicSlug(slug)) fail('Use an English name to create the brand URL.')
  if (body.logo_url && !brandUrl(body.logo_url)) fail('Choose a valid logo URL.')
  const input = body.brand_page ?? {}
  if (!input || typeof input !== 'object' || Array.isArray(input) || JSON.stringify(input).length > 100000) fail('Brand content is invalid or too long.')
  if (input.rows && (!Array.isArray(input.rows) || input.rows.length > BRAND_ROW_LIMIT)) fail('Use up to 30 media rows.')
  const page = normalizeBrandPage(input)
  const checkUrl = (raw, normalized) => { if (raw && (typeof raw !== 'string' || raw.trim() !== normalized)) fail('Use a secure image, video or link URL.') }
  for (const key of ['image', 'mobile_image', 'cta_url']) checkUrl(input.hero?.[key], page.hero[key])
  checkUrl(input.background?.image, page.background.image)
  if (input.background?.color && input.background.color !== page.background.color) fail('Use a six-digit background color.')
  for (const [section, limits] of Object.entries({ hero: { title: 200, text: 600, cta_label: 80 }, story: { title: 200, content: 30000, supporting: 2000 } })) {
    for (const [key, max] of Object.entries(limits)) if (input[section]?.[key] && (typeof input[section][key] !== 'string' || input[section][key].length > max)) fail('Brand copy is too long.')
  }
  const ids = new Set()
  for (const [i, row] of (input.rows || []).entries()) {
    if (!row || !['one', 'two'].includes(row.layout) || !Array.isArray(row.items) || row.items.length > (row.layout === 'two' ? 2 : 1)) fail('Media row layout is invalid.')
    for (const record of [row, ...row.items]) {
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(record?.id || '') || ids.has(record.id)) fail('Media rows and items need unique IDs.')
      ids.add(record.id)
    }
    for (const [slot, item] of row.items.entries()) {
      if (!['image', 'video'].includes(item.type)) fail('Choose image or video.')
      for (const key of ['url', 'poster', 'link']) checkUrl(item[key], page.rows[i].items[slot][key])
      for (const [key, max] of [['alt', 300], ['caption', 1000]]) if (item[key] && (typeof item[key] !== 'string' || item[key].length > max)) fail('Media copy is too long.')
      if (item.type === 'video' && item.url && !brandVideo(item.url)) fail('Use YouTube, Vimeo, or a secure MP4/WebM URL.')
    }
  }
  return { ...normalizeSeoFields(body), name, slug, logo_url: brandUrl(body.logo_url) || null, brand_page: page }
}

export function throwBrandError(error) {
  if (error?.code === '23505') throw createError({ statusCode: 409, statusMessage: 'Another brand uses that URL.' })
  throw createError({ statusCode: 500, statusMessage: 'Could not save the brand.' })
}
