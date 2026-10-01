import { createError } from 'h3'
import { seoText, seoPlainText } from '../../app/utils/seo.js'

export function normalizeSeoFields(body = {}) {
  const fields = {}
  for (const [field, maximum] of [['seo_title', 1000], ['seo_description', 10000], ['seo_image_url', 2048]]) {
    if (!Object.hasOwn(body, field)) continue
    const value = field === 'seo_image_url' ? String(body[field] || '').trim() : field === 'seo_title' ? seoPlainText(body[field]) : seoText(body[field])
    if (value.length > maximum) throw createError({ statusCode: 400, statusMessage: 'Search settings are too long.' })
    if (field === 'seo_image_url' && value && !/^(https?:\/\/|\/(?!\/))[^\s<>"']+$/i.test(value)) throw createError({ statusCode: 400, statusMessage: 'Choose a valid social image.' })
    fields[field] = value || null
  }
  return fields
}
